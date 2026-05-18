/**
 * Client-portal routes — require client JWT (ADR 0004).
 *  GET   /api/client/deals
 *  GET   /api/client/deals/:id
 *  GET   /api/client/notifications
 *  PATCH /api/client/notifications/:id
 *  POST  /api/client/notifications/mark-all-read
 */

import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import type { ClientJwt } from "@scoring/types";
import { clientService } from "./client.service.js";
import { notFound } from "../../shared/errors.js";

const PatchNotificationBody = Type.Object({
  read: Type.Boolean(),
});

export async function clientRoutes(app: FastifyInstance): Promise<void> {
  const clientOnly = {
    onRequest: [app.authenticate, app.requireRole("client")],
  };

  // --- Deals ---

  app.get("/api/client/deals", clientOnly, async (req) => {
    const { clientId } = req.user as ClientJwt;
    const data = await clientService.listDeals(clientId);
    return { data, total: data.length, page: 1, pageSize: data.length };
  });

  app.get("/api/client/deals/:id", clientOnly, async (req) => {
    const { clientId } = req.user as ClientJwt;
    const { id } = req.params as { id: string };
    const deal = await clientService.getDeal(clientId, id);
    if (!deal) throw notFound("Deal not found");
    return deal;
  });

  // --- Notifications ---

  app.get("/api/client/notifications", clientOnly, async (req) => {
    const { clientId } = req.user as ClientJwt;
    const data = await clientService.listNotifications(clientId);
    return { data, total: data.length };
  });

  app.patch(
    "/api/client/notifications/:id",
    { ...clientOnly, schema: { body: PatchNotificationBody } },
    async (req) => {
      const { clientId } = req.user as ClientJwt;
      const { id } = req.params as { id: string };
      const { read } = req.body as { read: boolean };
      const updated = await clientService.markNotificationRead(clientId, id, read);
      if (!updated) throw notFound("Notification not found");
      return updated;
    },
  );

  app.post("/api/client/notifications/mark-all-read", clientOnly, async (req, reply) => {
    const { clientId } = req.user as ClientJwt;
    await clientService.markAllNotificationsRead(clientId);
    return reply.code(204).send();
  });
}
