/** Tariff catalog — tenant-scoped. */

import type { Tariff } from "@scoring/types";

export const tariffsService = {
  async list(tenantId: string): Promise<Tariff[]> {
    void tenantId;
    return [];
  },

  async create(
    tenantId: string,
    input: { name: string; termMonths: number; markupPercent: number },
  ): Promise<Tariff> {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      tenantId,
      name: input.name,
      termMonths: input.termMonths,
      markupPercent: input.markupPercent,
      active: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  },

  async update(
    tenantId: string,
    id: string,
    patch: Partial<{ name: string; termMonths: number; markupPercent: number; active: boolean }>,
  ): Promise<Tariff | null> {
    void tenantId;
    void id;
    void patch;
    return null;
  },

  async softDelete(tenantId: string, id: string): Promise<boolean> {
    void tenantId;
    void id;
    return true;
  },
};
