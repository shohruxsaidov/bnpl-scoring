import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listAdminDeals } from "./queries/list-deals/list-deals.handler"
import { getAdminDeal } from "./queries/get-deal/get-deal.handler"
import { listDealComments } from "./queries/list-deal-comments/list-deal-comments.handler"
import { createDealComment } from "./commands/create-deal-comment/create-deal-comment.handler"
import { createDealReceipt } from "./commands/create-deal-receipt/create-deal-receipt.handler"

const TAGS = ["Admin · Deals"]

export default async function adminDealRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const preHandler = app.verifyAdminJwt

  const ListQuery = Type.Object({
    status: Type.Optional(Type.String()),
    merchantId: Type.Optional(Type.String()),
  })

  const IdParams = Type.Object({ id: Type.String() })

  const CreateCommentBody = Type.Object({
    text: Type.String({ minLength: 1, maxLength: 2000 }),
  })

  fastify.get("/", { schema: { tags: TAGS, querystring: ListQuery }, preHandler }, async (request) => {
    const { status, merchantId } = request.query
    const deals = await listAdminDeals({
      status: status || undefined,
      merchantId: merchantId ? Number(merchantId) : undefined,
    })
    return { deals }
  })

  fastify.get("/:id", { schema: { tags: TAGS, params: IdParams }, preHandler }, async (request, reply) => {
    const deal = await getAdminDeal(request.params.id)
    if (!deal) return reply.code(404).sendError("not_found")
    return { deal }
  })

  fastify.get("/:id/comments", { schema: { tags: TAGS, params: IdParams }, preHandler }, async (request) => {
    const comments = await listDealComments(request.params.id)
    return { comments }
  })

  fastify.post(
    "/:id/comments",
    { schema: { tags: TAGS, params: IdParams, body: CreateCommentBody }, preHandler },
    async (request, reply) => {
      const adminUserId = Number((request.user as { sub: string }).sub)
      const comment = await createDealComment({
        dealId: request.params.id,
        adminUserId,
        text: request.body.text,
      })
      return reply.code(201).send({ comment })
    },
  )

  // Guarded more tightly than the rest of this plugin: the plugin-level write
  // grant is manage_payments, which is too broad for filing a fiscal document.
  const RECEIPT_STATUS_CODES: Record<string, number> = {
    deal_not_found: 404,
    invalid_deal_status: 409,
    receipt_already_exists: 409,
    receipt_pending: 409,
    deal_has_no_items: 422,
    missing_mxik_code: 422,
    label_count_mismatch: 422,
    amount_mismatch: 422,
  }

  fastify.post(
    "/:id/receipt",
    {
      schema: { tags: TAGS, params: IdParams },
      preHandler: [preHandler, app.requirePermissionByMethod({ write: "create_deal_receipt" })],
    },
    async (request, reply) => {
      try {
        const receipt = await createDealReceipt(request.params.id)
        return reply.code(201).send({ receipt })
      } catch (err) {
        const code = (err as { code?: string }).code
        const status = code ? RECEIPT_STATUS_CODES[code] : undefined
        if (status && code) return reply.code(status).sendError(code)
        // Anything else is an EPOS/transport failure — details are in
        // integration_logs, and the pending row (if any) is already cleaned up.
        request.log.error({ err, dealId: request.params.id }, "epos receipt failed")
        return reply.code(502).sendError("receipt_failed")
      }
    },
  )
}
