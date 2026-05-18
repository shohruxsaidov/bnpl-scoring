/**
 * Wizard Session routes (ADR 0011).
 *  POST /api/wizard/sessions                          — create session
 *  POST /api/wizard/sessions/:sessionId/card/create   — trigger PlumGate OTP
 *  POST /api/wizard/sessions/:sessionId/card/confirm  — submit OTP → scoring
 *  GET  /api/wizard/sessions/:sessionId/progress      — SSE progress stream
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import type { AgentJwt, WizardStep } from "@scoring/types";
import { wizardService } from "./wizard.service.js";

const CardCreateBody = Type.Object({
  pinfl: Type.String({ minLength: 14, maxLength: 14 }),
  network: Type.Union([Type.Literal("uzcard"), Type.Literal("humo")]),
});

const CardConfirmBody = Type.Object({
  plumgateSessionId: Type.String({ minLength: 1 }),
  otp: Type.String({ minLength: 4, maxLength: 6 }),
});

export async function wizardRoutes(app: FastifyInstance): Promise<void> {
  const guard = { onRequest: [app.authenticate, app.requireTenant] };

  app.post("/api/wizard/sessions", guard, async (req, reply) => {
    const { userId } = req.user as AgentJwt;
    const session = await wizardService.createSession(req.tenantId, userId);
    return reply.code(201).send(session);
  });

  app.post(
    "/api/wizard/sessions/:sessionId/card/create",
    { ...guard, schema: { body: CardCreateBody } },
    async (req, reply) => {
      const { sessionId } = req.params as { sessionId: string };
      const result = await wizardService.cardCreate(
        req.tenantId,
        sessionId,
        req.body as { pinfl: string; network: "uzcard" | "humo" },
      );
      return reply.code(200).send(result);
    },
  );

  app.post(
    "/api/wizard/sessions/:sessionId/card/confirm",
    { ...guard, schema: { body: CardConfirmBody } },
    async (req) => {
      const { sessionId } = req.params as { sessionId: string };
      return wizardService.cardConfirm(
        req.tenantId,
        sessionId,
        req.body as { plumgateSessionId: string; otp: string },
      );
    },
  );

  // SSE progress stream — streams WizardStep events until done (ADR 0010).
  app.get(
    "/api/wizard/sessions/:sessionId/progress",
    guard,
    async (req, reply: FastifyReply) => {
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const steps: WizardStep[] = [
        { key: "client", label: "Клиент", status: "succeeded", error: null },
        { key: "card", label: "Karta", status: "in_progress", error: null },
        { key: "tariff", label: "Tarif", status: "pending", error: null },
        { key: "product", label: "Mahsulot", status: "pending", error: null },
        { key: "payment_day", label: "To'lov kuni", status: "pending", error: null },
        { key: "verification", label: "Верификация", status: "pending", error: null },
        { key: "done", label: "Готово", status: "pending", error: null },
      ];

      let index = 1;
      const send = (s: WizardStep) =>
        reply.raw.write(`data: ${JSON.stringify(s)}\n\n`);

      send(steps[0]!);

      const timer = setInterval(() => {
        if (index >= steps.length) {
          clearInterval(timer);
          reply.raw.write("event: done\ndata: {}\n\n");
          reply.raw.end();
          return;
        }
        const step = { ...steps[index]!, status: "succeeded" as const };
        send(step);
        index += 1;
      }, 1500);

      req.raw.on("close", () => clearInterval(timer));
    },
  );
}
