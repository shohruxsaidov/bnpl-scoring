// ---------------------------------------------------------------------------
// Domain types — Platform Admin (Credit Scoring & POS Lending Platform)
// ---------------------------------------------------------------------------

export interface PlatformAdmin {
  id: string
  fullName: string
  email: string
}

export type TenantStatus = 'active' | 'suspended'

export interface Tenant {
  id: string
  name: string
  slug: string
  status: TenantStatus
  contactEmail: string
  dealCount: number
  employeeCount: number
  /** lifetime disbursed volume, tiyin */
  volume: number
  /** count of currently overdue deals */
  overdueCount: number
  createdAt: string
}

export type EmployeeRole = 'agent' | 'merchant_admin'

export interface Employee {
  id: string
  fullName: string
  email: string
  phone: string
  roles: EmployeeRole[]
  active: boolean
  tenantId: string
  lastLogin: string | null
}

export type DealStatus = 'active' | 'overdue' | 'closed' | 'declined' | 'scoring'

export type ScoreDecision = 'approved' | 'declined' | 'partial' | 'manual_review'

export interface BasketLine {
  name: string
  quantity: number
  /** unit price, tiyin */
  price: number
}

export interface ScheduleRow {
  index: number
  /** ISO date string */
  date: string
  /** tiyin */
  amount: number
}

export interface ScoreFactor {
  label: string
  /** raw weight contribution, 0..1 */
  weight: number
  /** human readable observed value */
  value: string
}

export interface Deal {
  id: string
  tenantId: string
  clientName: string
  clientPinfl: string
  status: DealStatus
  /** principal, tiyin */
  amount: number
  /** total payable incl. markup, tiyin */
  totalPayable: number
  score: number
  decision: ScoreDecision
  agentId: string
  agentName: string
  tariffName: string
  termMonths: number
  clientPhone: string
  basket: BasketLine[]
  schedule: ScheduleRow[]
  factors: ScoreFactor[]
  createdAt: string
}

export interface Tariff {
  id: string
  name: string
  termMonths: number
  markupPercent: number
  /** tiyin */
  creditMin: number
  creditMax: number
  active: boolean
}

export interface ScoringModel {
  version: string
  updatedAt: string
  hardDenyThreshold: number
  partialLimitThreshold: number
  criteria: Record<string, number>
  rules: string[]
}

export type IntegrationHealth = 'operational' | 'degraded' | 'down'

export interface IntegrationStatus {
  key: string
  label: string
  health: IntegrationHealth
  detail: string
}

export interface PlatformConfigItem {
  key: string
  label: string
  value: string | number
  unit?: string
  /** when true the inline editor uses a number input */
  numeric: boolean
}

export interface IntegrationEndpoint {
  label: string
  value: string
  masked: boolean
}
