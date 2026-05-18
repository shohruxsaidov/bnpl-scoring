# ADR 0009: PlumGate Card Scoring Integration

**Status:** Accepted

## Stack

| Concern | Choice |
|---|---|
| Provider | PlumGate SCORING module |
| Networks | Uzcard + Humo (both) |
| Client identifier | PINFL |
| Auth flow | OTP per card registration (Create → OTP → Confirm → Get) |
| Wizard placement | Dedicated Karta step (step 2, after Клиент) |
| Failure policy | Hard block — Wizard cannot proceed without a confirmed card |
| Token storage | Per Client in `client_cards` table; reused across Deals |
| Session storage | `plumgate_scoring_sessions` table; one row per network per Wizard run |
| Response storage | Full raw JSON stored as `jsonb` on session row |
| Score contribution | Additive criterion in per-Tenant scoring model JSON; null → 0 (no penalty) |

## Decisions

**Both Uzcard and Humo networks queried.** A Client may hold cards on either or both networks. Querying only one network would silently exclude transaction history from the other. Two `plumgate_scoring_sessions` rows are written per Wizard run — one per network. If the Client has no card on a given network, that row is written with `status: skipped`.

**Dedicated Karta step in the Wizard.** Card scoring requires an OTP confirmation sub-flow (trigger → Client receives OTP → Agent enters it → confirm → retrieve result). This interaction cannot be folded into the Клиент step without making that step multi-stage and ambiguous. A dedicated step keeps the OTP flow isolated and gives the Agent clear forward/skip control.

**Hard block when no card is confirmed.** Card verification is a mandatory prerequisite for a Deal (TZ §3, Step 3). If the Client has no Uzcard or Humo card, or the OTP flow fails on both networks, the Karta step shows a hard block and the Wizard cannot proceed. Soft skip was rejected: the TZ explicitly states that card absence is grounds for denial — card transaction history is a required scoring input, not a supplementary one. A retry on OTP failure is allowed within the same Karta step; the Agent can re-initiate the OTP flow if the Client misreads the code.

**Agent-mediated OTP entry.** The Client reads the OTP from their phone and tells the Agent, who types it into the Wizard. The Wizard is an Agent-facing tool; the Client is a walk-in at a merchant POS and does not operate the device. This matches the existing interaction pattern for all other Wizard steps.

**Card tokens stored per Client, reused across Deals.** Once a Client confirms their card via OTP, the PlumGate token is stored in `client_cards` (keyed by `client_id` + network). On subsequent Deals, the Karta step uses the stored token to call PlumGate directly — no OTP required. Card tokens are long-lived on PlumGate's side. Standing token reuse was preferred over per-Deal OTP because unlike KATM consent (required fresh per application by UZ law №301), there is no legal requirement for card scoring consent to be re-obtained on every Deal. The token is the standing authorisation.

**Separate `plumgate_scoring_sessions` table.** PlumGate session state (pending OTP, confirmed, skipped, failed) and the full raw response are stored in a dedicated table rather than as additional columns on `wizard_sessions`. Reasons: the OTP flow has transient intermediate states that belong on their own record; there are two rows per Wizard run (one per network); and mixing PlumGate columns into `wizard_sessions` would conflate two independent integration concerns. The table is anchored to both `wizard_session_id` (audit trail per Deal attempt) and `client_id` (per-Client scoring history).

**Full raw PlumGate response stored as `jsonb`.** The complete response for each network is stored on the `plumgate_scoring_sessions` row alongside indexed fields. Same rationale as KATM raw storage: credit-adjacent data may be required in a Client dispute or regulatory audit, and it is impossible to predict in advance which fields will be relevant. Storage cost per row is negligible.

**Card Score as an additive criterion in the per-Tenant scoring model JSON.** The scoring model computes a weighted criteria sum from multiple data sources (KATM credit history, income, demographics, etc.). Card Score from PlumGate adds one or more criteria entries to that JSON, each with an `ImportantLevel` and value-band-to-score mapping. When `card_score` is null (soft skip), those criteria contribute 0 to the sum — no penalty, no coefficient change. This is consistent with the soft-skip decision and preserves full Deal eligibility for Clients with no bank cards.

## OTP flow (Karta step)

```
Agent opens Karta step
  └─ POST /scoring/create (PINFL, network)
       └─ PlumGate sends OTP to Client's registered phone number

Agent: "Please read me the code from your phone"
Client reads OTP aloud → Agent types OTP into Wizard

  └─ POST /scoring/confirm (session_id, otp)
       ├─ success → GET /scoring/result → write plumgate_scoring_sessions row (status: confirmed)
       └─ failure → write row (status: failed) → soft skip → proceed
```

For returning Clients with a stored token:
```
Agent opens Karta step
  └─ POST /scoring/result (token) — no OTP required
       ├─ success → write plumgate_scoring_sessions row (status: confirmed)
       └─ failure → soft skip
```

## `plumgate_scoring_sessions` table

| Column | Purpose |
|---|---|
| `id` | PK |
| `wizard_session_id` | FK → `wizard_sessions` — links to the Deal attempt |
| `client_id` | FK → `clients` — enables per-Client score history queries |
| `network` | `uzcard` \| `humo` |
| `plumgate_session_id` | PlumGate's own session reference |
| `status` | `confirmed` \| `skipped` \| `failed` |
| `raw_response` | Full `jsonb` PlumGate response |
| `scored_at` | Timestamp of the scoring call |

## `client_cards` table

| Column | Purpose |
|---|---|
| `id` | PK |
| `client_id` | FK → `clients` |
| `network` | `uzcard` \| `humo` |
| `token` | PlumGate card token (long-lived) |
| `masked_pan` | Display only — last 4 digits shown in Karta step |
| `registered_at` | Timestamp of first OTP confirmation |
