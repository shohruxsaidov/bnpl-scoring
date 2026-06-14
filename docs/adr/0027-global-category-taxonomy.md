# ADR 0027: Global Category Taxonomy with Per-Merchant Enablement

**Status:** Accepted

## Context

Categories were previously merchant-owned: `categories.merchant_id NOT NULL` meant each Merchant managed its own category list independently. This caused taxonomy fragmentation — every Merchant created "Elektronika", "Mebel", etc. with inconsistent naming — and made cross-merchant reporting and product classification impossible to standardise.

## Decision

Categories become a **global, Platform-Admin-managed taxonomy**. The `merchant_id` column is removed from `categories`. A new join table `merchant_categories(category_id, merchant_id)` records which Categories a given Merchant has enabled.

### Schema changes

- `categories`: drop `merchant_id` column. Retains `active` as a Platform-Admin-controlled global kill switch.
- `merchant_categories`: new table with `(category_id REFERENCES categories(id), merchant_id REFERENCES merchants(id), PRIMARY KEY (category_id, merchant_id))`. No `active` column — presence means enabled, absence means disabled.

### Ownership and access

- **Platform Admin** creates, edits, and globally activates/deactivates Categories. Gated by new Feature `manage_global_categories`.
- **Merchant Admin** enables/disables Categories for their Merchant by inserting/deleting `merchant_categories` rows. Gated by existing Feature `manage_categories` (narrowed meaning — no longer includes creating categories).

### Visibility rules

A Category is visible to a Merchant's catalog and Wizard only when **both** hold:
1. `categories.active = true` (global flag)
2. A `merchant_categories` row exists for that `(category_id, merchant_id)` pair

### Product assignment enforcement

`create-product` and `update-product` commands validate that the chosen `category_id` has a corresponding `merchant_categories` row for the acting Merchant before allowing the assignment. Returns `400` if not.

### Admin portal UX

Category enablement for a Merchant is managed from the **Merchant detail page** — a checklist of all active global Categories, mirroring how Tariff selection works. This is not exposed from the Category detail page.

### Migration

Existing merchant-owned category rows are migrated as follows:
1. Deduplicate by name (case-insensitive) → insert one global `categories` row per unique name.
2. For each original merchant-category row, insert a `merchant_categories(category_id, merchant_id)` row referencing the deduped global category.
3. `products.category_id` FKs are updated to point to the merged global category id.

## Alternatives considered

**Keep merchant-owned categories** — rejected: proliferates inconsistent names, blocks cross-merchant taxonomy.

**Single active flag on `merchant_categories`** — rejected: an `active = false` join row is confused state. Presence/absence is the toggle; a global `categories.active` handles platform-wide retirement.

**Category enablement from the Category detail page** — rejected: the natural operator workflow is merchant-centric ("configure this merchant"), not category-centric. Merchant detail page matches the Tariff-selection precedent.
