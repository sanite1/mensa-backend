// ═══════════════════════════════════════════════════════════════
// order.service.ts
//
// Pure business logic for the checkout + order lifecycle. Routes
// stay thin wrappers; this file owns line snapshots, stock
// reservation, Paystack initialization, webhook reconciliation,
// Sendbox shipment creation, and confirmation emails.
//
// Stock model: variants are decremented atomically at
// initialize time (the moment the customer hits Pay), then either
// confirmed (on charge.success webhook) or restored (on
// charge.failed / cancelled). This prevents two customers from
// racing for the last unit during the Paystack modal flow.
// ═══════════════════════════════════════════════════════════════

import type { FilterQuery } from 'mongoose'
import { Types } from 'mongoose'

import { Order } from '../models/Order'
import { Product } from '../models/Product'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import { mintOrderNumber } from '../helpers/orderNumber'
import { paystackService } from './external/paystack.service'
import { sendboxService } from './external/sendbox.service'
import { sendMail } from './nodemailer/mail.service'
import {
  computeDiscountKobo,
  findUsableDiscountByCode,
  releaseRedemptionByCode,
  reserveRedemptionByCode,
} from './discount.service'
import { logger } from '../config/logger'
import type {
  CheckoutLineInput,
  FulfilmentStatus,
  InitializeCheckoutInput,
  InitializeCheckoutResult,
  IOrder,
  IOrderAddress,
  IOrderLine,
  ListOrdersQuery,
  ListOrdersResult,
  OrderDocument,
  ShippingRateOption,
  ShippingRatesInput,
  UpdateOrderFulfilmentInput,
} from '../interfaces/order.interface'
import type { ProductDocument } from '../interfaces/product.interface'

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 100
const ESTIMATED_PARCEL_KG = 1.0 // simple placeholder; refine later from variants

// ─── Shared helpers ────────────────────────────────────────────────

interface SnapshottedLine {
  product: ProductDocument
  variant: ProductDocument['variants'][number]
  line: Omit<IOrderLine, '_id'>
}

/** Look up each cart line against the catalogue and build the snapshot we
 *  freeze on the order. Validates product/variant existence + active state
 *  + stock availability. */
async function snapshotLines(
  inputs: CheckoutLineInput[],
): Promise<SnapshottedLine[]> {
  const snapshots: SnapshottedLine[] = []

  for (const input of inputs) {
    if (input.qty < 1) {
      throw new ApiError(422, 'Each line must order at least 1 unit.')
    }
    if (!Types.ObjectId.isValid(input.productId) || !Types.ObjectId.isValid(input.variantId)) {
      throw new ApiError(422, 'Malformed product or variant id.')
    }
    const product = (await Product.findById(input.productId)) as ProductDocument | null
    if (!product || !product.isActive) {
      throw new ApiError(404, 'One of the items in your bag is no longer available.')
    }
    // Admin-controlled sold-out override blocks checkout even if stockCount > 0.
    if (product.isSoldOut) {
      throw new ApiError(
        409,
        `"${product.name}" is sold out right now. Remove it from your bag to continue.`,
      )
    }
    const variant = product.variants.find((v) => String(v._id) === input.variantId)
    if (!variant || !variant.isActive) {
      throw new ApiError(404, 'One of the selected options is no longer available.')
    }
    if (variant.stockCount < input.qty) {
      throw new ApiError(
        409,
        `Only ${variant.stockCount} of "${product.name}" left in your selection.`,
      )
    }

    const unitPrice =
      variant.b2cPriceOverride ?? product.salePrice ?? product.basePriceB2C
    const heroImage = (product.images ?? []).find((img) => img.order === 0) ?? product.images[0]
    const optionTypes = product.optionTypes ?? []
    const variantLabel =
      optionTypes.length === 0
        ? product.name
        : optionTypes
            .map((t) => variant.options?.[t])
            .filter((v): v is string => typeof v === 'string' && v.length > 0)
            .join(' · ')

    snapshots.push({
      product,
      variant,
      line: {
        productId: product._id,
        variantId: variant._id as Types.ObjectId,
        sku: variant.sku,
        productName: product.name,
        variantLabel,
        imageUrl: heroImage?.url,
        slug: product.slug,
        unitPrice,
        qty: input.qty,
        lineTotal: unitPrice * input.qty,
      },
    })
  }

  return snapshots
}

