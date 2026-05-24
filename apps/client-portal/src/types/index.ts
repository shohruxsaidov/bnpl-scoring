export type DealStatus = 'active' | 'closed' | 'overdue'

export type PaymentProvider = 'Payme' | 'Click'

export type ScheduleStatus = 'paid' | 'upcoming' | 'overdue'

export interface Client {
  id: string
  fullName: string
  phone: string
  pinfl: string
  passportSerial: string
}

/** Authenticated user as returned by the client auth API. */
export interface AuthUser {
  id: string
  phone: string
  fullName: string
}

export interface LinkedCard {
  id: string
  brand: string
  pan: string
}

export interface ScheduleEntry {
  /** 1-based instalment number */
  no: number
  /** ISO date of the due date */
  dueDate: string
  /** amount due in tiyin */
  amount: number
  status: ScheduleStatus
  /** provider used if paid */
  paidVia?: PaymentProvider
}

export interface PaymentRecord {
  id: string
  /** ISO date of the payment */
  date: string
  /** amount in tiyin */
  amount: number
  provider: PaymentProvider
  txnId: string
}

export interface Contract {
  number: string
  signed: boolean
  /** ISO date the kontrakt was signed */
  signedAt: string
  myIdVerified: boolean
}

export interface Deal {
  id: string
  merchant: string
  /** total credit amount in tiyin */
  amount: number
  status: DealStatus
  tariffLabel: string
  termMonths: number
  markupPercent: number
  paymentsMade: number
  paymentsTotal: number
  /** ISO date of the next payment due (null when closed) */
  nextPaymentDate: string | null
  /** next payment amount in tiyin (0 when closed) */
  nextPaymentAmount: number
  /** ISO date the deal became overdue, when applicable */
  overdueSince?: string
  schedule: ScheduleEntry[]
  payments: PaymentRecord[]
  contract: Contract
}

export type NotificationKind = 'overdue' | 'payment' | 'deal'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  /** ISO timestamp */
  createdAt: string
  read: boolean
}
