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
  evaluateActiveDeal,
  evaluateKatm077,
  evaluateKatmInps,
  evaluateKatmMib,
  evaluateMyid,
  type MyidSubject,
} from '../../scoring/pipelines/registry';
import { isPipelineEnabled } from '../../scoring/pipelines/settings';
import { loadBlockingDeal } from '../../deals/blocking';
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
  // deal_sessions.id for merchant runs; omitted for client self-scoring runs.
  sessionId?: string;
}): Promise<PipelineStepResult> {
  console.log(
    '[PIPELINE] runScoringPipeline START scoringId=',
    input.scoringId,
    'claimId=',
    input.claimId,
    'userId=',
    input.userId,
    'sessionId=',
    input.sessionId,
  );
  // --- Pipeline 0: active_deal — the client's one deal slot must be free ------
  // Cheapest gate there is: one indexed read of our own deals table, ahead of
  // even myid. Ops can stand the rule down from the admin panel; the createDeal
  // guard and its unique index do not depend on this flag.
  if (await isPipelineEnabled('active_deal')) {
    console.log('[PIPELINE:active_deal] setCurrentPipeline → active_deal');
    await setCurrentPipeline(input.scoringId, 'active_deal');
    const blocking = await loadBlockingDeal(input.userId);
    const activeDealEv = evaluateActiveDeal(blocking);
    console.log('[PIPELINE:active_deal] evaluateActiveDeal →', activeDealEv.status);
    if (activeDealEv.status === 'rejected') {
      await recordPipeline(input.scoringId, 'active_deal', {
        status: 'rejected',
        rejectReasonCode: 'active_deal_exists',
        summary: activeDealEv.summary,
        raw: activeDealEv.raw,
      });
      await markRejected(input.scoringId, 'active_deal_exists');
      console.log('[PIPELINE:active_deal] REJECTED blockingDeal=', blocking?.dealNumber);
      return { kind: 'rejected', reasonCode: 'active_deal_exists' };
    }
    await recordPipeline(input.scoringId, 'active_deal', {
      status: 'passed',
      summary: activeDealEv.status === 'passed' ? activeDealEv.summary : null,
      raw: null,
    });
    console.log('[PIPELINE:active_deal] PASSED');
  }

  // --- Pipeline 1: myid — validate the MyID-sourced fields already on hand ---
  console.log('[PIPELINE:myid] setCurrentPipeline → myid');
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
  console.log('[PIPELINE:myid] subject:', JSON.stringify(myidSubject));
  const myidEv = evaluateMyid(myidSubject, new Date());
  console.log(
    '[PIPELINE:myid] evaluateMyid →',
    myidEv.status,
    myidEv.status === 'rejected' ? `reasonCode=${myidEv.rejectReasonCode}` : '',
  );
  if (myidEv.status === 'rejected') {
    const summary = myidEv.summary as MyidSummary;
    await recordPipeline(input.scoringId, 'myid', {
      status: 'rejected',
      rejectReasonCode: myidEv.rejectReasonCode,
      summary,
      raw: myidEv.raw,
    });
    await markRejected(input.scoringId, myidEv.rejectReasonCode);
    console.log(
      '[PIPELINE:myid] REJECTED reasonCode=',
      myidEv.rejectReasonCode,
      'missingFields=',
      summary.missingFields,
    );
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
  console.log('[PIPELINE:myid] PASSED');

  // --- Pipeline 2: katm_claim — register the shared claim (free, idempotent) ---
  console.log(
    '[PIPELINE:katm_claim] setCurrentPipeline → katm_claim; checking for existing claim claimId=',
    input.claimId,
  );
  await setCurrentPipeline(input.scoringId, 'katm_claim');
  const [existing] = await db
    .select({ katmSir: katmClaims.katmSir })
    .from(katmClaims)
    .where(eq(katmClaims.claimId, input.claimId))
    .limit(1);

  if (existing) {
    console.log(
      '[PIPELINE:katm_claim] existing claim found katmSir=',
      existing.katmSir,
      '— skipping registerClaim',
    );
    await recordPipeline(input.scoringId, 'katm_claim', {
      status: 'passed',
      summary: { claimId: input.claimId, katmSir: existing.katmSir },
    });
  } else {
    console.log('[PIPELINE:katm_claim] no existing claim → registerClaim(...)');
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
      console.log(
        '[PIPELINE:katm_claim] registerClaim ← katmSir=',
        claim.katmSir,
        'verified=',
        claim.verified,
      );
    } catch (err) {
      if (err instanceof KatmOneIdLockedError) {
        console.error('[PIPELINE:katm_claim] KatmOneIdLockedError:', err.message);
        await recordPipeline(input.scoringId, 'katm_claim', {
          status: 'rejected',
          rejectReasonCode: 'oneid_locked',
          raw: { message: err.message },
        });
        await markRejected(input.scoringId, 'oneid_locked');
        return { kind: 'rejected', reasonCode: 'oneid_locked' };
      }
      console.error(
        '[PIPELINE:katm_claim] registerClaim ERROR:',
        err instanceof Error ? err.message : String(err),
      );
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
      sessionId: input.sessionId ?? null,
      katmSir: claim.katmSir,
      verified: claim.verified,
    });
    await recordPipeline(input.scoringId, 'katm_claim', {
      status: 'passed',
      summary: { claimId: input.claimId, katmSir: claim.katmSir },
      raw: claim.verified,
    });
    console.log('[PIPELINE:katm_claim] PASSED (registered)');
  }
  console.log('[PIPELINE:katm_claim] → requestMib(...)');
  // return requestMib({ scoringId: input.scoringId, claimId: input.claimId });
  return request077({ scoringId: input.scoringId, claimId: input.claimId });
}