/** Atomically decrement stock for each line. If any line fails (e.g. another
 *  request reserved the last unit between snapshot and reserve), restore the
 *  ones we already decremented and surface a 409. */
async function reserveStock(snapshots: SnapshottedLine[]): Promise<void> {
  const reserved: { productId: Types.ObjectId; variantId: Types.ObjectId; qty: number }[] = []
  for (const { product, variant, line } of snapshots) {
    const result = await Product.updateOne(
      {
        _id: product._id,
        'variants._id': variant._id,
        'variants.stockCount': { $gte: line.qty },
      },
      { $inc: { 'variants.$.stockCount': -line.qty } },
    )
    if (result.modifiedCount === 0) {
      // Rollback previously reserved lines.
      for (const r of reserved) {
        await Product.updateOne(
          { _id: r.productId, 'variants._id': r.variantId },
          { $inc: { 'variants.$.stockCount': r.qty } },
        )
      }
      throw new ApiError(
        409,
        `Stock changed while we were preparing your order. Please try again.`,
      )
    }
    reserved.push({
      productId: product._id,
      variantId: variant._id as Types.ObjectId,
      qty: line.qty,
    })
  }
}

/** Inverse of reserveStock. Used when a checkout fails after reservation. */
async function restoreStockFor(lines: IOrderLine[]): Promise<void> {
  for (const line of lines) {
    await Product.updateOne(
      { _id: line.productId, 'variants._id': line.variantId },
      { $inc: { 'variants.$.stockCount': line.qty } },
    )
  }
}

const IN_HOUSE_STATES = new Set(['FCT', 'Abuja', 'Lagos'])

// ─── Public: shipping rates ───────────────────────────────────────
export const getShippingRatesService = async (
  input: ShippingRatesInput,
): Promise<ApiResponse<{ options: ShippingRateOption[] }>> => {
  if (input.lines.length === 0) {
    throw new ApiError(400, 'No items in cart.')
  }
  if (!input.destination.state) {
    throw new ApiError(422, 'Delivery state is required.')
  }

  const rates = await sendboxService.getRates({
    destinationState: input.destination.state,
    destinationCity: input.destination.city,
    weightKg: ESTIMATED_PARCEL_KG,
  })

  const options: ShippingRateOption[] = rates.map((r) => ({
    method: r.serviceId === 'inhouse-rider' ? 'inhouse' : 'sendbox',
    name: r.name,
    eta: `${r.etaMin} to ${r.etaMax} ${r.etaMin === r.etaMax ? 'day' : 'days'}`,
    amount: r.feeKobo,
  }))

  return new ApiResponse(200, 'OK.', { options })
}

