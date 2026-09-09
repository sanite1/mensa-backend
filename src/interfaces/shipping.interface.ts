import type { Document, Types } from 'mongoose'

/** One delivery option the admin defines. The customer sees `name` at
 *  checkout when their state is covered. */
export interface IShippingOption {
  /** Stable string id. Survives edits so a mid checkout selection still
   *  verifies. Defaults use synthetic ids before the first save. */
  id: string
  name: string
  /** Cost in kobo. */
  feeKobo: number
  etaMinDays: number
  etaMaxDays: number
  /** 'all' covers every state, 'states' only the ones listed. */
  coverage: 'all' | 'states'
  states: string[]
  enabled: boolean
  sortOrder: number
}

/** Singleton settings document (key is always 'shipping'). */
export interface IShippingSettings {
  key: 'shipping'
  /** Orders with subtotal at or above this deliver free. Null disables it. */
  freeDeliveryThresholdKobo: number | null
  options: IShippingOption[]
  createdAt: Date
  updatedAt: Date
}

export type ShippingSettingsDocument = Document<Types.ObjectId, unknown, IShippingSettings> &
  IShippingSettings

// ── DTOs ─────────────────────────────────────────────────────────

export interface UpdateShippingSettingsInput {
  freeDeliveryThresholdKobo: number | null
  options: Array<Omit<IShippingOption, 'id'> & { id?: string }>
}

export interface AdminShippingSettingsResult {
  freeDeliveryThresholdKobo: number | null
  options: IShippingOption[]
  /** True while no settings document exists yet and the built in defaults
   *  are serving checkout. */
  isDefault: boolean
}

/** A delivery option priced for one destination + cart. */
export interface QuotedShippingOption {
  id: string
  name: string
  etaMinDays: number
  etaMaxDays: number
  feeKobo: number
}
