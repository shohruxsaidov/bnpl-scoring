import { eq, sql } from 'drizzle-orm';
import { db } from '@db';
import { env } from '@env';
import { agreements } from '@db/agreements';
import { katmClaims } from '@db/katm-claims';
import { katm077Reports } from '@db/katm-077-reports';
import { katmMibReports } from '@db/katm-mib-reports';
import { katmInpsReports } from '@db/katm-inps-reports';
import { registerClaim } from './commands/register-claim/register-claim.handler';
import { requestMibReport } from './queries/request-mib-report/request-mib-report.handler';
import { request077Report } from './queries/request-077-report/request-077-report.handler';
import { requestINPSReport } from './queries/request-inps-report/request-inps-report.handler';
import {
  KatmOneIdLockedError,
  MIB_PASS_CODES,
  type InpsResult,
  type KatmResult,
  type MibResult,
} from './service/shared';
import {
  evaluateKatm077,
  evaluateKatmInps,
  evaluateKatmMib,
  evaluateMyid,
  type MyidSubject,
} from '../../scoring/pipelines/registry';
import {
  markError,
  markGatesPassed,
  markRejected,
  recordPipeline,
  setCurrentPipeline,
} from '../../scoring/pipelines/store';
import type { MyidSummary, RejectReasonCode } from '../../scoring/pipelines/types';

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
  gender: 1 | 2; // 1 => male, 2 => female (users.gender)
  citizenShipId: string; // KATM/MyID citizenship code — '182' = Uzbekistan
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
  userId?: number;
  sessionId?: string;
}): Promise<AgreementRecord> {
  const [row] = await db
    .insert(agreements)
    .values({
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
    })
    .returning({ id: agreements.id, createdAt: agreements.createdAt });
  if (!row) throw new Error('katm_consent_insert_failed');
  return { agreementId: row.id.toString(), agreementDate: row.createdAt };
}

// ---------------------------------------------------------------------------
// The flow itself — sequential, scoring-aware (ADR-0025 + scoring pipelines)
//
// Cost short-circuit: 077 is fetched and evaluated first; INPS is requested
// ONLY if 077 passes its stop-factors. Each report may resolve synchronously
// ('ready') or asynchronously ('pending' → BullMQ poll). The scoring_pipelines
// rows and the scorings rollup are written through the scoring store as the
// chain advances. registerClaim is free; the 077/INPS report fetches are the
// chargeable calls.
// ---------------------------------------------------------------------------

/** What the caller (the /start endpoint or the poll worker) must do next. */
export type PipelineStepResult =
  // A chargeable report went async — enqueue its poll.
  | { kind: 'enqueue_poll'; reportType: '077' | 'inps' | 'mib'; token: string }
  // A stop-factor knocked out — scorings already marked 'rejected'. For a
  // data_missing myid knockout, the full absent-field list rides along so the
  // client can fix everything in one pass.
  | { kind: 'rejected'; reasonCode: RejectReasonCode; missingFields?: string[] }
  // A technical/needs-review failure (e.g. an unmapped MIB code) — scorings
  // marked 'error'. NOT a business reject: the session is failed but not closed,
  // so the run can be retried once the integration gap is resolved.
  | { kind: 'failed'; reason: string }
  // All KATM gates passed — scorings already marked 'passed' (model may run).
  | { kind: 'gates_passed' };

const CREDIT_AMOUNT_TIYIN = 35000000; // 350 000 so'm

/**
 * Run the pre-model pipeline chain for a scoring run, in cost-ascending order:
 *   myid (free, on-hand data) → katm_claim (free registration) → 077 → INPS.
 * Each stage writes its scoring_pipelines row; the first knockout short-circuits.
 * Idempotent on claimId for retries. The async poll worker re-enters mid-chain
 * via evaluate077 / evaluateInps when a chargeable report resolves later.
 */