// ─── Public: initialize checkout ──────────────────────────────────
export const initializeCheckoutService = async (
  input: InitializeCheckoutInput,
  userId: string | null,
): Promise<ApiResponse<InitializeCheckoutResult>> => {
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY
  if (!publicKey) {
    throw new ApiError(
      500,
      'Payments are not configured. Please contact support.',
    )
  }

  // 1. Snapshot lines + validate availability.
  const snapshots = await snapshotLines(input.lines)
  const subtotal = snapshots.reduce((sum, s) => sum + s.line.lineTotal, 0)
  if (subtotal <= 0) {
    throw new ApiError(422, 'Order subtotal is zero.')
  }

  // 2. Verify the shipping amount the client sent matches a real rate for
  //    this destination + method. Prevents tampering with the price.
  const rates = await sendboxService.getRates({
    destinationState: input.address.state,
    destinationCity: input.address.city,
    weightKg: ESTIMATED_PARCEL_KG,
  })
  const matchingRate = rates.find((r) => {
    const inferredMethod = r.serviceId === 'inhouse-rider' ? 'inhouse' : 'sendbox'
    return inferredMethod === input.shippingMethod && r.feeKobo === input.shippingAmount
  })
  if (!matchingRate) {
    throw new ApiError(
      422,
      'The selected shipping option is no longer available. Refresh and pick again.',
    )
  }
  if (input.shippingMethod === 'inhouse' && !IN_HOUSE_STATES.has(input.address.state)) {
    throw new ApiError(
      422,
      'In-house delivery is only available in FCT, Abuja, and Lagos.',
    )
  }

  // 3. Resolve the discount code (if any) and compute totals.
  let discountKobo = 0
  let appliedDiscountCode: string | null = null
  const rawCode = input.discountCode?.trim()
  if (rawCode) {
    const discount = await findUsableDiscountByCode(rawCode)
    if (discount) {
      discountKobo = computeDiscountKobo(discount, subtotal)
      appliedDiscountCode = discount.code
    }
  }
  const totals = {
    subtotal,
    shipping: matchingRate.feeKobo,
    discount: discountKobo,
    total: Math.max(0, subtotal + matchingRate.feeKobo - discountKobo),
  }
  if (totals.total <= 0) {
    throw new ApiError(
      422,
      'This discount would bring the total to zero. Please use a smaller code or remove items.',
    )
  }

  // 4. Reserve stock atomically.
  await reserveStock(snapshots)

  // 4b. Reserve one redemption of the discount code (if any). Race-safe:
  //     if the maxUses cap was hit between preview and now, we refuse the
  //     order before persisting anything and release stock immediately.
  let discountReserved = false
  if (appliedDiscountCode) {
    discountReserved = await reserveRedemptionByCode(appliedDiscountCode)
    if (!discountReserved) {
      await restoreStockFor(snapshots.map((s) => s.line as IOrderLine))
      throw new ApiError(
        409,
        `Code "${appliedDiscountCode}" just hit its usage limit. Try again without it.`,
      )
    }
  }

  let order: OrderDocument | null = null
  try {
    // 5. Mint number + persist pending order.
    const orderNumber = await mintOrderNumber()
    const address: IOrderAddress = {
      fullName: input.address.fullName,
      phone: input.address.phone,
      line1: input.address.line1,
      line2: input.address.line2,
      city: input.address.city,
      state: input.address.state,
      country: input.address.country || 'NG',
      postal: input.address.postal,
    }
    order = (await Order.create({
      orderNumber,
      source: 'web',
      userId: userId ? new Types.ObjectId(userId) : null,
      customerEmail: input.customerEmail.toLowerCase().trim(),
      customerPhone: input.customerPhone.trim(),
      lines: snapshots.map((s) => s.line),
      address,
      totals,
      payment: { status: 'pending', reference: orderNumber },
      fulfilment: { status: 'pending', shippingMethod: input.shippingMethod },
      discountCode: appliedDiscountCode ?? undefined,
    })) as OrderDocument

    // 6. Initialize Paystack transaction.
    const init = await paystackService.initializeTransaction({
      email: order.customerEmail,
      amountKobo: totals.total,
      reference: orderNumber,
      callbackUrl: `${process.env.FRONTEND_PLATFORM_URL}/checkout/confirmation/${orderNumber}`,
      metadata: { orderNumber, userId: userId ?? null },
    })

    order.payment.accessCode = init.accessCode
    order.payment.authorizationUrl = init.authorizationUrl
    await order.save()

    return new ApiResponse(201, 'Checkout initialized.', {
      orderNumber,
      reference: orderNumber,
      accessCode: init.accessCode,
      authorizationUrl: init.authorizationUrl,
      amount: totals.total,
      publicKey,
    })
  } catch (err) {
    // Rollback the stock reservation on any failure after we reserved.
    await restoreStockFor(snapshots.map((s) => s.line as IOrderLine))
    // Release the discount redemption too — order never made it to paid.
    if (discountReserved && appliedDiscountCode) {
      await releaseRedemptionByCode(appliedDiscountCode)
    }
    // If the order was persisted before the failure, mark it failed for audit.
    if (order) {
      order.payment.status = 'failed'
      await order.save()
    }
    throw err
  }
}

