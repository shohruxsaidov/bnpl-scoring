import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { eq, desc } from "drizzle-orm"
import { scoringTestCases, scoringTestRuns, scoringModelRevisions } from "../../../db/schema"
import { computeScoringModel } from "../../scoring/engine"
import type { ScoringModelData, ScoringInputs, ScoringResult } from "../../scoring/engine"

type ApprovalOutcome = "approved" | "partial" | "denied" | "rejected"

type PassedResult = Extract<ScoringResult, { rejected: false }>

function deriveOutcome(result: ScoringResult): ApprovalOutcome {
  if (result.rejected) return "rejected"
  const { coefficient } = result as PassedResult
  if (coefficient >= 1) return "approved"
  if (coefficient > 0) return "partial"
  return "denied"
}


const ScoringInputsSchema = Type.Object({
  incomeSum:              Type.Optional(Type.Number()),
  workExperienceMonths:   Type.Optional(Type.Number()),
  age:                    Type.Optional(Type.Number()),
  citizenship:            Type.Optional(Type.Union([Type.Literal("Uzbekistan"), Type.Literal("NonResident")])),
  gender:                 Type.Optional(Type.Union([Type.Literal("Male"), Type.Literal("Female")])),
  monthlyPaymentRatio:    Type.Optional(Type.Number()),
  creditHistoryContracts: Type.Optional(Type.Number()),
  contingentLiability:    Type.Optional(Type.Number()),
  overdue30Count:         Type.Optional(Type.Number()),
  overdue30to60Count:     Type.Optional(Type.Number()),
  overdue60to90Count:     Type.Optional(Type.Number()),
  overdue90Count:         Type.Optional(Type.Number()),
  hasJuridical:           Type.Optional(Type.Boolean()),
  hasDecommission:        Type.Optional(Type.Boolean()),
  loanApplicationCount:   Type.Optional(Type.Number()),
  coBorrowerMaxDays:      Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  guarantorMaxDays:       Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  pledgerMaxDays:         Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  hasMortgage:            Type.Optional(Type.Boolean()),
  passportRegion:         Type.Optional(Type.String()),
  allDebts:               Type.Optional(Type.Number()),
})

const OutcomeEnum = Type.Union([
  Type.Literal("approved"),
  Type.Literal("partial"),
  Type.Literal("denied"),
  Type.Literal("rejected"),
])

