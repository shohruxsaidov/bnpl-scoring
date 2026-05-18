/** Deals + lazily-loaded sub-resources. All tenant-scoped. */

import type { Deal, InstallmentScheduleRow } from "@scoring/types";

export const dealsService = {
  async list(tenantId: string): Promise<Deal[]> {
    void tenantId;
    return [];
  },

  async header(tenantId: string, id: string): Promise<Deal | null> {
    void tenantId;
    void id;
    return null;
  },

  async create(
    tenantId: string,
    agentId: string,
    input: { clientId: string; tariffId: string; principal: number },
  ): Promise<Deal> {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      tenantId,
      clientId: input.clientId,
      agentId,
      tariffId: input.tariffId,
      status: "draft",
      principal: input.principal,
      totalPayable: input.principal,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  },

  async schedule(
    tenantId: string,
    dealId: string,
  ): Promise<InstallmentScheduleRow[]> {
    void tenantId;
    void dealId;
    return [];
  },

  async overdue(tenantId: string, dealId: string) {
    void tenantId;
    void dealId;
    return { rows: [], totalOverdue: 0 };
  },

  async accounting(tenantId: string, dealId: string) {
    void tenantId;
    void dealId;
    return { principalPaid: 0, markupPaid: 0, outstanding: 0 };
  },

  async autopayment(tenantId: string, dealId: string) {
    void tenantId;
    void dealId;
    return { enabled: false, cardId: null as string | null };
  },

  async status(tenantId: string, dealId: string) {
    void tenantId;
    void dealId;
    return { status: "draft", changedAt: new Date().toISOString() };
  },
};
