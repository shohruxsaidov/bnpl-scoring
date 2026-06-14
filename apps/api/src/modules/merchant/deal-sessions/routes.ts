import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { clients } from '../../id/db/schema'
import { dealSessions } from '../../deals/db/schema'
import {
  abandonSession,
  createSession,
  getActiveSession,
  isWizardStep,
  loadOwnedActiveSession,
  saveStep,
  stampPrepayment,
  type DealSessionRow,
  type SessionStepData,
} from './service'

type JwtPayload = {
  sub: string
  merchantId: string
  branchId: string
  role: string
}

function payload(request: { user: unknown }) {
  return request.user as JwtPayload
}

export default async function merchantDealSessionRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  /* ── DTO ───────────────────────────────────────────────────────────────── */

  // The resume payload: session head + the client row joined in (the head holds
  // only clientId — the clients row is the PII home, never duplicated in jsonb)
  async function toSessionDto(session: DealSessionRow) {
    let client = null
    if (session.clientId != null) {
      const [c] = await db.select().from(clients).where(eq(clients.id, session.clientId)).limit(1)
      if (c) {
        client = {
          id: c.id.toString(),
          pinfl: c.pinfl,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          birthDate: c.birthDate,
          gender: c.gender,
          nationality: c.nationality,
          passportSerial: c.passportSerial,
          passportNumber: c.passportNumber,
          photoUrl: c.photoUrl,
        }
      }
    }
    return {
      id: session.id,
      currentStep: session.currentStep,
      status: session.status,
      stepData: session.stepData,
      client,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }
  }

  const guards = [app.verifyMerchantJwt, app.requirePermission('create_deal')]

  /* ── GET /active — the agent's single active session, or null ─────────── */

  fastify.get('/active', { preHandler: guards }, async (request) => {
    const p = payload(request)
    const session = await getActiveSession(db, BigInt(p.sub))
    return { session: session ? await toSessionDto(session) : null }
  })

  /* ── POST / — open a new Wizard run (auto-supersedes the old one) ──────── */

  fastify.post('/', { preHandler: guards }, async (request, reply) => {
    const p = payload(request)
    const session = await createSession(db, {
      merchantId: BigInt(p.merchantId),
      branchId: BigInt(p.branchId),
      agentId: BigInt(p.sub),
    })
    return reply.code(201).send({ session: await toSessionDto(session) })
  })

  /* ── PUT /:id/steps/:step — blocking per-step save ─────────────────────── */

  const StepParams = Type.Object({ id: Type.String(), step: Type.String() })
  // Payload shape varies per step; validated field-by-field in the service
  const StepBody = Type.Record(Type.String(), Type.Any())

  fastify.put(
    '/:id/steps/:step',
    { schema: { params: StepParams, body: StepBody }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request)
      const { id, step } = request.params
      if (!isWizardStep(step)) return reply.code(400).sendError('invalid_step')

      try {
        const session = await loadOwnedActiveSession(db, id, BigInt(p.sub))
        const updated = await saveStep(db, session, step, request.body as Record<string, unknown>)
        return { session: await toSessionDto(updated) }
      } catch (err: any) {
        console.error(err)
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found')
        if (err.code === 'session_not_active') return reply.code(409).sendError('session_not_active')
        if (err.code === 'invalid_step_payload') return reply.code(400).sendError('invalid_step_payload')
        if (err.code === 'client_not_found') return reply.code(400).sendError('client_not_found')
        if (err.code === 'tariff_not_found') return reply.code(400).sendError('tariff_not_found')
        if (err.code === 'product_not_found') return reply.code(400).sendError('product_not_found')
        throw err
      }
    },
  )

  const IdParams = Type.Object({ id: Type.String() })

  /* ── POST /:id/prepayment — confirm a mocked acquiring flow (ADR-0026) ─── */
  //
  // The server computes the gap from session data and stamps it.  The acquiring
  // call is mocked (always succeeds) — replace the body of this handler with a
  // real processor call when one is integrated.

  const PrepaymentBody = Type.Object({
    cardNumber: Type.String(),
    expiry: Type.String(),
    phone: Type.String(),
    otp: Type.String(),
  })

  fastify.post(
    '/:id/prepayment',
    { schema: { params: IdParams, body: PrepaymentBody }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request)
      let session: DealSessionRow
      try {
        session = await loadOwnedActiveSession(db, request.params.id, BigInt(p.sub))
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found')
        if (err.code === 'session_not_active') return reply.code(409).sendError('session_not_active')
        throw err
      }

      const data = session.stepData as SessionStepData
      if (!data.products?.lines?.length) return reply.code(409).sendError('products_step_missing')
      if (!data.tariff) return reply.code(409).sendError('tariff_step_missing')
      if (!data.scoring) return reply.code(409).sendError('scoring_missing')

      // Compute gap: totalWithMarkup - effectiveLimit
      const basketBase = data.products.lines.reduce(
        (sum, l) => sum + Math.round(parseFloat(l.price) * 100) * l.quantity,
        0,
      )
      const totalWithMarkup = Math.round(basketBase * (1 + data.tariff.markupPercent / 100))
      const effectiveLimit = Math.round(data.scoring.platformCreditLimit * data.tariff.termMonths)
      const gap = totalWithMarkup - effectiveLimit

      if (gap <= 0) return reply.code(409).sendError('no_prepayment_needed')

      // Mocked acquiring — always succeeds. Replace this with a real processor call.
      await stampPrepayment(db, session, { amount: gap, confirmedAt: new Date().toISOString() })

      const [updated] = await db
        .select()
        .from(dealSessions)
        .where(eq(dealSessions.id, session.id))
        .limit(1)

      return { session: await toSessionDto(updated ?? session) }
    },
  )

  /* ── POST /:id/abandon — the wizard's close-deal action ────────────────── */

  fastify.post(
    '/:id/abandon',
    { schema: { params: IdParams }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request)
      try {
        const session = await loadOwnedActiveSession(db, request.params.id, BigInt(p.sub))
        await abandonSession(db, session)
        return { ok: true }
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found')
        // Abandoning an already-closed session is a no-op, not an error
        if (err.code === 'session_not_active') return { ok: true }
        throw err
      }
    },
  )
}
