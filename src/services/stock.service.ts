// stock.service.ts — atomic variant stock reservation shared by anything
// that holds catalogue stock outside the checkout flow (invoices today).
// Mirrors the reserve / restore pattern in order.service without touching it.

import type { Types } from 'mongoose'

import { Product } from '../models/Product'
import { ApiError } from '../errors/apiError'

export interface StockItem {
  productId: Types.ObjectId
  variantId: Types.ObjectId
  qty: number
}

/** Decrement stock for every item, all or nothing. A failed line rolls the
 *  earlier ones back and surfaces a 409 naming the product. */
export async function reserveVariantStock(items: StockItem[]): Promise<void> {
  const reserved: StockItem[] = []
  for (const item of items) {
    const result = await Product.updateOne(
      {
        _id: item.productId,
        'variants._id': item.variantId,
        'variants.stockCount': { $gte: item.qty },
      },
      { $inc: { 'variants.$.stockCount': -item.qty } },
    )
    if (result.modifiedCount === 0) {
      await restoreVariantStock(reserved)
      const product = await Product.findById(item.productId).select('name').lean()
      throw new ApiError(
        409,
        `Not enough stock for "${product?.name ?? 'an item'}". Reduce the quantity or remove the line.`,
      )
    }
    reserved.push(item)
  }
}

/** Inverse of reserveVariantStock. */
export async function restoreVariantStock(items: StockItem[]): Promise<void> {
  for (const item of items) {
    await Product.updateOne(
      { _id: item.productId, 'variants._id': item.variantId },
      { $inc: { 'variants.$.stockCount': item.qty } },
    )
  }
}
