import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { getActiveModel } from "./queries/get-active-model/get-active-model.handler"
import { getScoringModel } from "./queries/get-scoring-model/get-scoring-model.handler"
import { listScoringModels } from "./queries/list-scoring-models/list-scoring-models.handler"
import { listModels } from "./queries/list-models/list-models.handler"
import { getModelById } from "./queries/get-model-by-id/get-model-by-id.handler"
import { saveModel } from "./commands/save-model/save-model.handler"
import { createScoringModel } from "./commands/create-scoring-model/create-scoring-model.handler"
import { setGlobalModel } from "./commands/set-global-model/set-global-model.handler"

function serializeRevision(row: NonNullable<Awaited<ReturnType<typeof getActiveModel>>>) {
  return {
    id: row.id,
    scoringModelId: row.scoringModelId,
    name: row.name,
    version: row.version,
    params: row.params,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeScoringModel(row: NonNullable<Awaited<ReturnType<typeof getScoringModel>>>) {
  return {
    id: row.id,
    name: row.name,
    isGlobal: row.isGlobal,
    createdAt: row.createdAt.toISOString(),
  }
}

export default async function adminScoringModelRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()

  /* ── Scoring Models (ADR-0023) ──────────────────────────────────────────── */

  const ModelIdParams = Type.Object({ modelId: Type.String() })

  fastify.get("/models", async () => {
    const rows = await listScoringModels()
    return {
      models: rows.map((m) => ({
        id: m.id,
        name: m.name,
        isGlobal: m.isGlobal,
        merchantCount: m.merchantCount,
        revisionCount: m.revisionCount,
        createdAt: m.createdAt.toISOString(),
      })),
    }
  })

  fastify.post(
    "/models",
    { schema: { body: Type.Object({ name: Type.String({ minLength: 1 }) }) } },
    async (request, reply) => {
      const model = await createScoringModel({ name: request.body.name })
      return reply.code(201).send({ model: serializeScoringModel(model) })
    },
  )

  // Model + its active (latest) revision, if any.
  fastify.get(
    "/models/:modelId",
    { schema: { params: ModelIdParams } },
    async (request, reply) => {
      const model = await getScoringModel(parseInt(request.params.modelId, 10))
      if (!model) return reply.code(404).sendError("not_found")
      const revision = await getActiveModel(model.id)
      return {
        model: serializeScoringModel(model),
        activeRevision: revision ? serializeRevision(revision) : null,
      }
    },
  )

  fastify.get(
    "/models/:modelId/history",
    { schema: { params: ModelIdParams } },
    async (request, reply) => {
      const model = await getScoringModel(parseInt(request.params.modelId, 10))
      if (!model) return reply.code(404).sendError("not_found")
      const rows = await listModels(model.id)
      return {
        revisions: rows.map((r) => ({
          id: r.id,
          name: r.name,
          version: r.version,
          createdAt: r.createdAt.toISOString(),
        })),
      }
    },
  )

  // Atomic Global Model switch: marking this model unmarks the previous holder.
  fastify.post(
    "/models/:modelId/global",
    { schema: { params: ModelIdParams } },
    async (request, reply) => {
      const model = await getScoringModel(parseInt(request.params.modelId, 10))
      if (!model) return reply.code(404).sendError("not_found")
      const row = await setGlobalModel(model.id)
      return { model: serializeScoringModel(row) }
    },
  )

  const SaveBody = Type.Object({
    name:    Type.String({ minLength: 1 }),
    version: Type.String({ minLength: 1 }),
    params:  Type.Record(Type.String(), Type.Unknown()),
  })

  // Save a new revision under a model; it becomes the model's active revision.
  fastify.put(
    "/models/:modelId",
    { schema: { params: ModelIdParams, body: SaveBody } },
    async (request, reply) => {
      const model = await getScoringModel(parseInt(request.params.modelId, 10))
      if (!model) return reply.code(404).sendError("not_found")
      const adminId = Number((request.user as { sub: string }).sub)
      const { name, version, params } = request.body
      const row = await saveModel({
        scoringModelId: model.id,
        name,
        version,
        params: params as never,
        createdBy: adminId,
      })
      return serializeRevision(row)
    },
  )

  /* ── Revision lookup (revision ids, shared across models) ─────── */

  fastify.get(
    "/:id",
    { schema: { params: Type.Object({ id: Type.String() }) } },
    async (request, reply) => {
      const row = await getModelById(parseInt(request.params.id, 10))
      if (!row) return reply.code(404).sendError("not_found")
      return serializeRevision(row)
    },
  )
}
