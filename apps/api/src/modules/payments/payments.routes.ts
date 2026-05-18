import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { paymentsService } from "./payments.service.js";

const WebhookBody = Type.Object({
  transactionId: Type.String({ minLength: 1 }),
  dealId: Type.String(),
  amount: Type.Integer({ minimum: 0 }),
  provider: Type.String(),
});

export async function paymentsRoutes(app: FastifyInstance): Promise<void> {
  const guard = { onRequest: [app.authenticate, app.requireTenant] };

  app.get("/api/payments", guard, async (req) => {
    const data = await paymentsService.list(req.tenantId);
    return { data, total: data.length, page: 1, pageSize: data.length };
  });

  // Provider webhook — tenant resolved from signed token on the callback URL.
  app.post(
    "/api/payments/webhook",
    { ...guard, schema: { body: WebhookBody } },
    async (req) => {
      const body = req.body as {
        transactionId: string;
        dealId: string;
        amount: number;
        provider: string;
      };
      const result = await paymentsService.handleWebhook(req.tenantId, body);
      return result;
    },
  );
}
