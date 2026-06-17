import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listTestCases } from "./queries/list-test-cases/list-test-cases.handler"
import { listRuns } from "./queries/list-runs/list-runs.handler"
import { getRun } from "./queries/get-run/get-run.handler"
import { createTestCase } from "./commands/create-test-case/create-test-case.handler"
import { updateTestCase } from "./commands/update-test-case/update-test-case.handler"
import { deleteTestCase } from "./commands/delete-test-case/delete-test-case.handler"
import { runTestCases } from "./commands/run-test-cases/run-test-cases.handler"
import { captureRun } from "./commands/capture-run/capture-run.handler"

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

  // List all test cases
  fastify.get("/", async () => {
    const rows = await listTestCases()
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
      const row = await createTestCase({ name, description, inputs, expectedOutcome })
      return {
        id: row.id.toString(),
        name: row.name,
        description: row.description,
        inputs: row.inputs,
        expectedOutcome: row.expectedOutcome,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
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
      const id = Number(request.params.id)
      const { name, description, inputs, expectedOutcome } = request.body

      const row = await updateTestCase({ id, name, description, inputs, expectedOutcome })
      if (!row) return reply.code(404).sendError("not_found")
      return {
        id: row.id.toString(),
        name: row.name,
        description: row.description,
        inputs: row.inputs,
        expectedOutcome: row.expectedOutcome,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
    },
  )

  // Delete a test case
  fastify.delete(
    "/:id",
    { schema: { params: Type.Object({ id: Type.String() }) } },
    async (request, reply) => {
      const id = Number(request.params.id)
      const deleted = await deleteTestCase(id)
      if (!deleted) return reply.code(404).sendError("not_found")
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
      const outcome = await runTestCases(modelRevisionId)
      if (!outcome) return reply.code(404).sendError("not_found")
      const { run, passCount, failCount, results } = outcome
      return {
        id: run.id.toString(),
        modelRevisionId,
        ranAt: run.ranAt.toISOString(),
        passCount,
        failCount,
        results,
      }
    },
  )

  // List past test runs
  fastify.get("/runs", async () => {
    const rows = await listRuns()
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
      const id = Number(request.params.id)
      const row = await getRun(id)
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
      const id = Number(request.params.id)
      const captured = await captureRun(id)
      if (!captured) return reply.code(404).sendError("not_found")
      return { ok: true, captured: captured.captured }
    },
  )
}
