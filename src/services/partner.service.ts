// ═══════════════════════════════════════════════════════════════
// partner.service.ts
//
// Individual partner (referral / affiliate) lifecycle:
//   apply -> admin approve -> onboarding email -> partner sets
//   password + bank + referral code -> active -> earns commission
//   on every paid order referencing their code, requests payouts.
//
// Commission lifecycle is hooked into order.service:
//   - order paid          ->  accrueCommissionOnOrderPaid
//   - order delivered     ->  markCommissionAvailableForOrder
//   - order cancelled /
//     refunded            ->  reverseCommissionForOrder
//
// Balance aggregates (pending/available/lifetime) are denormalised
// onto the Partner document so the dashboard reads in one query.
// ═══════════════════════════════════════════════════════════════

import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { Types } from 'mongoose'
import type { FilterQuery } from 'mongoose'

import {
  Partner,
  PartnerCommission,
  PartnerPayoutRequest,
} from '../models/Partner'
import { User } from '../models/User'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import { sendMail } from './nodemailer/mail.service'
import { logger } from '../config/logger'
import type {
  AdminApprovePartnerInput,
  AdminListPartnersQuery,
  AdminListPayoutsQuery,
  AdminMarkPayoutPaidInput,
  AdminRejectPartnerInput,
  AdminRejectPayoutInput,
  AdminUpdatePartnerInput,
  ApplyPartnerInput,
  CompletePartnerOnboardingInput,
  IPartner,
  IPartnerBankAccount,
  PartnerDocument,
  PartnerCommissionDocument,
  PartnerPayoutRequestDocument,
  PartnerStatus,
} from '../interfaces/partner.interface'
import type { OrderDocument } from '../interfaces/order.interface'

const BCRYPT_COST = 12
const ONBOARDING_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const DEFAULT_COMMISSION_RATE = 10
const MIN_PAYOUT_KOBO = 500_000 // ₦5,000
const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 100

const escapeRegex = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex')

const generateReferralCode = (): string =>
  crypto.randomBytes(4).toString('hex').toUpperCase()

const isReservedSlug = (code: string): boolean => {
  // Avoid codes that clash with sensitive paths or look like words a
  // partner could exploit. Keep the list short — admins can always
  // override via the admin tool.
  const reserved = new Set([
    'admin',
    'login',
    'register',
    'partner',
    'mensa',
    'shop',
    'about',
    'help',
  ])
  return reserved.has(code.toLowerCase())
}

// ═══════════════════════════════════════════════════════════════
//  Public: apply
// ═══════════════════════════════════════════════════════════════

export const applyAsPartnerService = async (
  input: ApplyPartnerInput,
): Promise<ApiResponse<{ partner: PartnerDocument }>> => {
  const email = input.email.toLowerCase().trim()

  const existing = await Partner.findOne({ email })
  if (existing) {
    if (existing.status === 'rejected') {
      throw new ApiError(409, 'Your previous application was declined.')
    }
    throw new ApiError(409, 'An application with this email already exists.')
  }

  const partner = (await Partner.create({
    name: input.name.trim(),
    email,
    phone: input.phone.trim(),
    socialHandle: input.socialHandle?.trim(),
    notes: input.notes?.trim() ?? '',
    status: 'pending',
    commissionRate: DEFAULT_COMMISSION_RATE,
  })) as PartnerDocument

  return new ApiResponse(201, 'Application received.', { partner })
}

// ═══════════════════════════════════════════════════════════════
//  Public: onboarding (verify + complete)
// ═══════════════════════════════════════════════════════════════

/** Verify an onboarding token and return the partner shell so the
 *  client can render a "Welcome, {name}" page before we ask for
 *  credentials. Throws if the token is invalid, expired, or already
 *  consumed. */
export const verifyOnboardingTokenService = async (
  token: string,
): Promise<
  ApiResponse<{ partner: { name: string; email: string; commissionRate: number } }>
> => {
  const tokenHash = hashToken(token)
  const partner = await Partner.findOne({
    onboardingTokenHash: tokenHash,
    onboardingTokenExpiresAt: { $gt: new Date() },
    status: 'approved',
  }).select('+onboardingTokenHash +onboardingTokenExpiresAt')
  if (!partner) {
    throw new ApiError(400, 'This onboarding link is invalid or has expired.')
  }
  return new ApiResponse(200, 'OK.', {
    partner: {
      name: partner.name,
      email: partner.email,
      commissionRate: partner.commissionRate,
    },
  })
}