// ─── Webhook reconciliation ───────────────────────────────────────

/** Mark an order as paid and trigger downstream side effects.
 *  Idempotent: a second call on an already-paid order is a no-op.
 *
 *  Security model: the signed webhook is the primary trust boundary. If the
 *  Paystack-side `transaction/verify` call returns something other than
 *  'success', we LOG that discrepancy but still proceed — verify can lag the
 *  webhook by a few seconds in test mode. We only refuse to mark the order
 *  paid when the verify-side amount is *less than* what the customer was
 *  supposed to pay (the only mismatch that's actually unsafe). */
export const markOrderPaidService = async (
  reference: string,
  paystackPayload?: Record<string, unknown>,
): Promise<void> => {
  logger.info(`[markOrderPaid] start ref=${reference}`)
  const order = (await Order.findOne({ orderNumber: reference })) as OrderDocument | null
  if (!order) {
    logger.warn(
      `[markOrderPaid] No order with orderNumber=${reference}. ` +
        `Either the customer paid via a non-Mensa Paystack link, or our ` +
        `/checkout/initialize never persisted the order.`,
    )
    return
  }
  if (order.payment.status === 'paid') {
    logger.info(`[markOrderPaid] ${reference} already paid; idempotent skip.`)
    return
  }
  logger.info(
    `[markOrderPaid] order=${reference} status=${order.payment.status} expectedKobo=${order.totals.total}`,
  )

  // Defense in depth: cross-check against Paystack's own record. Failures
  // are logged but do not block the email — the signed webhook is enough.
  try {
    const verify = await paystackService.verifyTransaction(reference)
    logger.info(
      `[markOrderPaid] verify result status=${verify.status} amount=${verify.amount}`,
    )
    if (verify.status !== 'success') {
      logger.warn(
        `[markOrderPaid] Verify status is '${verify.status}' for ${reference}. ` +
          `Trusting the signed webhook and proceeding.`,
      )
    }
    if (verify.amount < order.totals.total) {
      logger.error(
        `[markOrderPaid] UNDERPAID for ${reference}: expected ${order.totals.total}, got ${verify.amount}. Refusing to mark paid.`,
      )
      return
    }
  } catch (err) {
    logger.error(`[markOrderPaid] verifyTransaction call failed for ${reference}`, err)
    // Proceed on the signed webhook alone.
  }

  order.payment.status = 'paid'
  order.payment.paidAt = new Date()
  if (paystackPayload) order.payment.lastWebhookPayload = paystackPayload
  order.fulfilment.status = 'processing'

  // Create shipment for Sendbox method (or stub when key is absent).
  if (order.fulfilment.shippingMethod === 'sendbox') {
    try {
      const shipment = await sendboxService.createShipment({
        reference: order.orderNumber,
        serviceId: 'nationwide-stub', // real serviceId would be persisted at init time
        recipientName: order.address.fullName,
        recipientPhone: order.address.phone,
        recipientAddress: [order.address.line1, order.address.line2].filter(Boolean).join(', '),
        recipientState: order.address.state,
        recipientCity: order.address.city,
        weightKg: ESTIMATED_PARCEL_KG,
      })
      order.fulfilment.trackingCode = shipment.trackingNumber
      order.fulfilment.trackingUrl = sendboxService.trackingUrl(shipment.trackingNumber)
      logger.info(
        `[markOrderPaid] sendbox shipment created tracking=${shipment.trackingNumber}`,
      )
    } catch (err) {
      logger.error(`[Sendbox] Shipment failed for ${order.orderNumber}`, err)
      // Order stays in 'processing' so admin can recreate the shipment.
    }
  }

  await order.save()
  logger.info(`[markOrderPaid] saved order=${reference} as paid. Sending email…`)

  // Fire confirmation email. sendMail catches its own errors so a broken
  // SMTP config never blocks the webhook from returning 200, but we still
  // log around it here so the failure is visible end-to-end.
  try {
    // Spread Mongoose subdoc fields into a plain JS object so Handlebars
    // can reach `address.fullName` etc. through normal property access.
    // The default getter proxy on Mongoose subdocs sometimes returns
    // undefined for nested lookups inside Handlebars templates.
    const addressPlain = {
      fullName: order.address.fullName ?? '',
      phone: order.address.phone ?? '',
      line1: order.address.line1 ?? '',
      line2: order.address.line2 ?? '',
      city: order.address.city ?? '',
      state: order.address.state ?? '',
      country: order.address.country ?? '',
      postal: order.address.postal ?? '',
    }

    await sendMail({
      to: order.customerEmail,
      subject: `Your Mensa order ${order.orderNumber}`,
      template: 'orderConfirmation',
      data: {
        orderNumber: order.orderNumber,
        customerName: (addressPlain.fullName || 'there').split(' ')[0],
        lines: order.lines.map((l) => ({
          name: l.productName,
          variant: l.variantLabel,
          qty: l.qty,
          lineTotal: formatNaira(l.lineTotal),
        })),
        subtotal: formatNaira(order.totals.subtotal),
        shipping: formatNaira(order.totals.shipping),
        total: formatNaira(order.totals.total),
        address: addressPlain,
        trackingUrl: `${process.env.FRONTEND_PLATFORM_URL}/checkout/confirmation/${order.orderNumber}`,
      },
    })
    logger.info(
      `[markOrderPaid] confirmation email dispatched to=${order.customerEmail}`,
    )
  } catch (err) {
    // Should not happen — sendMail swallows internally — but belt and braces.
    logger.error(`[markOrderPaid] sendMail threw unexpectedly`, err)
  }
}

