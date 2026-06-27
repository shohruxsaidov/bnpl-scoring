// ---------------------------------------------------------------------------
// Stop-factor registry — hardcoded knockout rules per pipeline.
// Each evaluator is a pure function of already-fetched data. The first tripped
// stop-factor short-circuits the pipeline to 'rejected' with its reason code.
// myid runs on data already on hand (the users row, free); the katm evaluators
// run on a report that was already fetched (the charge happens in the
// orchestrator, only after myid passes).
// ---------------------------------------------------------------------------
import {
  MIB_PASS_CODES,
  MIB_REJECT_CODES,
  type InpsResult,
  type KatmResult,
  type MibResult,
} from '../../integrations/katm/service/shared';
import type { PipelineEvaluation } from './types';

const MIN_AGE = 21;

/** Whole years between birthDate (ISO YYYY-MM-DD) and now. null if unparseable. */
export function ageFromBirthDate(birthDate: string | null, now: Date): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

// --- myid -------------------------------------------------------------------
// All knockouts. Address-absent and age<21 are the business rules; every other
// missing registration field is also a knockout (MyID must supply it). First
// tripped factor wins; the full missing-field list is recorded in the summary.

import type { RejectReasonCode } from './types';

export interface MyidSubject {
  birthDate: string | null;
  address: string | null;
  pinfl: string | null;
  passportSeries: string | null;
  passportNumber: string | null;
  docType: number | null;
  regionCode: string | null;
  districtCode: string | null;
  phone: string | null;
}

const present = (v: string | null | undefined) => !!v && v.trim().length > 0;

// Ordered: address first (named business rule), then the rest. doc_type checked separately (number).
const FIELD_CHECKS: Array<{ field: keyof MyidSubject; code: RejectReasonCode }> = [
  { field: 'address', code: 'address_absent' },
  { field: 'pinfl', code: 'pinfl_absent' },
  { field: 'passportSeries', code: 'passport_series_absent' },
  { field: 'passportNumber', code: 'passport_number_absent' },
  { field: 'regionCode', code: 'region_absent' },
  { field: 'districtCode', code: 'district_absent' },
  { field: 'phone', code: 'phone_absent' },
];

export function evaluateMyid(subject: MyidSubject, now: Date): PipelineEvaluation {
  const age = ageFromBirthDate(subject.birthDate, now);

  // Full missing-field list for the admin card.
  const missingFields: string[] = [];
  for (const { field } of FIELD_CHECKS) {
    if (!present(subject[field] as string | null)) missingFields.push(field);
  }
  if (subject.docType == null) missingFields.push('docType');

  const summary = { age, hasAddress: present(subject.address), missingFields };

  // First tripped knockout wins. Missing required fields short-circuit first.
  for (const { field, code } of FIELD_CHECKS) {
    if (!present(subject[field] as string | null)) {
      return { status: 'rejected', rejectReasonCode: code, summary, raw: subject };
    }
  }
  if (subject.docType == null) {
    return { status: 'rejected', rejectReasonCode: 'doc_type_absent', summary, raw: subject };
  }
  if (age == null || age < MIN_AGE) {
    return { status: 'rejected', rejectReasonCode: 'age_below_21', summary, raw: subject };
  }
  return { status: 'passed', summary, raw: subject };
}

// --- katm_mib: mib_enforcement_found ----------------------------------------
// Report 315 (Бюро принудительного исполнения). resultCode 204 = "no data found"
// = clean = PASS. Confirmed "data found" codes (MIB_REJECT_CODES) hard-reject.
// Any other code is an integration gap, NOT evidence of enforcement, so it routes
// to 'error' (needs-review) instead of auto-rejecting a clean applicant.

export function evaluateKatmMib(result: MibResult): PipelineEvaluation {
  const passed = MIB_PASS_CODES.includes(result.resultCode as (typeof MIB_PASS_CODES)[number]);
  const summary = {
    resultCode: result.resultCode,
    resultMessage: result.resultMessage,
    passed,
  };

  if (passed) {
    return { status: 'passed', summary, raw: result.raw };
  }
  if (MIB_REJECT_CODES.includes(result.resultCode)) {
    return { status: 'rejected', rejectReasonCode: 'mib_enforcement_found', summary, raw: result.raw };
  }
  // Unmapped code → needs-review (never an auto-reject).
  return { status: 'error', summary, raw: result.raw };
}

// --- katm_077: credit_ban, has_defaults -------------------------------------

export function evaluateKatm077(result: KatmResult): PipelineEvaluation {
  const summary = {
    score: result.score,
    scoringClass: result.scoringClass,
    hasCreditBan: result.hasCreditBan,
    hasDefaults: result.hasDefaults,
    maxOverdueDays: result.maxOverdueDays,
  };

  if (result.hasCreditBan) {
    return { status: 'rejected', rejectReasonCode: 'credit_ban', summary, raw: result.raw };
  }

  return { status: 'passed', summary, raw: result.raw };
}

// --- katm_inps: no_income ---------------------------------------------------

export function evaluateKatmInps(result: InpsResult): PipelineEvaluation {
  const monthsInWindow = countMonths(result.periodBegin, result.periodEnd);
  const avgMonthlyIncome = monthsInWindow > 0 ? result.incomesAllSumma / monthsInWindow : 0;
  const summary = {
    incomesAllSumma: result.incomesAllSumma,
    avgMonthlyIncome,
    periodBegin: result.periodBegin,
    periodEnd: result.periodEnd,
  };

  if (result.incomesAllSumma <= 0) {
    return { status: 'rejected', rejectReasonCode: 'no_income', summary, raw: result.raw };
  }
  return { status: 'passed', summary, raw: result.raw };
}

/** Inclusive month count between two YYYY-MM(-DD) period bounds; 0 if unparseable. */
function countMonths(begin: string, end: string): number {
  const b = new Date(begin);
  const e = new Date(end);
  if (isNaN(b.getTime()) || isNaN(e.getTime())) return 0;
  return (e.getFullYear() - b.getFullYear()) * 12 + (e.getMonth() - b.getMonth()) + 1;
}
