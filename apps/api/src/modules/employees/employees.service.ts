/** Employee management — tenant-scoped. Always pass tenantId. */

import type { Employee } from "@scoring/types";

export const employeesService = {
  async list(tenantId: string): Promise<Employee[]> {
    void tenantId;
    return [];
  },

  async create(
    tenantId: string,
    input: { fullName: string; phone: string; email?: string },
  ): Promise<Employee> {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      tenantId,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email ?? null,
      passwordHash: "",
      active: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  },

  async update(
    tenantId: string,
    id: string,
    patch: Partial<{ fullName: string; phone: string; email: string; active: boolean }>,
  ): Promise<Employee | null> {
    void tenantId;
    void id;
    void patch;
    return null;
  },
};
