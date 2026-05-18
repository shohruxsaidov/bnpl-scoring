/**
 * @scoring/types — shared domain types across api + frontends.
 * These mirror the Drizzle schema in @scoring/db but stay framework-free.
 */

// ---------------------------------------------------------------------------
// Primitives & common
// ---------------------------------------------------------------------------

export type UUID = string;
export type ISODateTime = string;

/** Every persisted row carries these. Soft-delete via `deletedAt`. */
export interface BaseEntity {
  id: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt: ISODateTime | null;
}

/** Tenant-scoped rows additionally carry the owning tenant. */
export interface TenantScoped {
  tenantId: UUID;
}

export type Money = number; // minor units (tiyin)

// ---------------------------------------------------------------------------
// Auth & identity
// ---------------------------------------------------------------------------

export type RoleName =
  | "agent"
  | "merchant_admin"
  | "platform_admin"
  | "client";

export interface Role extends BaseEntity, TenantScoped {
  name: RoleName;
  description: string | null;
}

export interface Employee extends BaseEntity, TenantScoped {
  fullName: string;
  phone: string;
  email: string | null;
  passwordHash: string;
  active: boolean;
}

export interface EmployeeRole extends BaseEntity {
  employeeId: UUID;
  roleId: UUID;
}

/** JWT payload issued by /api/auth/login (agents + merchant admins). */
export interface AgentJwt {
  userId: UUID;
  tenantId: UUID;
  role: RoleName;
}

/** JWT payload issued by /api/platform/auth/login. */
export interface PlatformJwt {
  userId: UUID;
  role: "platform_admin";
}

/** JWT payload issued by /api/client/auth/otp. */
export interface ClientJwt {
  clientId: UUID;
  tenantId: UUID;
}

export type AnyJwt = AgentJwt | PlatformJwt | ClientJwt;

/** Login response: either a token or a role picker when multi-role. */
export interface LoginResult {
  employee: Pick<Employee, "id" | "fullName" | "phone">;
  roles: RoleName[];
  token: string | null;
}

// ---------------------------------------------------------------------------
// Tenant
// ---------------------------------------------------------------------------

export interface Tenant extends BaseEntity {
  name: string;
  slug: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface Client extends BaseEntity, TenantScoped {
  fullName: string;
  phone: string;
  passportSerial: string | null;
  pinfl: string | null;
  birthDate: string | null;
}

export interface ClientCard extends BaseEntity, TenantScoped {
  clientId: UUID;
  maskedPan: string;
  token: string;
  expiry: string;
  primary: boolean;
}

// ---------------------------------------------------------------------------
// Catalog: categories, products, tariffs
// ---------------------------------------------------------------------------

export interface Category extends BaseEntity, TenantScoped {
  name: string;
  parentId: UUID | null;
}

export interface Product extends BaseEntity, TenantScoped {
  categoryId: UUID | null;
  name: string;
  sku: string;
  price: Money;
  active: boolean;
}

export interface Tariff extends BaseEntity, TenantScoped {
  name: string;
  termMonths: number;
  markupPercent: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type ScoreDecision = "approved" | "declined" | "manual_review";

export interface ScoringModel extends BaseEntity, TenantScoped {
  name: string;
  version: number;
  active: boolean;
}

export interface ScoringCriterion extends BaseEntity, TenantScoped {
  modelId: UUID;
  code: string;
  label: string;
  weight: number;
}

export interface Score {
  dealId: UUID;
  modelId: UUID;
  value: number;
  decision: ScoreDecision;
  limit: Money;
  computedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

export type DealStatus =
  | "draft"
  | "scoring"
  | "approved"
  | "declined"
  | "active"
  | "closed"
  | "overdue";

export interface Deal extends BaseEntity, TenantScoped {
  clientId: UUID;
  agentId: UUID;
  tariffId: UUID;
  status: DealStatus;
  principal: Money;
  totalPayable: Money;
}

export interface DealBasket extends BaseEntity, TenantScoped {
  dealId: UUID;
  total: Money;
}

export interface DealBasketItem extends BaseEntity, TenantScoped {
  basketId: UUID;
  productId: UUID;
  quantity: number;
  unitPrice: Money;
}

export interface InstallmentScheduleRow extends BaseEntity, TenantScoped {
  dealId: UUID;
  sequence: number;
  dueDate: string;
  amount: Money;
  paid: boolean;
  paidAt: ISODateTime | null;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export type PaymentStatus = "pending" | "succeeded" | "failed" | "reversed";

export interface Payment extends BaseEntity, TenantScoped {
  dealId: UUID;
  transactionId: string;
  amount: Money;
  status: PaymentStatus;
  provider: string;
  processedAt: ISODateTime | null;
}

// ---------------------------------------------------------------------------
// Wizard & integrations
// ---------------------------------------------------------------------------

export type WizardStepStatus =
  | "pending"
  | "in_progress"
  | "succeeded"
  | "failed";

export type WizardStepKey =
  | "client"
  | "card"
  | "tariff"
  | "product"
  | "payment_day"
  | "verification"
  | "done";

export interface WizardStep {
  key: WizardStepKey;
  label: string;
  status: WizardStepStatus;
  error: string | null;
}

export interface WizardSession extends BaseEntity, TenantScoped {
  dealId: UUID | null;
  agentId: UUID;
  currentStep: WizardStepKey;
  steps: WizardStep[];
}

export interface KatmConsent extends BaseEntity, TenantScoped {
  clientId: UUID;
  consentId: string;
  granted: boolean;
  grantedAt: ISODateTime | null;
}

export interface PlumgateScoringSession extends BaseEntity, TenantScoped {
  clientId: UUID;
  cardId: UUID | null;
  externalSessionId: string;
  status: WizardStepStatus;
  scoreValue: number | null;
}

export interface KontraktDocument extends BaseEntity, TenantScoped {
  dealId: UUID;
  url: string;
  signed: boolean;
  signedAt: ISODateTime | null;
}

// ---------------------------------------------------------------------------
// API envelope
// ---------------------------------------------------------------------------

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}
