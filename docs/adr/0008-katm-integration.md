# ADR 0008: KATM Credit Bureau Integration

**Status:** Accepted

## Stack

| Concern | Choice |
|---|---|
| Bureau | KATM (Uzbekistan credit bureau) |
| Report type | InfoScore — code 077 (JSON) |
| Client identifier | PINFL (14-digit national ID) |
| Request anchor | Wizard Session ID → `claim_id` |
| Consent model | Per Deal — `consent_id` + `consent_date` |
| KATM failure policy | Hard block — Wizard cannot proceed |
| Response storage | Full raw JSON stored as `jsonb` on Wizard Session |
| Protocol | HTTP POST, BASE64-encoded JSON body, 24/7 real-time |

## Decisions

**InfoScore (077) as the sole KATM report.** InfoScore is a composite score KATM computes internally from credit history, utility payment behaviour, telco signals, and other bureau data sources. It returns a single numeric grade (`scoring_grade`, 0–999), a scoring class, and a scoring level — everything needed as input to the per-Tenant scoring model. Calling raw credit history (008) in addition would provide data KATM has already aggregated into the InfoScore Grade, at double the cost and latency. Additional reports are deferred until a Tenant's scoring model demonstrably requires them.

**PINFL as the Client identifier sent to KATM.** KATM identifies individuals by PINFL (14-digit personal identification number). PINFL is unique per Client in the platform — it serves as both the deduplication key for returning Clients and the lookup key on every KATM request. No other identifier (passport, phone number) is used in the KATM call.

**Wizard Session ID as `claim_id`.** KATM requires a `claim_id` (unique application reference, max 20 chars) on every request. The KATM query is made during the *Клиент* step — before a Deal exists. A Wizard Session record is created at Wizard open; its ID is sent as `claim_id`. If the Wizard completes, the Deal is linked to the session. If the Agent abandons, the session remains as an audit record of the bureau query with no associated Deal. Using a draft Deal ID was rejected: it pollutes the Deal table with incomplete records and complicates any query that lists Deals by status.

**Consent per Deal.** UZ law №301 requires explicit borrower consent before each credit bureau query. `consent_id` (consent document number) and `consent_date` are collected at the start of every Wizard run and stored on the Wizard Session. They are sent on the KATM request for that session. Standing consent (collected once per Client, reused across Deals) was rejected as legally riskier — bureau practice in Uzbekistan treats each credit application as requiring fresh consent.

**Hard block on KATM failure.** If KATM returns an error or times out, the Wizard halts at the *Клиент* step and the Agent cannot proceed. No Deal can be issued without a live InfoScore response on record. A manual override role was rejected: it would create a class of Deals with no bureau backing. A cached-score fallback was rejected for v1: cache invalidation policy requires observed data on KATM hit rates and outage frequency that does not yet exist.

**Full raw InfoScore response stored as `jsonb` on the Wizard Session.** The BASE64-decoded JSON response from KATM is stored in full alongside the indexed fields (`demand_id`, `scoring_grade`, `scoring_class`, `scoring_version`, `demand_date_time`). Credit bureau responses are legal evidence: a Client dispute or regulatory audit may require reproducing the exact bureau state at the time of the Deal decision. Storing key fields only was rejected because it is impossible to predict in advance which fields a future dispute or regulator will require, and the storage cost of one JSON blob per Wizard Session is negligible.

## Request structure (InfoScore 077)

```
POST <katm-base-url>
Content-Type: application/json

{
  "data": "<base64(json)>"   // BASE64-encoded payload
}

Payload:
{
  "report": {
    "sysinfo": {
      "report_type": 77,
      "org":          "<katm-org-code>",
      "branch":       "<katm-branch-code>",
      "org_name":     "<tenant-org-name>",
      "user_id":      "<employee-id>",
      "subject_type": 1,
      "demand_date_time": "YYYY-MM-DD HH:MI",
      "consent_id":   "<wizard-session.consent_id>",
      "consent_date": "YYYY-MM-DD",
      "claim_id":     "<wizard-session.id>",
      "claim_date":   "YYYY-MM-DD"
    },
    "client": {
      "juridical_status": 1,
      "client_type":      1,
      "pinfl":            "<client.pinfl>",
      "birth_date":       "YYYY-MM-DD",
      "name":             "<client.full-name>"
    }
  }
}
```

## Response fields stored on Wizard Session

| Field | Source | Purpose |
|---|---|---|
| `demand_id` | `sysinfo.demand_id` | KATM's 16-char request reference; used in disputes and audits |
| `scoring_grade` | `scoring.scoring_grade` | InfoScore Grade (0–999); input to the platform's Score computation |
| `scoring_class` | `scoring.scoring_class` | KATM's letter grade class |
| `scoring_level` | `scoring.scoring_level` | KATM's level label |
| `scoring_version` | `scoring.scoring_version` | KATM model version; needed to interpret the grade correctly |
| `demand_date_time` | `sysinfo.demand_date_time` | Timestamp of the bureau query |
| `raw_response` | full response | Complete BASE64-decoded JSON stored as `jsonb` |
