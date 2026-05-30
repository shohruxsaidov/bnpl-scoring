export type DealStatus = 'active' | 'closed' | 'overdue' | 'approved' | 'declined'

export interface AuthUser {
  id: string
  phone: string
  firstName: string
  lastName: string
  birthDate: string
  gender: string
  nationality: string
  passportSerial: string | null
  passportNumber: string | null
  photoUrl: string | null
}

export interface ScheduleEntry {
  no: number
  dueDate: string
  amount: number
  paid: boolean
  paidAt: string | null
}

export interface Deal {
  id: string
  merchant: string
  amount: number
  totalPayable: number
  status: DealStatus
  tariffLabel: string
  termMonths: number
  markupPercent: number
  paymentsMade: number
  paymentsTotal: number
  nextPaymentDate: string | null
  nextPaymentAmount: number
  schedule: ScheduleEntry[]
  createdAt: string
}

export type NotificationKind = 'overdue' | 'payment' | 'deal' | 'message'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  createdAt: string
  read: boolean
}
