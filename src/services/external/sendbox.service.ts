import { sendboxClient } from '../../config/sendbox'

export interface SendboxRate {
  serviceId: string
  provider: string
  name: string
  feeKobo: number
  etaMin: number
  etaMax: number
}

export interface SendboxShipmentResult {
  trackingNumber: string
  waybillUrl?: string
}

export const sendboxService = {
  async getRates(origin: string, destination: string, weightKg: number): Promise<SendboxRate[]> {
    const { data } = await sendboxClient.post('/shipping/shipment_delivery_quote', {
      origin_state: 'FCT',
      origin_city: 'Abuja',
      destination_state: destination,
      weight: weightKg,
    })
    // Normalise Sendbox response shape to our internal type
    return (data.data ?? []).map((r: Record<string, unknown>) => ({
      serviceId: r.service_code as string,
      provider: r.operator_name as string,
      name: r.service_name as string,
      feeKobo: Math.round((r.total as number) * 100),
      etaMin: (r.min_delivery_time as number) ?? 2,
      etaMax: (r.max_delivery_time as number) ?? 5,
    }))
  },

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
    const { data } = await sendboxClient.post('/shipping/shipments', {
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
}
