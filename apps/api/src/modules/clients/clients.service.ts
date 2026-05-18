/** Client records — tenant-scoped. */

import type { Client } from "@scoring/types";

export const clientsService = {
  async list(tenantId: string): Promise<Client[]> {
    void tenantId;
    return [];
  },

  async search(tenantId: string, q: string): Promise<Client[]> {
    void tenantId;
    void q;
    return [];
  },

  async getById(tenantId: string, id: string): Promise<Client | null> {
    void tenantId;
    void id;
    return null;
  },

  async create(
    tenantId: string,
    input: { fullName: string; phone: string },
  ): Promise<Client> {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      tenantId,
      fullName: input.fullName,
      phone: input.phone,
      passportSerial: null,
      pinfl: null,
      birthDate: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  },
};