/** Complete the onboarding: set the partner's password on the linked
 *  User, write bank details, set referral code, flip to active. Returns
 *  enough metadata that the client can then call /auth/login with the
 *  email + chosen password. */
export const completePartnerOnboardingService = async (
  token: string,
  input: CompletePartnerOnboardingInput,
): Promise<
  ApiResponse<{ email: string; referralCode: string }>
> => {
  const tokenHash = hashToken(token)
  const partner = (await Partner.findOne({
    onboardingTokenHash: tokenHash,
    onboardingTokenExpiresAt: { $gt: new Date() },
    status: 'approved',
  }).select('+onboardingTokenHash +onboardingTokenExpiresAt')) as PartnerDocument | null

  if (!partner) {
    throw new ApiError(400, 'This onboarding link is invalid or has expired.')
  }
  if (!partner.userId) {
    throw new ApiError(500, 'Partner account is not linked. Contact support.')
  }

  // ── Referral code: pick provided one if available, else generate ──
  let referralCode = input.referralCode?.trim().toUpperCase()
  if (referralCode) {
    if (!/^[A-Z0-9]{3,16}$/.test(referralCode)) {
      throw new ApiError(
        400,
        'Referral code must be 3 to 16 letters or numbers, no spaces.',
      )
    }
    if (isReservedSlug(referralCode)) {
      throw new ApiError(409, 'That referral code is reserved. Try another.')
    }
    const clash = await Partner.findOne({
      referralCode,
      _id: { $ne: partner._id },
    })
    if (clash) throw new ApiError(409, 'That referral code is already taken.')
  } else {
    // Generate and retry on collision (extremely unlikely with 8 hex chars).
    for (let attempts = 0; attempts < 5; attempts++) {
      const candidate = generateReferralCode()
      const clash = await Partner.findOne({ referralCode: candidate })
      if (!clash) {
        referralCode = candidate
        break
      }
    }
    if (!referralCode) {
      throw new ApiError(500, 'Could not generate a referral code. Try again.')
    }
  }

  // ── Bank details ──
  const bankAccount: IPartnerBankAccount = {
    accountName: input.bankAccount.accountName.trim(),
    accountNumber: input.bankAccount.accountNumber.trim(),
    bankName: input.bankAccount.bankName.trim(),
    bankCode: input.bankAccount.bankCode?.trim(),
  }

  // ── Persist password on the linked User ──
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST)
  await User.updateOne(
    { _id: partner.userId },
    {
      $set: {
        passwordHash,
        emailVerified: true,
        refreshTokenHash: null,
      },
    },
  )

  // ── Activate the partner ──
  partner.referralCode = referralCode
  partner.bankAccount = bankAccount
  partner.status = 'active'
  partner.activatedAt = new Date()
  partner.onboardingTokenHash = null
  partner.onboardingTokenExpiresAt = null
  await partner.save()

  return new ApiResponse(200, 'Welcome to the Mensa partner programme.', {
    email: partner.email,
    referralCode,
  })
}

// ═══════════════════════════════════════════════════════════════
//  Authed: partner self (dashboard, request payout, update bank)
// ═══════════════════════════════════════════════════════════════

export interface PartnerSelfDashboard {
  partner: {
    _id: string
    name: string
    email: string
    referralCode: string
    commissionRate: number
    status: PartnerStatus
    pendingBalanceKobo: number
    availableBalanceKobo: number
    lifetimeEarnedKobo: number
    lifetimePaidKobo: number
    bankAccount?: IPartnerBankAccount
  }
  referralUrl: string
  minPayoutKobo: number
  recentCommissions: Array<{
    _id: string
    orderNumber: string
    amountKobo: number
    status: string
    createdAt: Date
    availableAt?: Date | null
  }>
  payoutRequests: Array<{
    _id: string
    amountKobo: number
    status: string
    requestedAt: Date
    processedAt?: Date | null
    paymentReference?: string
  }>
}

/** Resolve the partner record for the signed-in user. Throws if the
 *  user isn't a partner (caller should already have role-gated, but
 *  we re-check here so the service is safe to call directly). */