export default async function adminScoringTestCasesRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  // List all test cases
  fastify.get("/", async () => {
    const rows = await db
      .select()
      .from(scoringTestCases)
      .orderBy(desc(scoringTestCases.createdAt))
    return {
      testCases: rows.map((r) => ({
        id: r.id.toString(),
        name: r.name,
        description: r.description,
        inputs: r.inputs,
        expectedOutcome: r.expectedOutcome,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    }
  })

  // Create a test case
  fastify.post(
    "/",
    {
      schema: {
        body: Type.Object({
          name:            Type.String({ minLength: 1 }),
          description:     Type.Optional(Type.String()),
          inputs:          ScoringInputsSchema,
          expectedOutcome: OutcomeEnum,
        }),
      },
    },
    async (request) => {
      const { name, description, inputs, expectedOutcome } = request.body
      const [row] = await db
        .insert(scoringTestCases)
        .values({
          name,
          description: description ?? null,
          inputs: inputs as Record<string, unknown>,
          expectedOutcome,
        })
        .returning()
      return {
        id: row!.id.toString(),
        name: row!.name,
        description: row!.description,
        inputs: row!.inputs,
        expectedOutcome: row!.expectedOutcome,
        createdAt: row!.createdAt.toISOString(),
        updatedAt: row!.updatedAt.toISOString(),
      }
    },
  )

  // Update a test case
  fastify.patch(
    "/:id",
    {
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          name:            Type.Optional(Type.String({ minLength: 1 })),
          description:     Type.Optional(Type.String()),
          inputs:          Type.Optional(ScoringInputsSchema),
          expectedOutcome: Type.Optional(OutcomeEnum),
        }),
      },
    },
    async (request, reply) => {
      const id = BigInt(request.params.id)
      const { name, description, inputs, expectedOutcome } = request.body

      const existing = await db
        .select({ id: scoringTestCases.id })
        .from(scoringTestCases)
        .where(eq(scoringTestCases.id, id))
        .limit(1)
      if (!existing.length) return reply.code(404).sendError("not_found")

      const updates: Partial<typeof scoringTestCases.$inferInsert> = {
        updatedAt: new Date(),
      }
      if (name !== undefined) updates.name = name
      if (description !== undefined) updates.description = description
      if (inputs !== undefined) updates.inputs = inputs as Record<string, unknown>
      if (expectedOutcome !== undefined) updates.expectedOutcome = expectedOutcome

      const [row] = await db
        .update(scoringTestCases)
        .set(updates)
        .where(eq(scoringTestCases.id, id))
        .returning()
      return {
        id: row!.id.toString(),
        name: row!.name,
        description: row!.description,
        inputs: row!.inputs,
        expectedOutcome: row!.expectedOutcome,
        createdAt: row!.createdAt.toISOString(),
        updatedAt: row!.updatedAt.toISOString(),
      }
    },
  )

  // Delete a test case
  fastify.delete(
    "/:id",
    { schema: { params: Type.Object({ id: Type.String() }) } },
    async (request, reply) => {
      const id = BigInt(request.params.id)
      const deleted = await db
        .delete(scoringTestCases)
        .where(eq(scoringTestCases.id, id))
        .returning({ id: scoringTestCases.id })
      if (!deleted.length) return reply.code(404).sendError("not_found")
      return { ok: true }
    },
  )

  // Run all test cases against a model revision and save the run
  fastify.post(
    "/runs",
    {
      schema: {
        body: Type.Object({
          modelRevisionId: Type.Number(),
        }),
      },
    },
    async (request, reply) => {
      const { modelRevisionId } = request.body

      const [revision] = await db
        .select()
        .from(scoringModelRevisions)
        .where(eq(scoringModelRevisions.id, modelRevisionId))
        .limit(1)
      if (!revision) return reply.code(404).sendError("not_found")

      const cases = await db.select().from(scoringTestCases).orderBy(scoringTestCases.id)

      const model = revision.params as unknown as ScoringModelData
      const results = cases.map((tc) => {
        const engineResult = computeScoringModel(model, tc.inputs as ScoringInputs)
        const actualOutcome = deriveOutcome(engineResult)
        const pass = actualOutcome === tc.expectedOutcome
        if (engineResult.rejected) {
          return {
            testCaseId: tc.id.toString(),
            name: tc.name,
            expectedOutcome: tc.expectedOutcome,
            actualOutcome,
            pass,
            totalScore: null,
            coefficient: null,
            stopFactor: engineResult.stopFactor,
            breakdown: null,
          }
        }
        const passed = engineResult as PassedResult
        return {
          testCaseId: tc.id.toString(),
          name: tc.name,
          expectedOutcome: tc.expectedOutcome,
          actualOutcome,
          pass,
          totalScore: passed.totalScore,
          coefficient: passed.coefficient,
          stopFactor: null,
          breakdown: passed.breakdown,
        }
      })

      const passCount = results.filter((r) => r.pass).length
      const failCount = results.length - passCount

      const [run] = await db
        .insert(scoringTestRuns)
        .values({
          modelRevisionId,
          passCount,
          failCount,
          results: results as unknown as Record<string, unknown>[],
        })
        .returning()

      return {
        id: run!.id.toString(),
        modelRevisionId,
        ranAt: run!.ranAt.toISOString(),
        passCount,
        failCount,
        results,
      }
    },
  )

  // List past test runs
  fastify.get("/runs", async () => {
    const rows = await db
      .select({
        id: scoringTestRuns.id,
        modelRevisionId: scoringTestRuns.modelRevisionId,
        ranAt: scoringTestRuns.ranAt,
        passCount: scoringTestRuns.passCount,
        failCount: scoringTestRuns.failCount,
      })
      .from(scoringTestRuns)
      .orderBy(desc(scoringTestRuns.ranAt))
    return {
      runs: rows.map((r) => ({
        id: r.id.toString(),
        modelRevisionId: r.modelRevisionId,
        ranAt: r.ranAt.toISOString(),
        passCount: r.passCount,
        failCount: r.failCount,
      })),
    }
  })

  // Get a single run with full per-case results
  fastify.get(
    "/runs/:id",
    { schema: { params: Type.Object({ id: Type.String() }) } },
    async (request, reply) => {
      const id = BigInt(request.params.id)
      const [row] = await db
        .select()
        .from(scoringTestRuns)
        .where(eq(scoringTestRuns.id, id))
        .limit(1)
      if (!row) return reply.code(404).sendError("not_found")
      return {
        id: row.id.toString(),
        modelRevisionId: row.modelRevisionId,
        ranAt: row.ranAt.toISOString(),
        passCount: row.passCount,
        failCount: row.failCount,
        results: row.results,
      }
    },
  )

  // Capture: save actual outcomes from a run as new expected outcomes (baseline)
  fastify.post(
    "/runs/:id/capture",
    { schema: { params: Type.Object({ id: Type.String() }) } },
    async (request, reply) => {
      const id = BigInt(request.params.id)
      const [run] = await db
        .select()
        .from(scoringTestRuns)
        .where(eq(scoringTestRuns.id, id))
        .limit(1)
      if (!run) return reply.code(404).sendError("not_found")

      const results = run.results as Array<{ testCaseId: string; actualOutcome: ApprovalOutcome }>
      await Promise.all(
        results.map(({ testCaseId, actualOutcome }) =>
          db
            .update(scoringTestCases)
            .set({ expectedOutcome: actualOutcome, updatedAt: new Date() })
            .where(eq(scoringTestCases.id, BigInt(testCaseId))),
        ),
      )

      return { ok: true, captured: results.length }
    },
  )
}
