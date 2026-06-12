# Deal Session: server-side wizard state as the source of truth for deal creation

The Wizard previously held all step state client-side in a persisted Pinia store; the Deal was created in one shot at the Верификация step from a client-submitted payload (including client-supplied scoring results — falsifiable by a tampered client). The old docs described a draft-Deal-at-wizard-open design that was never implemented, and a `wizard_sessions` table had once been folded into `deals`. We are deliberately reversing that consolidation.

**Decision.** A `deal_sessions` row (UUID) is created the moment an Agent opens the Wizard, plus an append-only `deal_session_events` table — one row per step submission, including redone steps. The session head holds the mutable resume snapshot (`current_step`, `status`, `step_data` jsonb); the event log serves funnel analytics and audit. Deal creation is rebuilt to read **from the session**: `POST /merchant/deals` shrinks to `{ dealSessionId, signingToken }`, and basket, tariff, payment day, lang, and scoring all come from session data written server-side.

**Key choices and why:**

- **Separate table, not draft Deals.** Draft-at-open burns a sequential `deal_number` (CN-…) per abandoned run — gaps in contract numbering on a financial product — and mixes abandoned runs into the financial record. `deals` stays real-deals-only; sessions get their own lifecycle. (`deals.deal_session_id` FK links them.)
- **Server truth, blocking step saves.** On wizard open the frontend hydrates from `GET` active session; advancing a step awaits the save. Guarantees the event trail is complete and enables cross-device resume. The Pinia store is demoted to a cache.
- **One active session per Agent, auto-supersede.** Opening the Wizard resumes the active session; starting a new run (or the close-deal action) marks the old one `abandoned`. No TTL cron.
- **Session UUID = KATM `claim_id`** (replacing the random 20-char string), making every bureau pull traceable to its run — matches the self-service scoring flow.
- **Payloads are IDs + non-reconstructable data.** No Client PII blob in jsonb (the `clients` row is the PII home). KATM consent/result (incl. raw infoscore) is captured on the session so abandoned-run bureau data is retained for risk analysis; it is still copied onto the Deal at creation as today.
- **Prices are server-snapshotted at the Mahsulot step.** The server resolves productId → current DB price when the step is saved and the Deal uses that snapshot verbatim, so the signed contract equals what the Client OTP-consented to. Rejected: re-pricing at signing (consent shown ≠ contract signed).
- **Scoring is stamped onto the session by the server** when the scoring run executes; the client never carries scoring results again. First concrete slice of ADR-0022 (scoring engine sole authority).
- **Redoing an earlier step invalidates completed later steps**; deal creation asserts Верификация is the latest completed step — a basket cannot change after OTP consent.

**Consequences.** `resolveAndCreateDeal` is rewritten around session data and gains stale-session failure modes at signing (e.g. product deleted → hard fail, Agent redoes the step). Retention of sessions/events (which contain bureau pull data) is **deliberately deferred** — revisit when an analytics consumer exists or a data-protection requirement arrives.