export async function runScoringPipeline(input: {
  scoringId: number;
  claimId: string;
  consent: AgreementRecord;
  subject: KatmSubject & { birthDate: string | null };
  userId: number;
  sessionId: string;
}): Promise<PipelineStepResult> {
  // --- Pipeline 1: myid — validate the MyID-sourced fields already on hand ---
  await setCurrentPipeline(input.scoringId, 'myid');
  const myidSubject: MyidSubject = {
    birthDate: input.subject.birthDate,
    address: input.subject.address,
    pinfl: input.subject.pinfl,
    passportSeries: input.subject.passportSerial,
    passportNumber: input.subject.passportNumber,
    docType: input.subject.docType,
    regionCode: input.subject.regionCode,
    districtCode: input.subject.districtCode,
    phone: input.subject.phone,
    gender: input.subject.gender,
    citizenShipId: input.subject.citizenShipId,
  };
  const myidEv = evaluateMyid(myidSubject, new Date());
  if (myidEv.status === 'rejected') {
    const summary = myidEv.summary as MyidSummary;
    await recordPipeline(input.scoringId, 'myid', {
      status: 'rejected',
      rejectReasonCode: myidEv.rejectReasonCode,
      summary,
      raw: myidEv.raw,
    });
    await markRejected(input.scoringId, myidEv.rejectReasonCode);
    return {
      kind: 'rejected',
      reasonCode: myidEv.rejectReasonCode,
      missingFields: summary.missingFields,
    };
  }
  await recordPipeline(input.scoringId, 'myid', {
    status: 'passed',
    summary: myidEv.status === 'passed' ? myidEv.summary : null,
    raw: myidEv.status === 'passed' ? myidEv.raw : null,
  });

  // --- Pipeline 2: katm_claim — register the shared claim (free, idempotent) ---
  await setCurrentPipeline(input.scoringId, 'katm_claim');
  const [existing] = await db
    .select({ katmSir: katmClaims.katmSir })
    .from(katmClaims)
    .where(eq(katmClaims.claimId, input.claimId))
    .limit(1);

  if (existing) {
    await recordPipeline(input.scoringId, 'katm_claim', {
      status: 'passed',
      summary: { claimId: input.claimId, katmSir: existing.katmSir },
    });
  } else {
    let claim;
    try {
      claim = await registerClaim({
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
        amount: CREDIT_AMOUNT_TIYIN,
      });
    } catch (err) {
      if (err instanceof KatmOneIdLockedError) {
        await recordPipeline(input.scoringId, 'katm_claim', {
          status: 'rejected',
          rejectReasonCode: 'oneid_locked',
          raw: { message: err.message },
        });
        await markRejected(input.scoringId, 'oneid_locked');
        return { kind: 'rejected', reasonCode: 'oneid_locked' };
      }
      await recordPipeline(input.scoringId, 'katm_claim', {
        status: 'error',
        raw: { message: err instanceof Error ? err.message : String(err) },
      });
      await markError(input.scoringId);
      throw err;
    }

    await db.insert(katmClaims).values({
      claimId: input.claimId,
      userId: input.userId,
      sessionId: input.sessionId,
      katmSir: claim.katmSir,
      verified: claim.verified,
    });
    await recordPipeline(input.scoringId, 'katm_claim', {
      status: 'passed',
      summary: { claimId: input.claimId, katmSir: claim.katmSir },
      raw: claim.verified,
    });
  }
  return requestMib({ scoringId: input.scoringId, claimId: input.claimId });
}

/** Pipeline (flag-gated) — request the chargeable MIB (315) report, then evaluate. */
export async function requestMib(input: {
  scoringId: number;
  claimId: string;
}): Promise<PipelineStepResult> {
  await setCurrentPipeline(input.scoringId, 'katm_mib');
  const report = await requestMibReport({ claimId: input.claimId });

  if (report.status === 'pending') {
    await db
      .insert(katmMibReports)
      .values({ claimId: input.claimId, token: report.token, status: 'created' })
      .onConflictDoNothing();
    await recordPipeline(input.scoringId, 'katm_mib', { status: 'pending' });
    return { kind: 'enqueue_poll', reportType: 'mib', token: report.token };
  }

  await persistMibReady(input.claimId, report.result);
  return evaluateMib(input.scoringId, input.claimId, report.result);
}

/**
 * Evaluate a resolved MIB report. On a clean (204) result, chains forward to the
 * chargeable 077 request. A confirmed "enforcement found" code rejects; an
 * unmapped code fails the run for review (never an auto-reject). Called by
 * requestMib (sync path) and the poll worker.
 */
export async function evaluateMib(
  scoringId: number,
  claimId: string,
  result: MibResult,
): Promise<PipelineStepResult> {
  const ev = evaluateKatmMib(result);
  if (ev.status === 'rejected') {
    await recordPipeline(scoringId, 'katm_mib', {
      status: 'rejected',
      rejectReasonCode: ev.rejectReasonCode,
      summary: ev.summary,
      raw: ev.raw,
    });
    await markRejected(scoringId, ev.rejectReasonCode);
    return { kind: 'rejected', reasonCode: ev.rejectReasonCode };
  }
  if (ev.status === 'error') {
    await recordPipeline(scoringId, 'katm_mib', {
      status: 'error',
      summary: ev.summary ?? null,
      raw: ev.raw,
    });
    await markError(scoringId);
    return { kind: 'failed', reason: `mib_unmapped_code:${result.resultCode}` };
  }
  // passed (clean) → only now do we pay for 077
  await recordPipeline(scoringId, 'katm_mib', {
    status: 'passed',
    summary: ev.status === 'passed' ? ev.summary : null,
    raw: ev.status === 'passed' ? ev.raw : null,
  });
  return request077({ scoringId, claimId });
}

