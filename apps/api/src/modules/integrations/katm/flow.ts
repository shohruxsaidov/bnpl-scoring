/**
 * KATM consume flow orchestration (ADR-0025):
 *
 *   consent → ban pre-check → claim registration → 077 + INPS reports (parallel)
 *
 * Shared by the Wizard (Deal Session) and self-service (Scoring Session)
 * paths. When either report is async (05050) the caller enqueues BullMQ
 * polling jobs — see poller.ts. Both reports must resolve before the session
 * advances.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@db';
import { agreements } from '@db/agreements';
import { katmClaims } from '@db/katm-claims';
import { katm077Reports } from '@db/katm-077-reports';
import { katmInpsReports } from '@db/katm-inps-reports';
import { registerClaim } from './commands/register-claim/register-claim.handler';
import { request077Report } from './queries/request-077-report/request-077-report.handler';
import { requestINPSReport } from './queries/request-inps-report/request-inps-report.handler';
import type { KatmResult } from './service/shared';

// ---------------------------------------------------------------------------
// Subject — the client/user fields claim registration requires
// ---------------------------------------------------------------------------

export interface KatmSubject {
  pinfl: string;
  passportSerial: string;
  passportNumber: string;
  docType: number;
  regionCode: string;
  districtCode: string;
  address: string;
  phone: string;
}

/**
 * Validate a clients/users row against the claim-registration requirements.
 * Returns the list of missing field names (empty = OK).
 */
export function missingKatmFields(row: {
  pinfl: string | null;
  passportSeries: string | null;
  passportNumber: string | null;
  docType: number | null;
  regionCode: string | null;
  districtCode: string | null;
  address: string | null;
  phone: string | null;
}): string[] {
  const missing: string[] = [];
  if (!row.pinfl) missing.push('pinfl');
  if (!row.passportSeries) missing.push('passportSeries');
  if (!row.passportNumber) missing.push('passportNumber');
  if (row.docType == null) missing.push('docType');
  if (!row.regionCode) missing.push('regionCode');
  if (!row.districtCode) missing.push('districtCode');
  if (!row.address) missing.push('address');
  if (!row.phone) missing.push('phone');
  return missing;
}

// ---------------------------------------------------------------------------
// KATM Claim ID — one shared sequence across both session tables (ADR-0025)
// ---------------------------------------------------------------------------

export async function allocateKatmClaimId(): Promise<string> {
  const rows = await db.execute(sql`select nextval('katm_claim_seq') as id`);
  const row = (rows as unknown as Array<{ id: string | number | bigint }>)[0];
  if (!row) throw new Error('katm_claim_seq nextval returned no row');
  return String(row.id);
}

// ---------------------------------------------------------------------------
// KATM Consent — the sequence-numbered record behind pAgreementId (ADR-0025)
// ---------------------------------------------------------------------------

export interface AgreementRecord {
  /** katm_consents.id as string — sent as pAgreementId */
  agreementId: string;
  /** sent as pAgreementDate */
  agreementDate: Date;
}

export async function createKatmConsent(input: {
  channel: 'wizard' | 'self_service';
  userId?: number;
  sessionId?: string;
}): Promise<AgreementRecord> {
  const [row] = await db
    .insert(agreements)
    .values({
      channel: input.channel,
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
    })
    .returning({ id: agreements.id, createdAt: agreements.createdAt });
  if (!row) throw new Error('katm_consent_insert_failed');
  return { agreementId: row.id.toString(), agreementDate: row.createdAt };
}

// ---------------------------------------------------------------------------
// The flow itself
// ---------------------------------------------------------------------------

export type KatmFlowOutcome =
  | { status: 'banned' }
  | { status: 'ready'; katmSir: string; result: KatmResult }
  | { status: 'pending'; katmSir: string; pending077: string | null; pendingInps: string | null };

export async function startKatmFlow(input: {
  claimId: string;
  consent: AgreementRecord;
  subject: KatmSubject;
  userId: number;
  sessionId: string;
  channel: 'wizard' | 'self_service';
}): Promise<KatmFlowOutcome> {
  // Idempotency: if this claimId was already registered (e.g. retry after a
  // transient failure), skip registration and re-request both reports.
  const [existing] = await db
    .select({ katmSir: katmClaims.katmSir })
    .from(katmClaims)
    .where(eq(katmClaims.claimId, input.claimId))
    .limit(1);

  let katmSir: string;

  if (existing) {
    katmSir = existing.katmSir;
  } else {
    const claim = await registerClaim({
      claimId: input.claimId,
      agreementId: input.consent.agreementId,
      agreementDate: input.consent.agreementDate,
      pinfl: input.subject.pinfl,
      passportSeries: input.subject.passportSerial,
      passportNumber: input.subject.passportNumber,
      passportType: input.subject.docType,
      regionCode: input.subject.regionCode,
      districtCode: input.subject.districtCode,
      address: input.subject.address,
      phone: input.subject.phone,
      amount: 35000000, // in tiyin 350 000 dom
    });

    await db.insert(katmClaims).values({
      claimId: input.claimId,
      channel: input.channel,
      userId: input.userId,
      sessionId: input.sessionId,
      katmSir: claim.katmSir,
      verified: claim.verified,
    });

    katmSir = claim.katmSir;
  }

  // Request both reports in parallel — each may be sync (ready) or async (pending).
  const [report077, reportInps] = await Promise.all([
    request077Report({ claimId: input.claimId }),
    requestINPSReport({ claimId: input.claimId }),
  ]);

  // Persist 077 result or pending placeholder
  if (report077.status === 'pending') {
    await db.insert(katm077Reports).values({ claimId: input.claimId, token: report077.token });
  } else {
    const r = report077.result;
    await db.insert(katm077Reports).values({
      claimId: input.claimId,
      demandId: r.demandId,
      consentId: r.consentId,
      score: r.score,
      scoringClass: r.scoringClass,
      scoringLevel: r.scoringLevel,
      activeLoans: r.activeLoans,
      allDebtSum: r.allDebtSum,
      overdueCount: r.overdueCount,
      overdueAmount: r.overdueAmount,
      maxOverdueDays: r.maxOverdueDays,
      totalContracts: r.totalContracts,
      totalClaims: r.totalClaims,
      avgMonthlyPayment: r.avgMonthlyPayment,
      hasDefaults: r.hasDefaults,
      hasCreditBan: r.hasCreditBan,
      raw: r.raw as Record<string, unknown>,
    });
  }

  // Persist INPS result or pending placeholder
  if (reportInps.status === 'pending') {
    await db.insert(katmInpsReports).values({ claimId: input.claimId, token: reportInps.token });
  } else {
    const r = reportInps.result;
    await db.insert(katmInpsReports).values({
      claimId: input.claimId,
      demandId: r.demandId,
      incomesAllSumma: r.incomesAllSumma,
      periodBegin: r.periodBegin,
      periodEnd: r.periodEnd,
      incomes: r.incomes as unknown as Record<string, unknown>[],
      raw: r.raw as Record<string, unknown>,
    });
  }

  if (report077.status === 'pending' || reportInps.status === 'pending') {
    return {
      status: 'pending',
      katmSir,
      pending077: report077.status === 'pending' ? report077.token : null,
      pendingInps: reportInps.status === 'pending' ? reportInps.token : null,
    };
  }

  return { status: 'ready', katmSir, result: report077.result };
}
