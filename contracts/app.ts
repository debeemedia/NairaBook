export type TwilioIncomingPayload = {
  // Required fields common to text and media payloads
  AccountSid: string
  ApiVersion: string
  Body: string | null // Can be a string ('Hello') or null for media messages
  ChannelMetadata: string
  ExternalUserId: string
  From: string // e.g. 'whatsapp:+2348109210257',
  MessageSid: string
  MessageType: 'text' | 'audio' | string
  NumMedia: string // e.g. '0' or '1'
  NumSegments: string
  ProfileName: string // Be aware that this can contain emojis
  ReferralNumMedia: string
  SmsMessageSid: string
  SmsSid: string
  SmsStatus: 'received' | string
  To: string // e.g. 'whatsapp:+14155238886',
  WaId: string // e.g '2348109210257'

  // Optional fields specific to media payloads
  MediaContentType0?: string // e.g., 'audio/ogg'
  MediaUrl0?: string // e.g., URL string
}

export type BusinessMetricsStructure = {
  intent: 'transaction' | 'inventory' | 'unknown'
  type: 'sale' | 'debt' | 'repayment' | 'expense' | 'restock' | 'unknown'
  customerName: string | null
  itemName: string | null
  quantity: number | null
  amount: string
}