/** Mark an order as failed and release the stock it reserved. */
export const markOrderFailedService = async (reference: string): Promise<void> => {
  const order = (await Order.findOne({ orderNumber: reference })) as OrderDocument | null
  if (!order) return
  if (order.payment.status !== 'pending') return
  order.payment.status = 'failed'
  await order.save()
  await restoreStockFor(order.lines)
  if (order.discountCode) {
    await releaseRedemptionByCode(order.discountCode)
  }

  // Best-effort notify the customer so they know they have not been charged.
  await sendMail({
    to: order.customerEmail,
    subject: `Your Mensa order ${order.orderNumber}`,
    template: 'orderFailed',
    data: {
      orderNumber: order.orderNumber,
      retryUrl: `${process.env.FRONTEND_PLATFORM_URL}/checkout`,
    },
  })
}

/**
 * Verify-on-return: hit Paystack's `transaction/verify` endpoint directly
 * and reconcile the local order based on the response.
 *
 * Why we have this in addition to the webhook:
 *   • The customer comes back to /checkout/confirmation/:ref via Paystack's
 *     redirect. At that moment the webhook may not have landed (or may
 *     never land, if ngrok is down or the secret is wrong). Calling
 *     Paystack directly gives us an authoritative answer immediately.
 *   • Idempotent — safe to call as many times as the frontend wants. If
 *     the order is already paid, we just return it.
 *
 * Safe to expose publicly: an attacker who guesses an order number gains
 * nothing because Paystack is the source of truth for whether *that
 * reference* actually completed a charge.
 */
