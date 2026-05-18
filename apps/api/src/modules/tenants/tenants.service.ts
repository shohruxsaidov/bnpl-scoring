/** Tenant management — platform-admin only, NOT tenant-scoped. */

import type { Tariff, Tenant } from "@scoring/types";

export interface ScoringModelConfig {
  version: string;
  updatedAt: string;
  hardDenyThreshold: number;
  partialLimitThreshold: number;
  criteria: Record<string, number>;
  rules: string[];
}

export const tenantsService = {
  async list(): Promise<{ data: Tenant[]; total: number }> {
    return { data: [], total: 0 };
  },

  async getById(id: string): Promise<Tenant | null> {
    void id;
    return null;
  },

  async create(input: { name: string; slug: string }): Promise<Tenant> {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      name: input.name,
      slug: input.slug,
      active: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  },

  async update(
    id: string,
    patch: Partial<{ name: string; slug: string; active: boolean }>,
  ): Promise<Tenant | null> {
    void id;
    void patch;
    return null;
  },

  async softDelete(id: string): Promise<boolean> {
    void id;
    return true;
  },

  async getScoringModel(tenantId: string): Promise<ScoringModelConfig | null> {
    void tenantId;
    return null;
  },

  async updateScoringModel(
    tenantId: string,
    model: ScoringModelConfig,
  ): Promise<ScoringModelConfig> {
    void tenantId;
    return model;
  },

  async listTariffs(tenantId: string): Promise<Tariff[]> {
    void tenantId;
    return [];
  },

  async createTariff(
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

  async updateTariff(
    tenantId: string,
    tariffId: string,
    patch: Partial<{ name: string; termMonths: number; markupPercent: number; active: boolean }>,
  ): Promise<Tariff | null> {
    void tenantId;
    void tariffId;
    void patch;
    return null;
  },

  async softDeleteTariff(tenantId: string, tariffId: string): Promise<boolean> {
    void tenantId;
    void tariffId;
    return true;
  },
};
