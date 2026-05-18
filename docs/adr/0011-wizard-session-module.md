# ADR 0011: Wizard Session as a Top-Level Module

**Status:** Accepted

## Context

The Wizard requires a server-side session before any scoring begins. The session anchors:

- The PlumGate OTP flow (ADR 0009) — `plumgate_scoring_sessions` rows are keyed by `wizard_session_id`
- The KATM `claim_id` sent on every bureau request (ADR 0008)
- The SSE progress channel that streams scoring events to the frontend (ADR 0010)

The session exists before a Deal is created. It may never produce a Deal (Agent abandons, Client is declined). Placing Wizard Session routes under `/api/deals/` implies a Deal already exists, which is false.

## Decision

**Wizard Session is a top-level module at `/api/wizard/sessions/`.** The SSE progress channel moves from `GET /api/deals/wizard/:sessionId/progress` to `GET /api/wizard/sessions/:sessionId/progress`.

Routes:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/wizard/sessions` | Create a Wizard Session; returns `{ sessionId }` |
| `POST` | `/api/wizard/sessions/:sessionId/card/create` | Trigger PlumGate OTP for a card network |
| `POST` | `/api/wizard/sessions/:sessionId/card/confirm` | Submit OTP; triggers background scoring |
| `GET` | `/api/wizard/sessions/:sessionId/progress` | SSE channel; streams `scoring.completed` and other step events |

When a Deal is created at Wizard completion, `POST /api/deals` receives the `wizardSessionId` in the body and links the session to the resulting Deal record.

## Rejected alternative

Placing card scoring and SSE under `/api/deals/wizard/:sessionId/` — rejected because a Wizard Session precedes and may never become a Deal. Routing through the deals module implies a Deal context that does not yet exist.