async function loadPartnerForUser(userId: string): Promise<PartnerDocument> {
  if (!Types.ObjectId.isValid(userId)) {
    throw new ApiError(404, 'Partner profile not found.')
  }
  const partner = (await Partner.findOne({
    userId: new Types.ObjectId(userId),
  })) as PartnerDocument | null
  if (!partner) throw new ApiError(404, 'Partner profile not found.')
  return partner
}

export const getPartnerSelfDashboardService = async (
  userId: string,
): Promise<ApiResponse<PartnerSelfDashboard>> => {
  const partner = await loadPartnerForUser(userId)

  const [commissions, payouts] = await Promise.all([
    PartnerCommission.find({ partnerId: partner._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    PartnerPayoutRequest.find({ partnerId: partner._id })
      .sort({ requestedAt: -1 })
      .limit(10)
      .lean(),
  ])

  const platformUrl = process.env.FRONTEND_PLATFORM_URL ?? ''
  const referralUrl = partner.referralCode
    ? `${platformUrl}/?ref=${partner.referralCode}`
    : ''

  return new ApiResponse(200, 'OK.', {
    partner: {
      _id: partner._id.toString(),
      name: partner.name,
      email: partner.email,
      referralCode: partner.referralCode ?? '',
      commissionRate: partner.commissionRate,
      status: partner.status,
      pendingBalanceKobo: partner.pendingBalanceKobo,
      availableBalanceKobo: partner.availableBalanceKobo,
      lifetimeEarnedKobo: partner.lifetimeEarnedKobo,
      lifetimePaidKobo: partner.lifetimePaidKobo,
      bankAccount: partner.bankAccount,
    },
    referralUrl,
    minPayoutKobo: MIN_PAYOUT_KOBO,
    recentCommissions: commissions.map((c) => ({
      _id: c._id.toString(),
      orderNumber: c.orderNumber,
      amountKobo: c.amountKobo,
      status: c.status,
      createdAt: c.createdAt,
      availableAt: c.availableAt ?? null,
    })),
    payoutRequests: payouts.map((p) => ({
      _id: p._id.toString(),
      amountKobo: p.amountKobo,
      status: p.status,
      requestedAt: p.requestedAt,
      processedAt: p.processedAt ?? null,
      paymentReference: p.paymentReference,
    })),
  })
}

/** Partner self-service: update payout bank account. Activated partners
 *  only — orgs in 'pending' / 'approved' status can't be here yet, and
 *  'rejected' / 'suspended' partners shouldn't be editing payout
 *  destinations. */
export const updatePartnerBankAccountService = async (
  userId: string,
  input: IPartnerBankAccount,
): Promise<ApiResponse<{ bankAccount: IPartnerBankAccount }>> => {
  const partner = await loadPartnerForUser(userId)
  if (partner.status !== 'active') {
    throw new ApiError(409, 'Your partner account must be active to edit bank details.')
  }

  const bankAccount: IPartnerBankAccount = {
    accountName: input.accountName.trim(),
    accountNumber: input.accountNumber.trim(),
    bankName: input.bankName.trim(),
    bankCode: input.bankCode?.trim(),
  }
  partner.bankAccount = bankAccount
  await partner.save()

  return new ApiResponse(200, 'Bank account updated.', { bankAccount })
}

export const requestPartnerPayoutService = async (
  userId: string,
): Promise<ApiResponse<{ payoutRequest: PartnerPayoutRequestDocument }>> => {
  const partner = await loadPartnerForUser(userId)
  if (partner.status !== 'active') {
    throw new ApiError(409, 'Your partner account is not active.')
  }
  if (!partner.bankAccount) {
    throw new ApiError(409, 'Add your bank details before requesting a payout.')
  }
  if (partner.availableBalanceKobo < MIN_PAYOUT_KOBO) {
    throw new ApiError(
      409,
      `You need at least ₦${(MIN_PAYOUT_KOBO / 100).toLocaleString('en-NG')} in available balance to cash out.`,
    )
  }
  // Block stacking: one pending payout at a time so the ledger stays sane.
  const pending = await PartnerPayoutRequest.findOne({
    partnerId: partner._id,
    status: 'pending',
  })
  if (pending) {
    throw new ApiError(409, 'You already have a payout in review. Hang tight.')
  }

  const amountKobo = partner.availableBalanceKobo

  // Bundle every 'available' commission into this payout. They flip
  // to 'paid' when admin marks the request paid.
  const commissions = await PartnerCommission.find({
    partnerId: partner._id,
    status: 'available',
  })

  const payoutRequest = (await PartnerPayoutRequest.create({
    partnerId: partner._id,
    amountKobo,
    bankAccountSnapshot: partner.bankAccount,
    status: 'pending',
    requestedAt: new Date(),
  })) as PartnerPayoutRequestDocument

  if (commissions.length > 0) {
    await PartnerCommission.updateMany(
      { _id: { $in: commissions.map((c) => c._id) } },
      { $set: { payoutRequestId: payoutRequest._id } },
    )
  }

  // Optimistically zero out available balance. When the admin pays,
  // we move it into lifetimePaid. If admin rejects, we restore it.
  partner.availableBalanceKobo = 0
  await partner.save()

  return new ApiResponse(201, 'Payout requested. We will pay it manually within 5 working days.', {
    payoutRequest,
  })
}

// ═══════════════════════════════════════════════════════════════
//  Admin: list / get / approve / reject / update
// ═══════════════════════════════════════════════════════════════

export interface AdminListPartnersResult {
  items: PartnerDocument[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export const adminListPartnersService = async (
  query: AdminListPartnersQuery,
): Promise<ApiResponse<AdminListPartnersResult>> => {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))

  const filter: FilterQuery<IPartner> = {}
  if (query.status) filter.status = query.status
  const q = query.q?.trim()
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: rx }, { email: rx }, { socialHandle: rx }]
  }

  const [items, total] = await Promise.all([
    Partner.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize) as unknown as Promise<PartnerDocument[]>,
    Partner.countDocuments(filter),
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

export const adminGetPartnerService = async (
  id: string,
): Promise<ApiResponse<{ partner: PartnerDocument }>> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Partner not found.')
  const partner = (await Partner.findById(id)) as PartnerDocument | null
  if (!partner) throw new ApiError(404, 'Partner not found.')
  return new ApiResponse(200, 'OK.', { partner })
}

