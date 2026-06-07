import type { FastifyInstance } from "fastify";
import { listUniqueClients } from "./service.js";

export default async function adminClientsRoutes(app: FastifyInstance) {
  const db = app.db;

  app.get("/", async () => {
    const rows = await listUniqueClients(db);
    return {
      clients: rows.map((r) => ({
        id: r.id,
        pinfl: r.pinfl,
        phone: r.phone,
        fullName: `${r.first_name} ${r.last_name}`,
        middleName: r.middle_name ?? null,
        birthDate: r.birth_date,
        createdAt: r.created_at,
      })),
    };
  });
}
