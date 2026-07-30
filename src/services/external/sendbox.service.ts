// Sendbox service — real API when SENDBOX_API_KEY is set, otherwise stubbed rates (in house rider ₦2,500 for FCT / Lagos, nationwide ₦5,000) so checkout works locally.
// Stub shipments log a warning so it's clear the real provider isn't being hit.
import axios from 'axios'
import { logger } from '../../config/logger'

const BASE_URL = 'https://api.sendbox.co'

const IN_HOUSE_STATES = new Set(['FCT', 'Abuja', 'Lagos'])

function isConfigured(): boolean {
  return !!process.env.SENDBOX_API_KEY
}

function client() {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${process.env.SENDBOX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 15_000,
  })
}

// ── Public types ─────────────────────────────────────────────────────

export interface SendboxRate {
  /** Internal id for the option. For real Sendbox responses this is the
   *  service_code; for stub rates it's a synthetic id. */
  serviceId: string
  provider: string
  name: string
  /** Cost in kobo. */
  feeKobo: number
  etaMin: number
  etaMax: number
}

export interface SendboxShipmentResult {
  trackingNumber: string
  waybillUrl?: string
}

interface RateLookup {
  destinationState: string
  destinationCity: string
  weightKg: number
}

// ── Service ─────────────────────────────────────────────────────────

export const sendboxService = {
  /** Fetch shipping options for a destination and weight, the in house FCT / Lagos rider option always precedes the Sendbox nationwide ones. */
  async getRates(input: RateLookup): Promise<SendboxRate[]> {
    const inHouseOption: SendboxRate | null = IN_HOUSE_STATES.has(
      input.destinationState,
    )
      ? {
          serviceId: 'inhouse-rider',
          provider: 'Mensa rider',
          name: 'In-house delivery',
          feeKobo: 2_500 * 100,
          etaMin: 1,
          etaMax: 2,
        }
      : null

    if (!isConfigured()) {
      // Stub: one nationwide option so dev orders still get a Sendbox-like
      // alternative.
      const stub: SendboxRate = {
        serviceId: 'nationwide-stub',
        provider: 'Sendbox',
        name: 'Nationwide delivery',
        feeKobo: 5_000 * 100,
        etaMin: 2,
        etaMax: 5,
      }
      return inHouseOption ? [inHouseOption, stub] : [stub]
    }

    const { data } = await client().post('/shipping/shipment_delivery_quote', {
      origin_state: 'FCT',
      origin_city: 'Abuja',
      destination_state: input.destinationState,
      destination_city: input.destinationCity,
      weight: input.weightKg,
    })
    const rates: SendboxRate[] = (data.data ?? []).map((r: Record<string, unknown>) => ({
      serviceId: r.service_code as string,
      provider: (r.operator_name as string) ?? 'Sendbox',
      name: (r.service_name as string) ?? 'Nationwide delivery',
      feeKobo: Math.round((r.total as number) * 100),
      etaMin: (r.min_delivery_time as number) ?? 2,
      etaMax: (r.max_delivery_time as number) ?? 5,
    }))

    return inHouseOption ? [inHouseOption, ...rates] : rates
  },

  /** Create a shipment for a paid order. Stub mode returns a synthetic STUB prefixed tracking code, real shipments fire only with the API key configured. */
  async createShipment(orderData: {
    reference: string
    serviceId: string
    recipientName: string
    recipientPhone: string
    recipientAddress: string
    recipientState: string
    recipientCity: string
    weightKg: number
  }): Promise<SendboxShipmentResult> {
    if (!isConfigured()) {
      logger.warn(
        `[Sendbox] Stub shipment for ${orderData.reference}. Set SENDBOX_API_KEY for a real waybill.`,
      )
      return { trackingNumber: `STUB-${orderData.reference}` }
    }

    const { data } = await client().post('/shipping/shipments', {
      service_code: orderData.serviceId,
      recipient: {
        name: orderData.recipientName,
        phone: orderData.recipientPhone,
        address: orderData.recipientAddress,
        state: orderData.recipientState,
        city: orderData.recipientCity,
      },
      parcel: { weight: orderData.weightKg },
      reference: orderData.reference,
    })
    return {
      trackingNumber: data.data.tracking_number as string,
      waybillUrl: data.data.waybill_url as string | undefined,
    }
  },

  /** Public tracking URL for a Sendbox tracking code. */
  trackingUrl(trackingNumber: string): string {
    return `https://sendbox.co/track/${encodeURIComponent(trackingNumber)}`
  },
}