export const adminApprovePartnerService = async (
  id: string,
  input: AdminApprovePartnerInput,
  actorUserId: string | null,
): Promise<ApiResponse<{ partner: PartnerDocument }>> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Partner not found.')
  const partner = (await Partner.findById(id).select(
    '+onboardingTokenHash +onboardingTokenExpiresAt',
  )) as PartnerDocument | null
  if (!partner) throw new ApiError(404, 'Partner not found.')
  if (partner.status === 'active') {
    throw new ApiError(409, 'Partner is already active.')
  }
  if (partner.status === 'rejected') {
    throw new ApiError(409, 'Partner was rejected. Re-applying is required.')
  }

  // Reuse an existing user with this email if one is already on the
  // platform — common case is a customer who applies to be a partner.
  // Promote their role to 'partner'. Otherwise create a fresh user
  // with no password set (the onboarding flow installs one).
  let user = await User.findOne({ email: partner.email })
  if (!user) {
    user = await User.create({
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      passwordHash: crypto.randomBytes(32).toString('hex'), // placeholder, overwritten at onboarding
      role: 'partner',
      emailVerified: false,
    })
  } else if (user.role === 'customer') {
    user.role = 'partner'
    await user.save()
  }
  // Other roles (admin, b2b_*) we leave alone to avoid privilege
  // mixing. The partner can still receive commissions but they sign
  // in with their existing credentials and won't see the onboarding
  // password step.

  // Mint a single-use onboarding token.
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expires = new Date(Date.now() + ONBOARDING_TTL_MS)

  partner.userId = user._id
  partner.status = 'approved'
  partner.approvedAt = new Date()
  partner.approvedBy = actorUserId ? new Types.ObjectId(actorUserId) : null
  partner.rejectionReason = ''
  partner.onboardingTokenHash = tokenHash
  partner.onboardingTokenExpiresAt = expires
  if (typeof input.commissionRate === 'number') {
    partner.commissionRate = input.commissionRate
  }
  await partner.save()

  const onboardingUrl = `${process.env.FRONTEND_PLATFORM_URL}/partner/onboarding?token=${token}`

  // Send the approval email. We swallow failures so admins don't
  // see a partner stuck in a weird half-approved state if SMTP hiccups
  // — the link can always be resent from the admin tool later.
  try {
    await sendMail({
      to: partner.email,
      subject: 'Welcome to the Mensa partner programme',
      template: 'partnerApproved',
      data: {
        name: partner.name,
        commissionRate: partner.commissionRate,
        onboardingUrl,
        expiresInDays: 7,
      },
    })
  } catch (err) {
    logger.warn(
      `Partner approval email failed for ${partner.email}: ${(err as Error).message}`,
    )
  }

  return new ApiResponse(200, 'Partner approved. Onboarding email sent.', { partner })
}

