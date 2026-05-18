/**
 * Payments. Webhooks are processed synchronously and idempotently keyed
 * on transaction_id (unique constraint in schema). A duplicate webhook
 * returns the prior result instead of double-applying (ADR 0005).
 */

import type { Payment } from "@scoring/types";

const seen = new Map<string, Payment>();

export const paymentsService = {
  async list(tenantId: string): Promise<Payment[]> {
    void tenantId;
    return [];
  },

  async handleWebhook(
    tenantId: string,
    input: {
      transactionId: string;
      dealId: string;
      amount: number;
      provider: string;
    },
  ): Promise<{ payment: Payment; duplicate: boolean }> {
    const existing = seen.get(input.transactionId);
    if (existing) return { payment: existing, duplicate: true };

    const now = new Date().toISOString();
    const payment: Payment = {
      id: crypto.randomUUID(),
      tenantId,
      dealId: input.dealId,
      transactionId: input.transactionId,
      amount: input.amount,
      status: "succeeded",
      provider: input.provider,
      processedAt: now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    seen.set(input.transactionId, payment);
    return { payment, duplicate: false };
  },
};
