// shipping.service.ts — admin defined delivery options. One settings
// singleton drives BOTH the public rates quote and the checkout price
// verification through quoteShippingOptions, so the two can never drift.
// Until the admin saves once, built in defaults mirror the old hardcoded
// behaviour (in house rider for FCT / Abuja / Lagos, flat nationwide rate).

import { Types } from 'mongoose'

import { ShippingSettings } from '../models/ShippingSettings'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import type {
  AdminShippingSettingsResult,
  IShippingOption,
  QuotedShippingOption,
  UpdateShippingSettingsInput,
} from '../interfaces/shipping.interface'

const DEFAULT_OPTIONS: IShippingOption[] = [
  {
    id: 'default-inhouse',
    name: 'In-house delivery',
    feeKobo: 2_500 * 100,
    etaMinDays: 1,
    etaMaxDays: 2,
    coverage: 'states',
    states: ['FCT', 'Abuja', 'Lagos'],
    enabled: true,
    sortOrder: 0,
  },
  {
    id: 'default-nationwide',
    name: 'Nationwide delivery',
    feeKobo: 5_000 * 100,
    etaMinDays: 2,
    etaMaxDays: 5,
    coverage: 'all',
    states: [],
    enabled: true,
    sortOrder: 1,
  },
]

interface LoadedSettings {
  freeDeliveryThresholdKobo: number | null
  options: IShippingOption[]
  isDefault: boolean
}

async function loadShippingSettings(): Promise<LoadedSettings> {
  const doc = await ShippingSettings.findOne({ key: 'shipping' })
  if (!doc) {
    return { freeDeliveryThresholdKobo: null, options: DEFAULT_OPTIONS, isDefault: true }
  }
  return {
    freeDeliveryThresholdKobo: doc.freeDeliveryThresholdKobo ?? null,
    options: doc.options,
    isDefault: false,
  }
}

/** Human ETA string in the format checkout has always shown. */
export function formatEtaDays(min: number, max: number): string {
  if (min === max) return `${min} ${min === 1 ? 'day' : 'days'}`
  return `${min} to ${max} days`
}

// ─── Quote: the single source both checkout paths use ───────────
export const quoteShippingOptions = async (input: {
  state: string
  subtotalKobo: number
}): Promise<QuotedShippingOption[]> => {
  const settings = await loadShippingSettings()
  const threshold = settings.freeDeliveryThresholdKobo
  const free = threshold != null && threshold > 0 && input.subtotalKobo >= threshold

  return settings.options
    .filter((o) => o.enabled)
    .filter((o) => o.coverage === 'all' || o.states.includes(input.state))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => ({
      id: o.id,
      name: o.name,
      etaMinDays: o.etaMinDays,
      etaMaxDays: o.etaMaxDays,
      feeKobo: free ? 0 : o.feeKobo,
    }))
}

// ─── Admin: read ────────────────────────────────────────────────
export const getShippingSettingsService = async (): Promise<
  ApiResponse<AdminShippingSettingsResult>
> => {
  const settings = await loadShippingSettings()
  return new ApiResponse(200, 'OK.', {
    freeDeliveryThresholdKobo: settings.freeDeliveryThresholdKobo,
    options: settings.options,
    isDefault: settings.isDefault,
  })
}

// ─── Admin: update (whole document, atomic) ─────────────────────
export const updateShippingSettingsService = async (
  input: UpdateShippingSettingsInput,
): Promise<ApiResponse<AdminShippingSettingsResult>> => {
  if (!input.options.some((o) => o.enabled)) {
    throw new ApiError(422, 'At least one delivery option must be enabled.')
  }

  // Keep incoming ids so a customer mid checkout still verifies after an
  // unrelated edit; only brand new options get fresh ids.
  const options: IShippingOption[] = input.options.map((o, index) => ({
    id: o.id?.trim() || new Types.ObjectId().toString(),
    name: o.name.trim(),
    feeKobo: o.feeKobo,
    etaMinDays: o.etaMinDays,
    etaMaxDays: o.etaMaxDays,
    coverage: o.coverage,
    states: o.coverage === 'states' ? o.states : [],
    enabled: o.enabled,
    sortOrder: index,
  }))

  const seen = new Set<string>()
  for (const o of options) {
    if (seen.has(o.id)) throw new ApiError(422, 'Duplicate delivery option id.')
    seen.add(o.id)
  }

  await ShippingSettings.findOneAndUpdate(
    { key: 'shipping' },
    {
      $set: {
        freeDeliveryThresholdKobo: input.freeDeliveryThresholdKobo,
        options,
      },
    },
    { upsert: true, new: true },
  )

  return new ApiResponse(200, 'Shipping settings saved.', {
    freeDeliveryThresholdKobo: input.freeDeliveryThresholdKobo,
    options,
    isDefault: false,
  })
}