export const adminRejectPartnerService = async (
  id: string,
  input: AdminRejectPartnerInput,
): Promise<ApiResponse<{ partner: PartnerDocument }>> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Partner not found.')
  const partner = (await Partner.findById(id)) as PartnerDocument | null
  if (!partner) throw new ApiError(404, 'Partner not found.')
  if (partner.status === 'active') {
    throw new ApiError(409, 'Active partners cannot be rejected. Suspend instead.')
  }

  partner.status = 'rejected'
  partner.rejectionReason = input.rejectionReason?.trim() ?? ''
  partner.onboardingTokenHash = null
  partner.onboardingTokenExpiresAt = null
  await partner.save()

  return new ApiResponse(200, 'Partner application declined.', { partner })
}

export const adminUpdatePartnerService = async (
  id: string,
  input: AdminUpdatePartnerInput,
): Promise<ApiResponse<{ partner: PartnerDocument }>> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Partner not found.')
  const partner = (await Partner.findById(id)) as PartnerDocument | null
  if (!partner) throw new ApiError(404, 'Partner not found.')

  if (typeof input.commissionRate === 'number') {
    if (input.commissionRate < 0 || input.commissionRate > 100) {
      throw new ApiError(400, 'Commission rate must be between 0 and 100.')
    }
    partner.commissionRate = input.commissionRate
  }
  if (input.status) {
    if (
      (input.status === 'suspended' && partner.status !== 'active') ||
      (input.status === 'active' && partner.status !== 'suspended')
    ) {
      throw new ApiError(409, `Cannot move from ${partner.status} to ${input.status}.`)
    }
    partner.status = input.status
  }

  await partner.save()
  return new ApiResponse(200, 'Partner updated.', { partner })
}

// ═══════════════════════════════════════════════════════════════
//  Admin: payouts
// ═══════════════════════════════════════════════════════════════

export interface AdminPayoutListItem {
  _id: string
  partnerId: string
  partnerName: string
  partnerEmail: string
  amountKobo: number
  status: string
  requestedAt: Date
  processedAt?: Date | null
  paymentReference?: string
  bankAccountSnapshot: IPartnerBankAccount
}

export interface AdminListPayoutsResult {
  items: AdminPayoutListItem[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export const adminListPayoutsService = async (
  query: AdminListPayoutsQuery,
): Promise<ApiResponse<AdminListPayoutsResult>> => {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))

  const filter: FilterQuery<PartnerPayoutRequestDocument> = {}
  if (query.status) filter.status = query.status

