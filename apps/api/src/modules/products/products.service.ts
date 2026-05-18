/** Product catalog — tenant-scoped. */

import type { Product } from "@scoring/types";

export const productsService = {
  async list(tenantId: string): Promise<Product[]> {
    void tenantId;
    return [];
  },

  async create(
    tenantId: string,
    input: { name: string; sku: string; price: number; categoryId?: string },
  ): Promise<Product> {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      tenantId,
      categoryId: input.categoryId ?? null,
      name: input.name,
      sku: input.sku,
      price: input.price,
      active: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  },

  async update(
    tenantId: string,
    id: string,
    patch: Partial<{ name: string; sku: string; price: number; categoryId: string; active: boolean }>,
  ): Promise<Product | null> {
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
