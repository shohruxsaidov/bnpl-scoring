// ---------------------------------------------------------------------------
// Domain types — Credit Scoring & POS Lending Platform
// ---------------------------------------------------------------------------

export type EmployeeRole = 'agent' | 'branch_admin' | 'merchant_admin'

export interface Tenant {
  id: string
  name: string
}

export interface Employee {
  id: string
  fullName: string
  email: string
  phone: string
  roles: EmployeeRole[]
  active: boolean
  tenantId: string
}

export type DealStatus =
  | 'draft'
  | 'scoring'
  | 'approved'
  | 'declined'
  | 'active'
  | 'closed'
  | 'overdue'

export type ScoreDecision = 'approved' | 'declined' | 'manual_review'

export interface Client {
  pinfl: string
  fullName: string
  phone: string
  passportSerial: string
  birthDate?: string
}

export interface Card {
  id: string
  maskedPan: string
  holderName: string
  expiry: string
  bank: string
}

export interface Tariff {
  id: string
  name: string
  termMonths: number
  /** Ustama — markup percent */
  markupPercent: number
  /** Stored in tiyin (1/100 som) */
  creditMin: number
  creditMax: number
  active: boolean
}

export interface Category {
  id: string
  name: string
}

export interface Product {
  id: string
  name: string
  sku: string
  /** Stored in tiyin (1/100 som) */
  price: number
  categoryId: string
}

export interface BasketItem {
  product: Product
  quantity: number
}

export interface ScheduleRow {
  index: number
  /** ISO date string */
  date: string
  /** tiyin */
  amount: number
}

export interface Deal {
  id: string
  clientName: string
  clientPinfl: string
  clientPhone: string
  status: DealStatus
  tariffId: string
  tariffName: string
  termMonths: number
  /** merchant base price in tiyin (Цена мерчанта) */
  amount: number
  /** total payable incl. Ustama, tiyin (Стоимость сделки) */
  totalPayable: number
  score: number
  decision: ScoreDecision
  agentId: string
  createdAt: string
  paymentDay: number
  basket: BasketItem[]
}

export interface CardScoreResult {
  score: number
  decision: ScoreDecision
  limit: number
}
