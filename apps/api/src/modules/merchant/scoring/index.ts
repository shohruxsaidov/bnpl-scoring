import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { FastifyInstance } from 'fastify';
import { loadOwnedActiveSession } from '../deal-sessions/queries/load-owned-active-session/load-owned-active-session.handler';
import { users } from '@db/users';
import { eq } from 'drizzle-orm';
import { db } from '@db';
import { setSessionUserId } from '../deal-sessions/commands/set-session-user-id/set-session-user-id.handler';
import {
  allocateKatmClaimId,
  createKatmConsent,
  missingKatmFields,
  startKatmFlow,
} from '../../integrations/katm/flow';
import { setKatmClaimId } from '../deal-sessions/commands/set-katm-claim-id/set-katm-claim-id.handler';
import { enqueueKatmPoll, katmSummary, saveKatmSir } from '../../integrations/katm/poller';
import { stampKatmPending } from '../deal-sessions/commands/stamp-katm-pending/stamp-katm-pending.handler';
import { stampKatm } from '../deal-sessions/commands/stamp-katm/stamp-katm.handler';

type JwtPayload = { sub: string; merchantId: string; branchId: string; role: string };

export default async function merchantScoringRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();

  const QueryBody = Type.Object({
    userId: Type.String({ minLength: 1 }),
    dealSessionId: Type.String({ minLength: 1 }),
  });

  fastify.post(
    '/start',
    { schema: { body: QueryBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const p = request.user as JwtPayload;
      const { userId, dealSessionId } = request.body;

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
        .from(users)
        .where(eq(users.id, Number(userId)))
        .limit(1);

      if (!client) return reply.code(404).sendError('user_not_found');

      await setSessionUserId(session, client.id);

      // Claim registration needs the full subject — surface what's missing so
      // the Agent can fill the gaps manually (pre-ADR-0025 rows lack them)
      const missing = missingKatmFields(client);
      if (missing.length > 0) {
        return reply.code(422).sendError('client_katm_fields_missing', { missing });
      }

      // Sequence-numbered consent record — the auditable artifact behind
      // pAgreementId/pAgreementDate (ADR-0025)
      const consent = await createKatmConsent({
        channel: 'wizard',
        userId: client.id,
        sessionId: session.id,
      });

      // One claim per Wizard run — reuse the id if the Agent redoes the step
      const claimId = session.katmClaimId ?? (await allocateKatmClaimId());
      if (!session.katmClaimId) {
        await setKatmClaimId(session, claimId);
        session = { ...session, katmClaimId: claimId };
      }

      const outcome = await startKatmFlow({
        claimId,
        consent,
        subject: {
          pinfl: client.pinfl,
          passportSerial: client.passportSeries!,
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

      await saveKatmSir({ userId: client.id }, outcome.katmSir);

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
        userId,
        claimId,
        consentId: consent.agreementId,
        consentDate: consentDate.slice(0, 10),
        raw: outcome.result.raw ?? null,
        ...summary,
      });

      return { status: 'completed' as const, ...summary };
    },
  );
}
