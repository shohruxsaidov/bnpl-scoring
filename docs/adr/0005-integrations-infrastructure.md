# ADR 0005: Integrations & Infrastructure

**Status:** Accepted

## Decisions

**Client payments via Payme and Click.** Clients pay installments online through Payme and Click — the two dominant consumer payment rails in Uzbekistan. Direct card acquiring not chosen for v1 to avoid PCI-DSS scope and separate merchant acquiring contracts.

**Payment webhooks processed synchronously with idempotency key.** Payme and Click webhooks are processed synchronously — the backend records the payment and responds immediately. Double-recording on retried webhooks is prevented by treating the payment provider's transaction ID as an idempotency key: a unique constraint on `transaction_id` in the payments table returns 200 without creating a duplicate record. An async queue (pg-boss) considered but rejected — synchronous processing with a unique constraint provides the same duplicate-safety guarantee without the indirection of a job queue.

**Overdue notifications via SMS + in-app flag.** Overdue installment notifications are delivered through two channels: SMS to the Client's registered phone number and an in-app notification flag visible in the Client Web Portal. Push notifications excluded (no native mobile app). SMS-only rejected — it provides no persistent record the Client can review later. The in-app flag is a boolean/timestamp on the installment record, read at login — no separate notification service is needed. Both channels share the SMS provider already integrated for OTP delivery.

**Signed credit agreements stored in Garage object storage.** When a Client signs via MyID, the backend generates the agreement PDF, obtains the MyID digital signature, stores the signed PDF in Garage (self-hosted S3-compatible object storage), and saves the MyID transaction reference alongside the storage key in the database. Relying solely on the MyID transaction reference rejected — if MyID retrieval is unavailable, the signed document cannot be produced for legal or dispute purposes. Garage chosen over managed cloud storage (S3, GCS) to keep documents self-hosted under full operational control.
