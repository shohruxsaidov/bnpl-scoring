# ADR 0010: Scoring Triggered at Karta Step Completion

**Status:** Accepted

## Context

The Wizard collects two inputs that feed the scoring engine:

1. **KATM data** — retrieved during Step 1 (Клиент) via the InfoScore 077 query
2. **Card Score** — retrieved during Step 2 (Karta) via PlumGate

Step 3 (Tarif) cannot render its Tariff list until the Score and resulting credit limit are known. The question is: when does the scoring computation start?

Two options were considered:

| Option | Trigger point | Agent experience |
|---|---|---|
| A | Agent navigates *to* Step 3 (Tarif) | Step 3 renders, then immediately blocks on a spinner for full scoring latency |
| B | Agent clicks **Далее →** on Step 2 (Karta) | Scoring runs in background during step transition; spinner on Step 3 may resolve before the Agent has read the page |

## Decision

**Option B — trigger scoring at Karta step completion.**

When the Agent clicks **Далее →** on Step 2, the backend scoring computation starts immediately in the background. Step 3 renders a blocking spinner ("Скоринг выполняется…") and the frontend listens on the existing SSE channel for the `scoring.completed` event. The Tariff list and client credit limit are displayed only after the event arrives.

## Consequences

- Scoring latency is partially hidden behind the step-transition animation. If scoring completes quickly, the Agent sees no spinner at all.
- The frontend must initiate the scoring request (or the Karta completion endpoint must trigger it server-side) before navigating to Step 3.
- Step 3 **Далее →** is disabled until `scoring.completed` is received.
- If scoring returns `decision: declined`, Step 3 shows a hard block with no Tariff list. The Agent can only navigate back to Step 1.
- If scoring returns `decision: manual_review`, Step 3 behaves identically to `approved` — the Tariff list is shown with the partial credit limit.
- If the SSE connection drops and no result arrives within a timeout (recommended: 30 s), Step 3 shows a retry prompt.

## SSE event shape

```json
{
  "event": "scoring.completed",
  "data": {
    "wizardSessionId": "<uuid>",
    "decision": "approved | declined | manual_review",
    "limit": 8000000,
    "score": 720
  }
}
```

## Step 3 states

| State | Condition | Agent sees |
|---|---|---|
| Waiting | SSE event not yet received | Spinner: "Скоринг выполняется …" |
| Approved | `decision: approved \| manual_review` | Credit limit badge + selectable Tariff list |
| Declined | `decision: declined` | Hard block: "Клиент не прошёл скоринг" |
| Timeout | No SSE within 30 s | Error prompt with retry button |
