// The full catalog of valid Features per platform — the single source of truth
// that backend route guards enforce and the admin Permissions page renders rows from.
// A Feature is a coarse, page/feature-level capability. Adding one is a code change.

export const MERCHANT_FEATURES = [
  'view_dashboard',
  'view_deals',
  'create_deal',
  "view_products",
  'manage_products',
  'manage_categories',
  'manage_tariffs',
  'manage_branches',
  'manage_employees',
  'view_collection_board',
] as const;

export const ADMIN_FEATURES = [
  'view_overview',
  'view_clients',
  'view_merchants',
  'manage_merchants',
  'onboard_merchants',
  'view_deals',
  'manage_employees',
  'view_tariffs',
  'manage_tariffs',
  'manage_products',
  'manage_categories',
  'manage_global_categories',
  'manage_blacklist',
  'view_collection_board',
  'view_payments',
  'manage_payments',
  'manage_buyout',
  'manage_settings',
  'manage_roles',
  'manage_admins',
  'manage_scoring_model',
  'view_scorings',
  'view_integration_logs',
] as const;

export type MerchantFeature = (typeof MERCHANT_FEATURES)[number];
export type AdminFeature = (typeof ADMIN_FEATURES)[number];
export type Feature = MerchantFeature | AdminFeature;
export type Platform = 'merchant' | 'admin';

// Admin Features that confer power over the permission system itself. A
// non-Superadmin editor may never grant these (anti-escalation guard).
export const PROTECTED_ADMIN_FEATURES: readonly AdminFeature[] = [
  'manage_roles',
  'manage_admins',
];

export const FEATURE_CATALOG: Record<Platform, readonly Feature[]> = {
  merchant: MERCHANT_FEATURES,
  admin: ADMIN_FEATURES,
};

export function isValidFeature(platform: Platform, feature: string): boolean {
  return (FEATURE_CATALOG[platform] as readonly string[]).includes(feature);
}

// Stable keys of the seeded merchant default Roles. The Agent key is the only
// Role a Merchant Admin may assign when creating Employees.
export const MERCHANT_ROLE_KEYS = {
  agent: 'agent',
  merchantAdmin: 'merchant_admin',
} as const;

export const SUPERADMIN_ROLE_KEY = 'superadmin';