/** Pipeline 2 — request the chargeable 077 report, then evaluate it. */
export async function request077(input: {
  scoringId: number;
  claimId: string;
}): Promise<PipelineStepResult> {
  await setCurrentPipeline(input.scoringId, 'katm_077');
  const report = await request077Report({ claimId: input.claimId });

  if (report.status === 'pending') {
    await db
      .insert(katm077Reports)
      .values({ claimId: input.claimId, token: report.token, status: 'created' })
      .onConflictDoNothing();
    await recordPipeline(input.scoringId, 'katm_077', { status: 'pending' });
    return { kind: 'enqueue_poll', reportType: '077', token: report.token };
  }

  await persist077Ready(input.claimId, report.result);
  return evaluate077(input.scoringId, input.claimId, report.result);
}

/**
 * Evaluate a resolved 077 report against its stop-factors. On pass, chains to
 * the INPS request. Called by request077 (sync path) and the poll worker.
 */
export async function evaluate077(
  scoringId: number,
  claimId: string,
  result: KatmResult,
): Promise<PipelineStepResult> {
  const ev = evaluateKatm077(result);
  if (ev.status === 'rejected') {
    await recordPipeline(scoringId, 'katm_077', {
      status: 'rejected',
      rejectReasonCode: ev.rejectReasonCode,
      summary: ev.summary,
      raw: ev.raw,
    });
    await markRejected(scoringId, ev.rejectReasonCode);
    return { kind: 'rejected', reasonCode: ev.rejectReasonCode };
  }
  // passed → only now do we pay for INPS
  await recordPipeline(scoringId, 'katm_077', {
    status: 'passed',
    summary: ev.status === 'passed' ? ev.summary : null,
    raw: ev.status === 'passed' ? ev.raw : null,
  });
  return requestInps(scoringId, claimId);
}

/** Pipeline 3 — request the chargeable INPS report, then evaluate it. */
export async function requestInps(scoringId: number, claimId: string): Promise<PipelineStepResult> {
  await setCurrentPipeline(scoringId, 'katm_inps');
  const report = await requestINPSReport({ claimId });

  if (report.status === 'pending') {
    await db
      .insert(katmInpsReports)
      .values({ claimId, token: report.token, status: 'created' })
      .onConflictDoNothing();
    await recordPipeline(scoringId, 'katm_inps', { status: 'pending' });
    return { kind: 'enqueue_poll', reportType: 'inps', token: report.token };
  }

  await persistInpsReady(claimId, report.result);
  return evaluateInps(scoringId, report.result);
}

/**
 * Evaluate a resolved INPS report against its stop-factors. On pass, the KATM
 * gates are cleared and the run is marked 'passed' (model-ready).
 */
export async function evaluateInps(
  scoringId: number,
  result: InpsResult,
): Promise<PipelineStepResult> {
  const ev = evaluateKatmInps(result);
  if (ev.status === 'rejected') {
    await recordPipeline(scoringId, 'katm_inps', {
      status: 'rejected',
      rejectReasonCode: ev.rejectReasonCode,
      summary: ev.summary,
      raw: ev.raw,
    });
    await markRejected(scoringId, ev.rejectReasonCode);
    return { kind: 'rejected', reasonCode: ev.rejectReasonCode };
  }
  await recordPipeline(scoringId, 'katm_inps', {
    status: 'passed',
    summary: ev.status === 'passed' ? ev.summary : null,
    raw: ev.status === 'passed' ? ev.raw : null,
  });
  await markGatesPassed(scoringId);
  return { kind: 'gates_passed' };
}

// --- report persistence (ready path) ----------------------------------------

async function persist077Ready(claimId: string, r: KatmResult): Promise<void> {
  await db
    .insert(katm077Reports)
    .values({
      claimId,
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
      hasJuridical: r.hasJuridical,
      hasDecommission: r.hasDecommission,
      overdue30Count: r.overdue30Count,
      overdue30to60Count: r.overdue30to60Count,
      overdue60to90Count: r.overdue60to90Count,
      overdue90Count: r.overdue90Count,
      raw: r.raw as Record<string, unknown>,
      status: 'completed',
    })
    .onConflictDoNothing();
}

async function persistMibReady(claimId: string, r: MibResult): Promise<void> {
  await db
    .insert(katmMibReports)
    .values({
      claimId,
      resultCode: r.resultCode,
      resultMessage: r.resultMessage,
      passed: MIB_PASS_CODES.includes(r.resultCode as (typeof MIB_PASS_CODES)[number]),
      raw: r.raw as Record<string, unknown>,
      status: 'completed',
    })
    .onConflictDoNothing();
}

async function persistInpsReady(claimId: string, r: InpsResult): Promise<void> {
  await db
    .insert(katmInpsReports)
    .values({
      claimId,
      demandId: r.demandId,
      incomesAllSumma: r.incomesAllSumma,
      periodBegin: r.periodBegin,
      periodEnd: r.periodEnd,
      incomes: r.incomes as unknown as Record<string, unknown>[],
      raw: r.raw as Record<string, unknown>,
      status: 'completed',
    })
    .onConflictDoNothing();
}