export const verifyAndReconcileOrderService = async (
  reference: string,
): Promise<ApiResponse<{ order: OrderDocument }>> => {
  logger.info(`[verifyAndReconcile] start ref=${reference}`)
  const order = (await Order.findOne({ orderNumber: reference })) as OrderDocument | null
  if (!order) throw new ApiError(404, 'Order not found.')

  if (order.payment.status === 'paid') {
    logger.info(`[verifyAndReconcile] ${reference} already paid; returning.`)
    return new ApiResponse(200, 'OK.', { order })
  }

  try {
    const verify = await paystackService.verifyTransaction(reference)
    logger.info(
      `[verifyAndReconcile] paystack status=${verify.status} amount=${verify.amount}`,
    )
    if (verify.status === 'success') {
      if (verify.amount < order.totals.total) {
        logger.error(
          `[verifyAndReconcile] UNDERPAID ${reference}: expected ${order.totals.total}, got ${verify.amount}.`,
        )
        throw new ApiError(400, 'Payment amount does not match the order total.')
      }
      // Idempotent: shared with the webhook path. Marks paid + shipment + email.
      await markOrderPaidService(reference, { source: 'verify-on-return' })
    } else if (verify.status === 'failed' || verify.status === 'abandoned') {
      await markOrderFailedService(reference)
    }
    // 'pending' or anything else: leave the order alone; frontend keeps polling.
  } catch (err) {
    if (err instanceof ApiError) throw err
    logger.error(`[verifyAndReconcile] paystack verify failed for ${reference}`, err)
    // Don't surface as a hard error — the webhook may still resolve it.
  }

  const refreshed = (await Order.findOne({ orderNumber: reference })) as OrderDocument | null
  if (!refreshed) throw new ApiError(404, 'Order not found.')
  return new ApiResponse(200, 'OK.', { order: refreshed })
}

// ─── Reads ────────────────────────────────────────────────────────

