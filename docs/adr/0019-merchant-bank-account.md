# Merchant Bank Account — CBU Integration and Storage

Merchants need a designated bank account for Buyout disbursements. We store `mfo` (5 digits), `account_number` (20 digits), and `bank_name` as nullable columns directly on the `merchants` row. Fields are optional at creation and validated strictly at the API level.

Bank names are resolved by the Platform Admin via a CBU (Central Bank of Uzbekistan) bank registry lookup. The backend fetches the full branch list from `https://cbu.uz/upload/open_data/0010/4-009-0010_uz.json` (dataset 4-009-0010) and caches it in a `bank_mfo_cache` table on first request. The JSON fields used are `Filialkodi` (MFO, 5-digit branch code) and `Filialnomi` (branch name). The cache is **on-demand only** — no scheduled refresh. A dedicated admin endpoint (`POST /admin/banks/refresh`) lets a Platform Admin re-fetch the list manually if it is stale.

`bank_name` is **denormalized** onto the `merchants` row at save time rather than joined from `bank_mfo_cache` at read time. This means the stored name reflects what was shown to the admin at the moment of entry; a future CBU registry update does not silently change the displayed bank name on existing Merchant records.

## Considered options

- **Frontend direct** (browser calls cbu.uz): simpler, but CORS is not guaranteed and breaks the pattern of keeping all external HTTP calls server-side (ADR-0005).
- **Periodic cache refresh via pg-boss**: bank lists change rarely; an automatic daily job adds complexity with no practical benefit over on-demand refresh triggered by a human who notices a discrepancy.
- **Derive bank name at read time from `bank_mfo_cache`**: avoids denormalization, but means a cache refresh could silently alter names on existing Merchant records — undesirable for payment data.