  const [rows, total] = await Promise.all([
    PartnerPayoutRequest.find(filter)
      .sort({ requestedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate<{ partnerId: { _id: Types.ObjectId; name: string; email: string } }>(
        'partnerId',
        'name email',
      )
      .lean(),
    PartnerPayoutRequest.countDocuments(filter),
  ])

  const items: AdminPayoutListItem[] = rows.map((r) => {
    const pid = r.partnerId as unknown as
      | { _id: Types.ObjectId; name: string; email: string }
      | null
    return {
      _id: r._id.toString(),
      partnerId: pid?._id.toString() ?? '',
      partnerName: pid?.name ?? '—',
      partnerEmail: pid?.email ?? '—',
      amountKobo: r.amountKobo,
      status: r.status,
      requestedAt: r.requestedAt,
      processedAt: r.processedAt ?? null,
      paymentReference: r.paymentReference,
      bankAccountSnapshot: r.bankAccountSnapshot,
    }
  })

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

export const adminMarkPayoutPaidService = async (
  payoutId: string,
  input: AdminMarkPayoutPaidInput,
  actorUserId: string | null,
): Promise<ApiResponse<{ payoutRequest: PartnerPayoutRequestDocument }>> => {
  if (!Types.ObjectId.isValid(payoutId)) {
    throw new ApiError(404, 'Payout request not found.')
  }
  const payout = (await PartnerPayoutRequest.findById(
    payoutId,
  )) as PartnerPayoutRequestDocument | null
  if (!payout) throw new ApiError(404, 'Payout request not found.')
  if (payout.status !== 'pending') {
    throw new ApiError(409, `Payout is already ${payout.status}.`)
  }
  if (!input.paymentReference?.trim()) {
    throw new ApiError(400, 'Payment reference is required.')
  }

  payout.status = 'paid'
  payout.processedAt = new Date()
  payout.processedBy = actorUserId ? new Types.ObjectId(actorUserId) : null
  payout.paymentReference = input.paymentReference.trim()
  payout.adminNote = input.adminNote?.trim() ?? ''
  await payout.save()

  // Flip every commission attached to this payout to 'paid' and
  // bump the partner's lifetimePaid counter by the payout amount.
  await PartnerCommission.updateMany(
    { payoutRequestId: payout._id, status: 'available' },
    { $set: { status: 'paid' } },
  )
  await Partner.updateOne(
    { _id: payout.partnerId },
    { $inc: { lifetimePaidKobo: payout.amountKobo } },
  )

  // Best-effort confirmation email so the partner has a receipt with
  // the bank reference. Failure is logged but doesn't roll back the
  // ledger update — the bank transfer already went out.
  try {
    const partner = (await Partner.findById(payout.partnerId)) as PartnerDocument | null
    if (partner?.email) {
      const acct = payout.bankAccountSnapshot.accountNumber
      const masked =
        acct.length > 4 ? `${'•'.repeat(Math.max(0, acct.length - 4))}${acct.slice(-4)}` : acct
      await sendMail({
        to: partner.email,
        subject: `Your Mensa payout has been sent`,
        template: 'payoutPaid',
        data: {
          name: partner.name,
          amountFormatted: formatNairaFromKobo(payout.amountKobo),
          accountName: payout.bankAccountSnapshot.accountName,
          bankName: payout.bankAccountSnapshot.bankName,
          maskedAccountNumber: masked,
          paymentReference: payout.paymentReference,
          dashboardUrl: `${process.env.FRONTEND_PLATFORM_URL}/partner`,
        },
      })
    }
  } catch (err) {
    logger.warn(
      `Payout-paid email failed for payout=${payout._id}: ${(err as Error).message}`,
    )
  }

  return new ApiResponse(200, 'Payout marked as paid.', { payoutRequest: payout })
}

const formatNairaFromKobo = (kobo: number): string =>
  `₦${(kobo / 100).toLocaleString('en-NG')}`

export const adminRejectPayoutService = async (
  payoutId: string,
  input: AdminRejectPayoutInput,
  actorUserId: string | null,
): Promise<ApiResponse<{ payoutRequest: PartnerPayoutRequestDocument }>> => {
  if (!Types.ObjectId.isValid(payoutId)) {
    throw new ApiError(404, 'Payout request not found.')
  }
  const payout = (await PartnerPayoutRequest.findById(
    payoutId,
  )) as PartnerPayoutRequestDocument | null
  if (!payout) throw new ApiError(404, 'Payout request not found.')
  if (payout.status !== 'pending') {
    throw new ApiError(409, `Payout is already ${payout.status}.`)
  }

  payout.status = 'rejected'
  payout.processedAt = new Date()
  payout.processedBy = actorUserId ? new Types.ObjectId(actorUserId) : null
  payout.adminNote = input.adminNote?.trim() ?? ''
  await payout.save()

  // Detach commissions back to 'available' so they can be re-requested.
  await PartnerCommission.updateMany(
    { payoutRequestId: payout._id, status: 'available' },
    { $set: { payoutRequestId: null } },
  )
  // Restore available balance so the partner can re-request.
  await Partner.updateOne(
    { _id: payout.partnerId },
    { $inc: { availableBalanceKobo: payout.amountKobo } },
  )

  return new ApiResponse(200, 'Payout request rejected.', { payoutRequest: payout })
}

// ═══════════════════════════════════════════════════════════════
//  Commission lifecycle (called from order.service)
// ═══════════════════════════════════════════════════════════════

/** Look up an active partner by referral code. Returns null on any
 *  miss so callers can ignore quietly (we never break checkout because
 *  a stale ref is dangling). */
export const resolveActivePartnerByCode = async (
  referralCode: string,
): Promise<PartnerDocument | null> => {
  const code = referralCode.trim().toUpperCase()
  if (!code) return null
  const partner = (await Partner.findOne({
    referralCode: code,
    status: 'active',
  })) as PartnerDocument | null
  return partner
}

/** Order moved to paid — create a 'pending' commission and bump
 *  the partner's pending balance. Idempotent: if a commission for
 *  this (partner, order) already exists, do nothing. */
export const accrueCommissionOnOrderPaid = async (
  order: OrderDocument,
): Promise<void> => {
  if (!order.referralCode) return
  const partner = await resolveActivePartnerByCode(order.referralCode)
  if (!partner) return

  const existing = await PartnerCommission.findOne({
    partnerId: partner._id,
    orderId: order._id,
  })
  if (existing) return

  const subtotal = order.totals.subtotal
  const amountKobo = Math.round((subtotal * partner.commissionRate) / 100)
  if (amountKobo <= 0) return

  await PartnerCommission.create({
    partnerId: partner._id,
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderSubtotalKobo: subtotal,
    commissionRateAtTime: partner.commissionRate,
    amountKobo,
    status: 'pending',
  })
  await Partner.updateOne(
    { _id: partner._id },
    {
      $inc: {
        pendingBalanceKobo: amountKobo,
        lifetimeEarnedKobo: amountKobo,
      },
    },
  )
  logger.info(
    `Partner commission accrued: partner=${partner._id} order=${order.orderNumber} amount=${amountKobo} (pending)`,
  )
}

/** Order moved to delivered — flip its pending commission to available
 *  so it counts towards the cashable balance. */
export const markCommissionAvailableForOrder = async (
  order: OrderDocument,
): Promise<void> => {
  const commission = (await PartnerCommission.findOne({
    orderId: order._id,
    status: 'pending',
  })) as PartnerCommissionDocument | null
  if (!commission) return

  commission.status = 'available'
  commission.availableAt = new Date()
  await commission.save()

  await Partner.updateOne(
    { _id: commission.partnerId },
    {
      $inc: {
        pendingBalanceKobo: -commission.amountKobo,
        availableBalanceKobo: commission.amountKobo,
      },
    },
  )
  logger.info(
    `Partner commission available: partner=${commission.partnerId} order=${order.orderNumber} amount=${commission.amountKobo}`,
  )
}

/** Order cancelled / refunded — reverse the commission, regardless of
 *  what bucket it sat in:
 *
 *   - pending   -> subtract from pendingBalanceKobo
 *   - available -> subtract from availableBalanceKobo
 *   - paid      -> we already paid the partner. Subtract from
 *                  availableBalanceKobo too, which goes NEGATIVE.
 *                  Future earnings net against this deficit before
 *                  the partner can cash out again. This is the
 *                  automatic claw-back.
 *
 *  In every case lifetimeEarnedKobo decrements to reflect that the
 *  commission was never legitimately earned. lifetimePaidKobo is
 *  historical and never modified — money out the door stays out the
 *  door for accounting purposes.
 *
 *  Already-reversed commissions are skipped (idempotent). */
export const reverseCommissionForOrder = async (
  order: OrderDocument,
  reason: string,
): Promise<void> => {
  const commission = (await PartnerCommission.findOne({
    orderId: order._id,
    status: { $in: ['pending', 'available', 'paid'] },
  })) as PartnerCommissionDocument | null
  if (!commission) return

  const previousStatus = commission.status
  commission.status = 'reversed'
  commission.reversedAt = new Date()
  commission.reversedReason = reason
  await commission.save()

  // Pending lives in pendingBalanceKobo; both 'available' and 'paid'
  // dock against availableBalanceKobo (which is allowed to go negative
  // — see model comment).
  const balanceField =
    previousStatus === 'pending' ? 'pendingBalanceKobo' : 'availableBalanceKobo'
  await Partner.updateOne(
    { _id: commission.partnerId },
    {
      $inc: {
        [balanceField]: -commission.amountKobo,
        lifetimeEarnedKobo: -commission.amountKobo,
      },
    },
  )
  logger.info(
    `Partner commission reversed: partner=${commission.partnerId} order=${order.orderNumber} amount=${commission.amountKobo} previousStatus=${previousStatus}${
      previousStatus === 'paid' ? ' (claw-back applied to available balance)' : ''
    }`,
  )
}
