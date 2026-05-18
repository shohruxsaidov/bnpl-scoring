/** Category catalog — tenant-scoped. */

import type { Category } from "@scoring/types";

export const categoriesService = {
  async list(tenantId: string): Promise<Category[]> {
    void tenantId;
    return [];
  },

  async create(tenantId: string, input: { name: string; parentId?: string }): Promise<Category> {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      tenantId,
      name: input.name,
      parentId: input.parentId ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  },

  async update(
    tenantId: string,
    id: string,
    patch: Partial<{ name: string; parentId: string }>,
  ): Promise<Category | null> {
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
