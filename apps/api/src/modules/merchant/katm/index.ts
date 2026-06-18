import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { eq } from 'drizzle-orm';
import { clients } from '@db/schema';
import {
  allocateKatmClaimId,
  createKatmConsent,
  missingKatmFields,
  startKatmFlow,
} from '../../integrations/katm/flow';
import { enqueueKatmPoll, katmSummary, saveKatmSir } from '../../integrations/katm/poller';
import {
  loadOwnedActiveSession,
  setKatmClaimId,
  setSessionClientId,
  stampKatm,
  stampKatmPending,
  type SessionStepData,
} from '../deal-sessions/service/service.handler';

type JwtPayload = { sub: string; merchantId: string; branchId: string; role: string };

export default async function merchantKatmRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const db = app.db;

  const QueryBody = Type.Object({
    clientId: Type.String({ minLength: 1 }),
    dealSessionId: Type.String({ minLength: 1 }),
  });

  /**
   * POST /merchant/katm/query
   * Runs the KATM consume flow for the given client (ADR-0025):
   * consent record → ban pre-check → claim registration → report request.
   * The KATM Claim ID (shared sequence) is stamped on the Deal Session; the
   * report result (incl. raw payload) is stamped when it arrives — directly
   * on a synchronous answer, or via the BullMQ poller when KATM answers 05050.
   *
   * Responses: { status: 'completed', ...summary } | { status: 'pending' }
   *          | { status: 'banned' }
   */
  fastify.post(
    '/query',
    { schema: { body: QueryBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const p = request.user as JwtPayload;
      const { clientId, dealSessionId } = request.body;

      let session;
      try {
        session = await loadOwnedActiveSession(dealSessionId, Number(p.sub));
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        if (err.code === 'session_not_active')
          return reply.code(409).sendError('session_not_active');
        throw err;
      }

      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, Number(clientId)))
        .limit(1);

      if (!client) return reply.code(404).sendError('client_not_found');

      await setSessionClientId(session, client.id);

      // Claim registration needs the full subject — surface what's missing so
      // the Agent can fill the gaps manually (pre-ADR-0025 rows lack them)
      const missing = missingKatmFields(client);
      if (missing.length > 0) {
        return reply.code(422).sendError('client_katm_fields_missing', { missing });
      }

      // Sequence-numbered consent record — the auditable artifact behind
      // pAgreementId/pAgreementDate (ADR-0025)
      const consent = await createKatmConsent(db, {
        channel: 'wizard',
        clientId: client.id,
        sessionId: session.id,
      });

      // One claim per Wizard run — reuse the id if the Agent redoes the step
      const claimId = session.katmClaimId ?? (await allocateKatmClaimId(db));
      if (!session.katmClaimId) {
        await setKatmClaimId(session, claimId);
        session = { ...session, katmClaimId: claimId };
      }

      const outcome = await startKatmFlow(db, {
        claimId,
        consent,
        subject: {
          pinfl: client.pinfl,
          passportSerial: client.passportSerial!,
          passportNumber: client.passportNumber!,
          docType: client.docType!,
          regionCode: client.regionCode!,
          districtCode: client.districtCode!,
          address: client.address!,
          phone: client.phone,
        },
      });

      if (outcome.status === 'banned') {
        await stampKatmPending(session, {
          status: 'failed',
          startedAt: new Date().toISOString(),
          error: 'credit_ban',
        });
        return reply.code(409).sendError('client_credit_banned');
      }

      await saveKatmSir(db, { clientId: client.id }, outcome.katmSir);

      const consentDate = consent.agreementDate.toISOString();

      if (outcome.status === 'pending') {
        await stampKatmPending(session, {
          status: 'pending',
          startedAt: new Date().toISOString(),
        });
        await enqueueKatmPoll(app.katmPollQueue, {
          flow: 'wizard',
          sessionId: session.id,
          claimId,
          token: outcome.token,
          consentId: consent.agreementId,
          consentDate,
        });
        return { status: 'pending' as const };
      }

      const summary = katmSummary(outcome.result);
      await stampKatm(session, {
        clientId,
        claimId,
        consentId: consent.agreementId,
        consentDate: consentDate.slice(0, 10),
        raw: outcome.result.raw ?? null,
        ...summary,
      });

      return { status: 'completed' as const, ...summary };
    },
  );

  /**
   * GET /merchant/katm/status?dealSessionId=…
   * Resume/polling endpoint for the async-report path. The frontend checks
   * this (or listens for the katm.completed SSE event) while the BullMQ
   * poller waits on KATM.
   */
  fastify.get(
    '/status',
    {
      schema: { querystring: Type.Object({ dealSessionId: Type.String({ minLength: 1 }) }) },
      preHandler: app.verifyMerchantJwt,
    },
    async (request, reply) => {
      const p = request.user as JwtPayload;

      let session;
      try {
        session = await loadOwnedActiveSession(request.query.dealSessionId, Number(p.sub));
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        if (err.code === 'session_not_active')
          return reply.code(409).sendError('session_not_active');
        throw err;
      }

      const data = (session.stepData ?? {}) as SessionStepData;
      if (data.katm) {
        const {
          raw: _raw,
          clientId: _c,
          claimId: _cl,
          consentId: _ci,
          consentDate: _cd,
          ...summary
        } = data.katm;
        return { status: 'completed' as const, ...summary };
      }
      if (data.katmPending) {
        return { status: data.katmPending.status, error: data.katmPending.error ?? null };
      }
      return { status: 'none' as const };
    },
  );
}
