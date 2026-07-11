// ---------------------------------------------------------------------------
// Domain types — Platform Admin (Credit Scoring & POS Lending Platform)
// ---------------------------------------------------------------------------

export interface PlatformAdmin {
  id: string
  fullName: string
  email: string
  roleId: string | null
  roleKey: string | null
  roleName: string | null
  isSuperadmin: boolean
  mustChangePassword: boolean
  permissions: string[]
}

export interface AdminUser {
  id: string
  email: string
  fullName: string
  roleId: string | null
  roleName: string | null
  roleKey: string | null
  isSuperadmin: boolean
  active: boolean
  createdAt: string
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

export interface Client {
  id: string
  pinfl: string
  phone: string
  fullName: string
  middleName: string | null
  birthDate: string
  createdAt: string
}

export interface ClientOverview extends Client {
  // Whole som as a string, e.g. '1000000'.
  creditLimit: string | null
  availableBalance: number | null
  creditLimitScoredAt: string | null
}

export interface ClientDeal {
  id: string
  dealNumber: string
  merchantName: string
  branchName: string
  status: string
  amount: number
  totalPayable: number
  tariffName: string
  termMonths: number
  createdAt: string
}

export interface ClientScoringEntry {
  id: string
  source: 'wizard' | 'self-service'
  decision: string
  score: number
  limit: number
  scoredAt: string
}

export interface ClientPaymentRow {
  id: string
  dealId: string
  dealNumber: string
  merchantName: string
  dueDate: string
  amount: number
  paidAmount: number
  status: 'paid' | 'partial' | 'unpaid'
  channel: 'manual' | 'automated'
}

export type ClientNotificationType =
  | 'scoring_approved'
  | 'scoring_rejected'
  | 'limit_updated'
  | 'custom'

export interface ClientNotificationRow {
  id: string
  type: ClientNotificationType
  /** Set only for admin-authored (`custom`) rows; system rows render from `type`. */
  titleRu: string | null
  bodyRu: string | null
  /** Authoring admin's name; null for system-generated notifications. */
  sentByName: string | null
  readAt: string | null
  createdAt: string
}

export interface SendPushInput {
  titleRu: string
  titleUz: string
  bodyRu: string
  bodyUz: string
  idempotencyKey: string
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
  dealNumber: string
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
  /** Credit Range bounds in tiyin; null = unbounded */
  minAmount: number | null
  maxAmount: number | null
  active: boolean
  selected?: boolean
}

export interface TariffMerchant {
  id: string
  name: string
  legalName: string
  inn: string
  active: boolean
  addedAt: string
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

// ---------------------------------------------------------------------------
// Merchant domain (API-backed) — admin CRUD
// ---------------------------------------------------------------------------

export interface Merchant {
  id: string
  name: string
  legalName: string
  inn: string
  phone: string
  address: string
  logoUrl: string | null
  contractNumber: string | null
  mfo: string | null
  accountNumber: string | null
  bankName: string | null
  regionId: number | null
  scoringModelId: number | null
  active: boolean
  createdAt: string
}

export interface BankEntry {
  mfo: string
  bankName: string
}

// Singleton: Finsum Nasiya's own legal requisites (the platform operator).
export interface Organization {
  name: string
  legalName: string
  directorName: string | null
  address: string
  phone: string
  inn: string
  mfo: string
  accountNumber: string
  bankName: string
  updatedAt: string
}

export type ConfigurablePipeline = 'myid' | 'katm_mib' | 'katm_077' | 'katm_inps' | 'plum_card'

// The global ops kill-switch for one scoring pipeline. `isDefault` means no row
// has ever been stored — `enabled` is the catalog default, not an admin choice.
export interface PipelineSetting {
  type: ConfigurablePipeline
  enabled: boolean
  isDefault: boolean
  updatedAt: string | null
  // Scoring params that go unscored, and model stop-factors that stop firing,
  // when this pipeline is off. Drives the warnings on the settings page.
  scoringParams: string[]
  stopFactors: string[]
  feedsLimit: boolean
}

export interface Region {
  id: number
  upperId: number | null
  nameRu: string
  nameUz: string
  nameUzc: string
}

export interface Branch {
  id: string
  merchantId: string
  name: string
  address: string
  phone: string
  regionId: number | null
  // Set and cleared as a pair — the API rejects a lone half.
  latitude: number | null
  longitude: number | null
  active: boolean
  createdAt: string
}

export interface MerchantEmployee {
  id: string
  phone: string
  fullName: string
  merchantId: string
  branchId: string
  roles: string[]
  mustChangePassword: boolean
  active: boolean
  createdAt: string
}

export interface Category {
  id: string
  name: string
  active: boolean
  createdAt: string
}

export interface Product {
  id: string
  merchantId: string
  categoryId: string
  name: string
  price: string
  mxikCode: string | null
  packageCode: number | null
  packageName: string | null
  isLabeled: boolean
  active: boolean
  createdAt: string
}

export interface MerchantDocument {
  id: string
  merchantId: string
  fileUrl: string
  documentType: string
  uploadedByAdminId: string | null
  uploadedAt: string
}

export type BlacklistEntryType = 'pinfl' | 'inn'

export interface BlacklistEntry {
  id: string
  type: BlacklistEntryType
  value: string
  reason: string | null
  addedByAdminId: string
  addedByName: string
  createdAt: string
}