/** Pipeline (flag-gated) — request the chargeable MIB (315) report, then evaluate. */
export async function requestMib(input: {
  scoringId: number;
  claimId: string;
}): Promise<PipelineStepResult> {
  console.log('[PIPELINE:katm_mib] requestMib START claimId=', input.claimId);
  await setCurrentPipeline(input.scoringId, 'katm_mib');
  const report = await requestMibReport({ claimId: input.claimId });
  console.log('[PIPELINE:katm_mib] requestMibReport ← status=', report.status);

  if (report.status === 'pending') {
    console.log('[PIPELINE:katm_mib] PENDING token=', report.token, '→ enqueue_poll');
    await db
      .insert(katmMibReports)
      .values({ claimId: input.claimId, token: report.token, status: 'created' })
      .onConflictDoNothing();
    await recordPipeline(input.scoringId, 'katm_mib', { status: 'pending' });
    return { kind: 'enqueue_poll', reportType: 'mib', token: report.token };
  }

  console.log('[PIPELINE:katm_mib] READY → persist + evaluate');
  await persistMibReady(input.claimId, report.result);
  return evaluateMib(input.scoringId, input.claimId, report.result);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  console.log(
    '[PIPELINE:katm_mib] evaluateMib START claimId=',
    claimId,
    'resultCode=',
    result.resultCode,
  );
  const ev = evaluateKatmMib(result);
  console.log('[PIPELINE:katm_mib] evaluateKatmMib →', ev.status);
  if (ev.status === 'rejected') {
    console.log('[PIPELINE:katm_mib] REJECTED reasonCode=', ev.rejectReasonCode);
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
    console.error('[PIPELINE:katm_mib] ERROR unmapped resultCode=', result.resultCode);
    await recordPipeline(scoringId, 'katm_mib', {
      status: 'error',
      summary: ev.summary ?? null,
      raw: ev.raw,
    });
    await markError(scoringId);
    return { kind: 'failed', reason: `mib_unmapped_code:${result.resultCode}` };
  }
  // passed (clean) → only now do we pay for 077
  console.log('[PIPELINE:katm_mib] PASSED → request077(...)');
  await recordPipeline(scoringId, 'katm_mib', {
    status: 'passed',
    summary: ev.status === 'passed' ? ev.summary : null,
    raw: ev.status === 'passed' ? ev.raw : null,
  });
  await sleep(1000 * 35); // avoid KATM 429 if MIB and 077 are requested in the same second
  return request077({ scoringId, claimId });
}

