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
  'send_client_push',
  'view_app_ratings',
  // Deliberately NOT folded into manage_settings: banners are marketing art on
  // every client's home screen, edited on a campaign cadence by people who have
  // no business editing the platform's bank requisites or publishing a public
  // offer. Read and write are one grant — inspecting the banner list has no
  // standalone support value the way the force-update floor does.
  'manage_banners',
  'view_merchants',
  'manage_merchants',
  'onboard_merchants',
  'view_deals',
  // Deliberately NOT folded into manage_payments: issuing a fiscal receipt
  // files an irreversible document with the tax authority under the platform's
  // own INN. That blast radius should not ride along with the grant that also
  // lets someone post a comment on a deal.
  'create_deal_receipt',
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
  // Split from manage_app_versions so seeing the force-update floor (and the
  // blast-radius preview) does not imply being able to move it — reading is
  // what support needs during an incident, publishing is what strands a fleet.
  'view_app_versions',
  // Deliberately NOT folded into manage_settings: publishing a policy can lock
  // every client out of the mobile app at once, and that blast radius should
  // not ride along with the org-requisites / public-offer grant.
  'manage_app_versions',
  'manage_roles',
  'manage_admins',
  'manage_scoring_model',
  'view_scorings',
  'view_integration_logs',
  'manage_queues',
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
