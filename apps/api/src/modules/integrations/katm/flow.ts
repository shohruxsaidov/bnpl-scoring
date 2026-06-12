/**
 * KATM consume flow orchestration (ADR-0025):
 *
 *   consent → ban pre-check → claim registration → report request
 *
 * Shared by the Wizard (Deal Session) and self-service (Scoring Session)
 * paths. When the report is async (05050) the caller enqueues a BullMQ
 * polling job — see poller.ts.
 */

import { sql } from 'drizzle-orm'
import type { Db } from '../../../db'
import { katmConsents } from '../db/schema'
import {
  checkCreditBan,
  registerClaim,
  requestReport,
  type KatmResult,
} from './service'

// ---------------------------------------------------------------------------
// Subject — the client/user fields claim registration requires
// ---------------------------------------------------------------------------

export interface KatmSubject {
  pinfl: string
  passportSerial: string
  passportNumber: string
  docType: number
  regionCode: string
  districtCode: string
  address: string
  phone: string
}

/**
 * Validate a clients/users row against the claim-registration requirements.
 * Returns the list of missing field names (empty = OK) — the routes surface
 * this so the Agent / self-service user can fill the gaps manually.
 */
export function missingKatmFields(row: {
  pinfl: string | null
  passportSerial: string | null
  passportNumber: string | null
  docType: number | null
  katmRegionCode: string | null
  katmDistrictCode: string | null
  address: string | null
  phone: string | null
}): string[] {
  const missing: string[] = []
  if (!row.pinfl) missing.push('pinfl')
  if (!row.passportSerial) missing.push('passportSerial')
  if (!row.passportNumber) missing.push('passportNumber')
  if (row.docType == null) missing.push('docType')
  if (!row.katmRegionCode) missing.push('regionCode')
  if (!row.katmDistrictCode) missing.push('districtCode')
  if (!row.address) missing.push('address')
  if (!row.phone) missing.push('phone')
  return missing
}

// ---------------------------------------------------------------------------
// KATM Claim ID — one shared sequence across both session tables (ADR-0025)
// ---------------------------------------------------------------------------

export async function allocateKatmClaimId(db: Db): Promise<string> {
  const rows = await db.execute(sql`select nextval('katm_claim_seq') as id`)
  const row = (rows as unknown as Array<{ id: string | number | bigint }>)[0]
  if (!row) throw new Error('katm_claim_seq nextval returned no row')
  return String(row.id)
}

// ---------------------------------------------------------------------------
// KATM Consent — the sequence-numbered record behind pAgreementId (ADR-0025)
// ---------------------------------------------------------------------------

export interface KatmConsentRecord {
  /** katm_consents.id as string — sent as pAgreementId */
  agreementId: string
  /** sent as pAgreementDate */
  agreementDate: Date
}

export async function createKatmConsent(
  db: Db,
  input: {
    channel: 'wizard' | 'self_service'
    clientId?: bigint
    userId?: bigint
    sessionId?: string
  },
): Promise<KatmConsentRecord> {
  const [row] = await db
    .insert(katmConsents)
    .values({
      channel: input.channel,
      clientId: input.clientId ?? null,
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
    })
    .returning({ id: katmConsents.id, createdAt: katmConsents.createdAt })
  if (!row) throw new Error('katm_consent_insert_failed')
  return { agreementId: row.id.toString(), agreementDate: row.createdAt }
}

// ---------------------------------------------------------------------------
// The flow itself
// ---------------------------------------------------------------------------

export type KatmFlowOutcome =
  | { status: 'banned' }
  | { status: 'ready'; katmSir: string; result: KatmResult }
  | { status: 'pending'; katmSir: string; token: string }

export async function startKatmFlow(
  db: Db,
  input: {
    claimId: string
    consent: KatmConsentRecord
    subject: KatmSubject
  },
): Promise<KatmFlowOutcome> {
  // Ban pre-check — an actively banned client must not even have a claim
  // registered with the bureau (ADR-0025)
  const ban = await checkCreditBan(db, { pinfl: input.subject.pinfl })
  if (ban.banned) return { status: 'banned' }

  const claim = await registerClaim(db, {
    claimId: input.claimId,
    agreementId: input.consent.agreementId,
    agreementDate: input.consent.agreementDate,
    pinfl: input.subject.pinfl,
    docSeries: input.subject.passportSerial,
    docNumber: input.subject.passportNumber,
    docType: input.subject.docType,
    regionCode: input.subject.regionCode,
    districtCode: input.subject.districtCode,
    address: input.subject.address,
    phone: input.subject.phone,
  })

  const report = await requestReport(db, { claimId: input.claimId })
  if (report.status === 'pending') {
    return { status: 'pending', katmSir: claim.katmSir, token: report.token }
  }
  return { status: 'ready', katmSir: claim.katmSir, result: report.result }
}
