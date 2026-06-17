import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { getActiveModel } from "./queries/get-active-model"
import { getScoringModel } from "./queries/get-scoring-model"
import { listScoringModels } from "./queries/list-scoring-models"
import { listModels } from "./queries/list-models"
import { getModelById } from "./queries/get-model-by-id"
import { saveModel } from "./commands/save-model"
import { createScoringModel } from "./commands/create-scoring-model"
import { setGlobalModel } from "./commands/set-global-model"
import { computeScoringModel } from "../../scoring/engine"
import type { ScoringModelData, ScoringInputs } from "../../scoring/engine"

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
  const db = app.db

  /* ── Scoring Models (ADR-0023) ──────────────────────────────────────────── */

  const ModelIdParams = Type.Object({ modelId: Type.String() })

  fastify.get("/models", async () => {
    const rows = await listScoringModels(db)
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
      const model = await createScoringModel(db, { name: request.body.name })
      return reply.code(201).send({ model: serializeScoringModel(model) })
    },
  )

  // Model + its active (latest) revision, if any.
  fastify.get(
    "/models/:modelId",
    { schema: { params: ModelIdParams } },
    async (request, reply) => {
      const model = await getScoringModel(db, parseInt(request.params.modelId, 10))
      if (!model) return reply.code(404).sendError("not_found")
      const revision = await getActiveModel(db, model.id)
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
      const model = await getScoringModel(db, parseInt(request.params.modelId, 10))
      if (!model) return reply.code(404).sendError("not_found")
      const rows = await listModels(db, model.id)
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
      const model = await getScoringModel(db, parseInt(request.params.modelId, 10))
      if (!model) return reply.code(404).sendError("not_found")
      const row = await setGlobalModel(db, model.id)
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
      const model = await getScoringModel(db, parseInt(request.params.modelId, 10))
      if (!model) return reply.code(404).sendError("not_found")
      const adminId = Number((request.user as { sub: string }).sub)
      const { name, version, params } = request.body
      const row = await saveModel(
        db,
        { scoringModelId: model.id, name, version, params: params as never },
        adminId,
      )
      return serializeRevision(row)
    },
  )

  /* ── Revision lookup & dry-run (revision ids, shared across models) ─────── */

  fastify.get(
    "/:id",
    { schema: { params: Type.Object({ id: Type.String() }) } },
    async (request, reply) => {
      const row = await getModelById(db, parseInt(request.params.id, 10))
      if (!row) return reply.code(404).sendError("not_found")
      return serializeRevision(row)
    },
  )

  const TryBody = Type.Object({
    incomeSum:                Type.Optional(Type.Number()),
    workExperienceMonths:     Type.Optional(Type.Number()),
    age:                      Type.Optional(Type.Number()),
    citizenship:              Type.Optional(Type.Union([Type.Literal("Uzbekistan"), Type.Literal("NonResident")])),
    gender:                   Type.Optional(Type.Union([Type.Literal("Male"), Type.Literal("Female")])),
    monthlyPaymentRatio:      Type.Optional(Type.Number()),
    creditHistoryContracts:   Type.Optional(Type.Number()),
    contingentLiability:      Type.Optional(Type.Number()),
    overdue30Count:           Type.Optional(Type.Number()),
    overdue30to60Count:       Type.Optional(Type.Number()),
    overdue60to90Count:       Type.Optional(Type.Number()),
    overdue90Count:           Type.Optional(Type.Number()),
    hasJuridical:             Type.Optional(Type.Boolean()),
    hasDecommission:          Type.Optional(Type.Boolean()),
    loanApplicationCount:     Type.Optional(Type.Number()),
    coBorrowerMaxDays:        Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    guarantorMaxDays:         Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    pledgerMaxDays:           Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    hasMortgage:              Type.Optional(Type.Boolean()),
    passportRegion:           Type.Optional(Type.String()),
    allDebts:                 Type.Optional(Type.Number()),
  })

  fastify.post(
    "/:id/try",
    { schema: { params: Type.Object({ id: Type.String() }), body: TryBody } },
    async (request, reply) => {
      const row = await getModelById(db, parseInt(request.params.id, 10))
      if (!row) return reply.code(404).sendError("not_found")
      const result = computeScoringModel(
        row.params as unknown as ScoringModelData,
        request.body as ScoringInputs,
      )
      return result
    },
  )
}
