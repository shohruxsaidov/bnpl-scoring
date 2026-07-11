import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { CONFIGURABLE_PIPELINES, isConfigurablePipeline } from "../../scoring/pipelines/config"
import {
  listPipelineSettings,
  type PipelineSetting,
} from "./queries/list-pipeline-settings/list-pipeline-settings.handler"
import { setPipelineEnabled } from "./commands/set-pipeline-enabled/set-pipeline-enabled.handler"

function serialize(p: PipelineSetting) {
  return {
    type: p.type,
    enabled: p.enabled,
    isDefault: p.isDefault,
    updatedAt: p.updatedAt?.toISOString() ?? null,
    scoringParams: p.scoringParams,
    stopFactors: p.stopFactors,
    feedsLimit: p.feedsLimit,
  }
}

export default async function adminScoringSettingsRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()

  const TAGS = ["Admin · Scoring Settings"]

  const TypeParam = Type.Object({
    type: Type.Union(CONFIGURABLE_PIPELINES.map((p) => Type.Literal(p))),
  })

  const SetEnabledBody = Type.Object({
    enabled: Type.Boolean(),
  })

  // The global ops kill-switch for every configurable pipeline. A pipeline with
  // no stored row is returned at its catalog default (isDefault: true).
  fastify.get("/pipelines", { schema: { tags: TAGS } }, async () => {
    const pipelines = await listPipelineSettings()
    return { pipelines: pipelines.map(serialize) }
  })

  fastify.put(
    "/pipelines/:type",
    { schema: { tags: TAGS, params: TypeParam, body: SetEnabledBody } },
    async (request, reply) => {
      const { type } = request.params

      // TypeBox already constrains this, but the catalog is the single source of
      // truth and a pipeline could be retired from it without the schema noticing.
      if (!isConfigurablePipeline(type)) {
        return reply.code(404).sendError("not_found")
      }

      const actorId = Number((request.user as { sub: string }).sub)
      await setPipelineEnabled({ type, enabled: request.body.enabled, actorId })

      // Re-read through the catalog so the response carries the same shape (and
      // the same param/stop-factor metadata) the list endpoint returns.
      const pipelines = await listPipelineSettings()
      const updated = pipelines.find((p) => p.type === type)!
      return { pipeline: serialize(updated) }
    },
  )
}