export const listMyOrdersService = async (
  userId: string,
  query: ListOrdersQuery,
): Promise<ApiResponse<ListOrdersResult>> => {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))
  const filter: FilterQuery<IOrder> = { userId: new Types.ObjectId(userId) }
  if (query.paymentStatus) filter['payment.status'] = query.paymentStatus
  if (query.fulfilmentStatus) filter['fulfilment.status'] = query.fulfilmentStatus

  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize) as unknown as Promise<OrderDocument[]>,
    Order.countDocuments(filter),
  ])

  return new ApiResponse(200, 'OK.', {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

export const getMyOrderService = async (
  userId: string,
  orderId: string,
): Promise<ApiResponse<{ order: OrderDocument }>> => {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new ApiError(404, 'Order not found.')
  }
  const order = (await Order.findOne({
    _id: orderId,
    userId: new Types.ObjectId(userId),
  })) as OrderDocument | null
  if (!order) throw new ApiError(404, 'Order not found.')
  return new ApiResponse(200, 'OK.', { order })
}

export const trackOrderService = async (
  orderNumber: string,
  email: string,
): Promise<ApiResponse<{ order: OrderDocument }>> => {
  const order = (await Order.findOne({
    orderNumber: orderNumber.trim(),
    customerEmail: email.toLowerCase().trim(),
  })) as OrderDocument | null
  if (!order) {
    throw new ApiError(
      404,
      'No order matches that number and email combination.',
    )
  }
  return new ApiResponse(200, 'OK.', { order })
}

// ─── Admin reads ──────────────────────────────────────────────────

export const adminListOrdersService = async (
  query: ListOrdersQuery,
): Promise<ApiResponse<ListOrdersResult>> => {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))
  const filter: FilterQuery<IOrder> = {}
  if (query.paymentStatus) filter['payment.status'] = query.paymentStatus
  if (query.fulfilmentStatus) filter['fulfilment.status'] = query.fulfilmentStatus

  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize) as unknown as Promise<OrderDocument[]>,
    Order.countDocuments(filter),
  ])

  return new ApiResponse(200, 'OK.', {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

/* ─── Admin: get a single order by id ─────────────────────────────── */
export const adminGetOrderService = async (
  orderId: string,
): Promise<ApiResponse<{ order: OrderDocument }>> => {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new ApiError(404, 'Order not found.')
  }
  const order = (await Order.findById(orderId)) as OrderDocument | null
  if (!order) throw new ApiError(404, 'Order not found.')
  return new ApiResponse(200, 'OK.', { order })
}

/* ─── Admin: update fulfilment ────────────────────────────────────── */

/** Forward-only fulfilment state machine, plus 'cancelled' as a sink
 *  reachable from any pre-shipped state. The order each status appears
 *  in determines what's allowed: any later index is fine, any earlier
 *  index is rejected. `cancelled` and `delivered` are terminal — no
 *  further transitions allowed. */
const FULFILMENT_ORDER: FulfilmentStatus[] = [
  'pending',
  'processing',
  'shipped',
  'delivered',
]

function canTransitionFulfilment(
  from: FulfilmentStatus,
  to: FulfilmentStatus,
): boolean {
  if (from === to) return false // no-op transitions are an admin mistake
  if (from === 'delivered' || from === 'cancelled') return false
  if (to === 'cancelled') return from !== 'shipped' // can't cancel after it left the studio
  const fromIdx = FULFILMENT_ORDER.indexOf(from)
  const toIdx = FULFILMENT_ORDER.indexOf(to)
  if (fromIdx === -1 || toIdx === -1) return false
  return toIdx > fromIdx
}

export const adminUpdateOrderFulfilmentService = async (
  orderId: string,
  input: UpdateOrderFulfilmentInput,
  actorUserId: string | null,
): Promise<ApiResponse<{ order: OrderDocument }>> => {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new ApiError(404, 'Order not found.')
  }
  const order = (await Order.findById(orderId)) as OrderDocument | null
  if (!order) throw new ApiError(404, 'Order not found.')

  // Cannot fulfil what wasn't paid for. Refunds are a separate flow.
  if (
    input.status !== 'cancelled' &&
    order.payment.status !== 'paid'
  ) {
    throw new ApiError(
      409,
      'This order has not been paid. Wait for payment before updating fulfilment.',
    )
  }

  if (!canTransitionFulfilment(order.fulfilment.status, input.status)) {
    throw new ApiError(
      409,
      `Cannot move from "${order.fulfilment.status}" to "${input.status}".`,
    )
  }

  const now = new Date()
  order.fulfilment.status = input.status

  if (input.status === 'shipped') {
    order.fulfilment.shippedAt = now
    // Manual tracking input overrides whatever Sendbox stub set, so
    // admin can correct or fill in for in-house rider orders.
    if (input.trackingCode?.trim()) {
      order.fulfilment.trackingCode = input.trackingCode.trim()
    }
    if (input.trackingUrl?.trim()) {
      order.fulfilment.trackingUrl = input.trackingUrl.trim()
    }
  }

  if (input.status === 'delivered') {
    order.fulfilment.deliveredAt = now
  }

  if (input.status === 'cancelled') {
    await restoreStockFor(order.lines)
    if (order.discountCode) {
      await releaseRedemptionByCode(order.discountCode)
    }
    logger.info(
      `[adminUpdateFulfilment] cancelled ${order.orderNumber}; stock restored.`,
    )
  }

  if (input.note?.trim()) {
    const stamp = now.toISOString()
    const author = actorUserId ?? 'admin'
    const line = `[${stamp}] ${author}: ${input.note.trim()}`
    order.internalNotes = order.internalNotes
      ? `${order.internalNotes}\n${line}`
      : line
  }

  await order.save()
  logger.info(
    `[adminUpdateFulfilment] order=${order.orderNumber} → ${input.status}`,
  )

  // Side effects after persist so a failed email never rolls back the
  // status change.
  if (input.status === 'shipped') {
    try {
      await sendMail({
        to: order.customerEmail,
        subject: `Your Mensa order ${order.orderNumber} is on its way`,
        template: 'orderShipped',
        data: {
          orderNumber: order.orderNumber,
          customerName:
            (order.address.fullName ?? '').split(' ')[0] || 'there',
          trackingCode: order.fulfilment.trackingCode ?? '',
          trackingUrl:
            order.fulfilment.trackingUrl ??
            `${process.env.FRONTEND_PLATFORM_URL}/orders/track`,
        },
      })
    } catch (err) {
      logger.error(
        `[adminUpdateFulfilment] orderShipped email threw for ${order.orderNumber}`,
        err,
      )
    }
  }

  return new ApiResponse(200, 'Order updated.', { order })
}

// ─── Local helpers ────────────────────────────────────────────────

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`
}
