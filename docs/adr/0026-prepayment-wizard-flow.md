# Prepayment at the Products Step when Available Balance is Insufficient

The Wizard previously had no path for a Client whose Available Balance was below the desired Basket total — the Products step silently capped the basket and the deal could not proceed. The Contract PDF already carried a hardcoded `prepayment: 0` field, indicating the concept was planned.

**Decision.** A Prepayment flow is added inside the Products step. When `basketTotal > limit × termMonths`, the Continue button is disabled and a "Prepayment" button opens a dialog. The Agent enters a Prepayment Card number, expiry, and the Client's phone number; submits an OTP (mocked — always succeeds until a real acquiring integration replaces it); and on confirmation the server stamps a `prepayment` block onto `deal_sessions.stepData`. Deal creation reads the stamp and computes the InstallmentSchedule on `basketTotal − prepaymentAmount` rather than the full basket. The confirmed amount is copied to `deals.prepayment_amount` and printed in the Contract PDF `prepayment` field.

**Key choices and why:**

- **Products step, not Tariff step.** The gap is only known once a specific basket exists. Triggering prepayment at the Tariff step is premature — the client hasn't chosen products yet, so the exact shortfall is unknown.

- **Exact gap only, no Agent input.** The prepayment amount is fixed to `basketTotal − (limit × termMonths)`. The Agent cannot enter a larger or smaller amount in v1. This avoids ambiguity about minimum coverage and keeps the dialog read-only for the amount field.

- **Any card, not the registered PlumGate card.** The Prepayment Card is whatever card the Client presents — it may be a second card, a family member's card, or a different network. This is separate from the Uzcard/Humo card registered at the Card step for installment repayments and scoring.

- **Mocked acquiring, not a real processor.** No payment acquiring integration exists on the platform. The OTP step is UI-only (always succeeds). The dialog establishes the end-user flow now so that when a real processor (Payme, Click, or other) lands, only the backend call changes — the Wizard UX is already correct.

- **Deal-scoped, not a persistent Client wallet.** The prepayment is stamped on the Deal Session and copied to the Deal. It does not mutate the Client's Platform Credit Limit or Available Balance — those remain Finsum-controlled scoring outputs. A "client_balance" persistent wallet was rejected because a prepayment at one Merchant must not affect the Client's limit at another.

- **Prepayment stamp cleared on products redo.** Saving the `products` step drops `stepData.prepayment`, consistent with ADR-0024's rule that redoing a step voids downstream consent. The confirmed amount was computed from the basket at confirmation time; a basket change makes that confirmation stale.

- **Hard block, not soft warning.** Continue is disabled until either the basket fits within the limit or a Prepayment is confirmed. A soft warning would produce a hard failure at Верификация because the server enforces the Available Balance constraint at deal creation.

**Consequences.** `deals.prepayment_amount` (bigint, tiyin, nullable) is added to the schema. `deal_sessions.stepData` gains an optional `prepayment` block (`{ amount, confirmedAt }`). `saveStep` for the `products` case deletes `next.prepayment` from the session head. `resolveAndCreateDeal` computes the InstallmentSchedule on `amount − prepaymentAmount`. The Contract PDF `prepayment` field now reflects the actual amount instead of the hardcoded zero.