/** Pipeline 2 — request the chargeable 077 report, then evaluate it. */
export async function request077(input: {
  scoringId: number;
  claimId: string;
}): Promise<PipelineStepResult> {
  console.log('[PIPELINE:katm_077] request077 START claimId=', input.claimId);
  await setCurrentPipeline(input.scoringId, 'katm_077');
  const report = await request077Report({ claimId: input.claimId });
  console.log('[PIPELINE:katm_077] request077Report ← status=', report.status);

  if (report.status === 'pending') {
    console.log('[PIPELINE:katm_077] PENDING token=', report.token, '→ enqueue_poll');
    await db
      .insert(katm077Reports)
      .values({ claimId: input.claimId, token: report.token, status: 'created' })
      .onConflictDoNothing();
    await recordPipeline(input.scoringId, 'katm_077', { status: 'pending' });
    return { kind: 'enqueue_poll', reportType: '077', token: report.token };
  }

  console.log('[PIPELINE:katm_077] READY → persist + evaluate');
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
  console.log('[PIPELINE:katm_077] evaluate077 START claimId=', claimId);
  const ev = evaluateKatm077(result);
  console.log(
    '[PIPELINE:katm_077] evaluateKatm077 →',
    ev.status,
    ev.status === 'rejected' ? `reasonCode=${ev.rejectReasonCode}` : '',
  );
  if (ev.status === 'rejected') {
    console.log(
      '[PIPELINE:katm_077] REJECTED reasonCode=',
      ev.rejectReasonCode,
      'summary=',
      JSON.stringify(ev.summary),
    );
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
  console.log('[PIPELINE:katm_077] PASSED → requestInps(...)');
  await recordPipeline(scoringId, 'katm_077', {
    status: 'passed',
    summary: ev.status === 'passed' ? ev.summary : null,
    raw: ev.status === 'passed' ? ev.raw : null,
  });
  return requestInps(scoringId, claimId);
}

/** Pipeline 3 — request the chargeable INPS report, then evaluate it. */
export async function requestInps(scoringId: number, claimId: string): Promise<PipelineStepResult> {
  console.log('[PIPELINE:katm_inps] requestInps START claimId=', claimId);
  await setCurrentPipeline(scoringId, 'katm_inps');
  const report = await requestINPSReport({ claimId });
  console.log('[PIPELINE:katm_inps] requestINPSReport ← status=', report.status);

  if (report.status === 'pending') {
    console.log('[PIPELINE:katm_inps] PENDING token=', report.token, '→ enqueue_poll');
    await db
      .insert(katmInpsReports)
      .values({ claimId, token: report.token, status: 'created' })
      .onConflictDoNothing();
    await recordPipeline(scoringId, 'katm_inps', { status: 'pending' });
    return { kind: 'enqueue_poll', reportType: 'inps', token: report.token };
  }

  console.log('[PIPELINE:katm_inps] READY → persist + evaluate');
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
  console.log('[PIPELINE:katm_inps] evaluateInps START');
  const ev = evaluateKatmInps(result);
  console.log(
    '[PIPELINE:katm_inps] evaluateKatmInps →',
    ev.status,
    ev.status === 'rejected' ? `reasonCode=${ev.rejectReasonCode}` : '',
  );
  if (ev.status === 'rejected') {
    console.log('[PIPELINE:katm_inps] REJECTED reasonCode=', ev.rejectReasonCode);
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
  console.log('[PIPELINE:katm_inps] PASSED → markGatesPassed → gates_passed');
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
      pledgerLiability: r.pledgerLiability,
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
