import { and, eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions, dealSessionEvents } from '../../../deals/schema';
import { users, products, tariffs } from '@db/schema';

// Wizard steps in order. 'done' is a frontend-only pseudo-step; the session's
// currentStep never goes past 'verification' — completion is a status change.
export const WIZARD_STEPS = [
  'client',
  'card',
  'tariff',
  'products',
  'payment',
  'verification',
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export function isWizardStep(s: string): s is WizardStep {
  return (WIZARD_STEPS as readonly string[]).includes(s);
}

/** KATM result stamped by the server at /merchant/katm/query. */
export interface KatmStamp {
  userId: string;
  claimId: string;
  demandId: string;
  consentId: string;
  consentDate: string;
  score: number;
  scoringClass: string;
  scoringLevel: string;
  activeLoans: number;
  allDebtSum: number;
  overdueCount: number;
  overdueAmount: number;
  maxOverdueDays: number;
  totalContracts: number;
  totalClaims: number;
  avgMonthlyPayment: number;
  hasDefaults: boolean;
  hasCreditBan: boolean;
  raw: unknown;
}

/** Scoring result stamped by the server at /merchant/cards/score. */
export interface ScoringStamp {
  cardId: string;
  /** scoring_histories.id as string */
  scoringId: string | null;
  scoreSum: number;
  coefficient: number;
  decision: string;
  /** tiyin */
  platformCreditLimit: number;
  criteriaScores: Record<string, unknown>;
}

/** Async-report state while a BullMQ job polls KATM (ADR-0025). */
export interface KatmPendingState {
  status: 'pending' | 'failed';
  startedAt: string;
  error?: string;
}

/** Prepayment confirmed server-side at POST /prepayment (ADR-0026). */
export interface PrepaymentStamp {
  /** Gap in tiyin: totalWithMarkup - effectiveLimit. Installments run on this less. */
  amount: number;
  confirmedAt: string;
}

export interface SessionStepData {
  client?: { userId: string; isNewClient: boolean; myidVerified: boolean; katmConsent: boolean };
  card?: {
    cardId: string;
    maskedPan: string;
    pcType: string;
    bank: string;
    holderName: string;
    expiry: string;
  };
  // Tariff params snapshotted server-side at save time (amounts in tiyin, as strings)
  tariff?: {
    tariffId: string;
    name: string;
    termMonths: number;
    markupPercent: number;
    minAmount: string | null;
    maxAmount: string | null;
  };
  // Basket lines with server-snapshotted prices — what the Client consents to is
  // what the Deal is built from, even if the Product is edited afterwards
  products?: {
    lines: Array<{
      productId: string;
      productName: string;
      price: string;
      mxikCode: string | null;
      packageCode: number | null;
      packageName: string | null;
      quantity: number;
    }>;
  };
  payment?: { paymentDay: number };
  verification?: { lang: 'ru' | 'uz'; otpVerifiedAt: string | null };
  katm?: KatmStamp;
  katmPending?: KatmPendingState;
  scoring?: ScoringStamp;
  // Stamped by POST /prepayment; cleared whenever products step is redone (ADR-0026)
  prepayment?: PrepaymentStamp;
}

export type DealSessionRow = typeof dealSessions.$inferSelect;

function err(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

function stepDataOf(session: DealSessionRow): SessionStepData {
  return (session.stepData ?? {}) as SessionStepData;
}

async function logEvent(sessionId: string, step: string, payload: unknown) {
  await db.insert(dealSessionEvents).values({ sessionId, step, payload });
}

/** The agent's single active session, or null. */
export async function getActiveSession(agentId: number): Promise<DealSessionRow | null> {
  const [row] = await db
    .select()
    .from(dealSessions)
    .where(and(eq(dealSessions.agentId, agentId), eq(dealSessions.status, 'active')))
    .limit(1);
  return row ?? null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Load a session by id and assert it is the agent's own active session. */
export async function loadOwnedActiveSession(
  id: string,
  agentId: number,
): Promise<DealSessionRow> {
  if (!UUID_RE.test(id)) throw err('session_not_found');
  const [row] = await db.select().from(dealSessions).where(eq(dealSessions.id, id)).limit(1);
  if (!row || row.agentId !== agentId) throw err('session_not_found');
  if (row.status !== 'active') throw err('session_not_active');
  return row;
}

/**
 * Open a new Wizard run. Auto-supersedes: any existing active session for the
 * agent is marked abandoned first (ADR-0024 — one active session per Agent).
 */
export async function createSession(
  input: { merchantId: number; branchId: number; agentId: number; userId?: number },
): Promise<DealSessionRow> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(dealSessions)
      .where(and(eq(dealSessions.agentId, input.agentId), eq(dealSessions.status, 'active')))
      .limit(1);
    if (existing) {
      await tx
        .update(dealSessions)
        .set({ status: 'abandoned', updatedAt: new Date() })
        .where(eq(dealSessions.id, existing.id));
      await tx
        .insert(dealSessionEvents)
        .values({ sessionId: existing.id, step: 'abandoned', payload: { reason: 'superseded' } });
    }

    const [session] = await tx
      .insert(dealSessions)
      .values({
        merchantId: input.merchantId,
        branchId: input.branchId,
        agentId: input.agentId,
        userId: input.userId ? Number(input.userId) : undefined,
      })
      .returning();
    if (!session) throw new Error('session_insert_failed');

    await tx
      .insert(dealSessionEvents)
      .values({ sessionId: session.id, step: 'opened', payload: null });
    return session;
  });
}

export async function abandonSession(session: DealSessionRow): Promise<void> {
  await db
    .update(dealSessions)
    .set({ status: 'abandoned', updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
  await logEvent(session.id, 'abandoned', { reason: 'closed' });
}

/**
 * Save one step onto the session: validates and server-enriches the payload,
 * invalidates every later step (a redone step voids downstream consents —
 * ADR-0024), advances currentStep, and appends an immutable event.
 */
export async function saveStep(
  session: DealSessionRow,
  step: WizardStep,
  body: Record<string, unknown>,
): Promise<DealSessionRow> {
  console.log('[saveStep] called', { sessionId: session.id, step, body });

  const data = stepDataOf(session);
  console.log('[saveStep] current stepData', data);

  const saved = await buildStepPayload(session, step, body, data);
  console.log('[saveStep] buildStepPayload result', saved);

  const next: SessionStepData = { ...data, [step]: saved };

  // Invalidate all later steps
  const idx = WIZARD_STEPS.indexOf(step);
  for (const later of WIZARD_STEPS.slice(idx + 1)) delete next[later];
  console.log('[saveStep] next stepData after invalidation', next);

  // Server stamps are tied to the inputs they were computed from
  if (step === 'client') {
    const userId = (saved as NonNullable<SessionStepData['client']>).userId;
    console.log(
      '[saveStep] client step — userId',
      userId,
      'katm.userId',
      next.katm?.userId,
    );
    if (next.katm && next.katm.userId !== userId) {
      console.log('[saveStep] dropping katm (userId mismatch)');
      delete next.katm;
    }
    if (next.scoring) {
      console.log('[saveStep] dropping scoring (client changed)');
      delete next.scoring;
    }
  }
  if (step === 'card') {
    const cardId = (saved as NonNullable<SessionStepData['card']>).cardId;
    console.log('[saveStep] card step — cardId', cardId, 'scoring.cardId', next.scoring?.cardId);
    if (next.scoring && next.scoring.cardId !== cardId) {
      console.log('[saveStep] dropping scoring (cardId mismatch)');
      delete next.scoring;
    }
  }
  // Prepayment amount is tied to the basket total; a basket change invalidates it (ADR-0026)
  if (step === 'products' && next.prepayment) {
    console.log('[saveStep] dropping prepayment (products changed)');
    delete next.prepayment;
  }

  const after = WIZARD_STEPS[idx + 1] ?? 'verification';
  console.log('[saveStep] advancing currentStep to', after);

  const [updated] = await db
    .update(dealSessions)
    .set({
      stepData: next,
      currentStep: after,
      userId:
        step === 'client'
          ? Number((saved as NonNullable<SessionStepData['client']>).userId)
          : session.userId,
      updatedAt: new Date(),
    })
    .where(eq(dealSessions.id, session.id))
    .returning();
  console.log('[saveStep] db.update result', updated ?? 'NOT FOUND');
  if (!updated) throw err('session_not_found');

  await logEvent(session.id, step, saved);
  console.log('[saveStep] done — returning updated session');
  return updated;
}

/** Merge a server-side KATM result into the session head + event trail. */
export async function stampKatm(session: DealSessionRow, stamp: KatmStamp): Promise<void> {
  const data = stepDataOf(session);
  const { katmPending: _drop, ...rest } = data;
  await db
    .update(dealSessions)
    .set({ stepData: { ...rest, katm: stamp }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
  await logEvent(session.id, 'katm', stamp);
}

/** Record/refresh the async KATM-report state on the session (ADR-0025). */
export async function stampKatmPending(
  session: DealSessionRow,
  state: KatmPendingState,
): Promise<void> {
  const data = stepDataOf(session);
  await db
    .update(dealSessions)
    .set({ stepData: { ...data, katmPending: state }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
  await logEvent(session.id, 'katm_pending', state);
}

/** Anchor the chosen user to the session as early as possible (e.g. at KATM query time). */
export async function setSessionUserId(
  session: DealSessionRow,
  userId: number,
): Promise<void> {
  if (session.userId === userId) return;
  await db
    .update(dealSessions)
    .set({ userId, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
}

/** Persist the KATM Claim ID allocated for this run (ADR-0025). */
export async function setKatmClaimId(
  session: DealSessionRow,
  claimId: string,
): Promise<void> {
  await db
    .update(dealSessions)
    .set({ katmClaimId: claimId, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
}

/** Stamp the confirmed prepayment onto the session head + event trail (ADR-0026). */
export async function stampPrepayment(
  session: DealSessionRow,
  stamp: PrepaymentStamp,
): Promise<void> {
  const data = stepDataOf(session);
  await db
    .update(dealSessions)
    .set({ stepData: { ...data, prepayment: stamp }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
  await logEvent(session.id, 'prepayment', stamp);
}

/** Merge a server-side scoring result into the session head + event trail. */
export async function stampScoring(
  session: DealSessionRow,
  stamp: ScoringStamp,
): Promise<void> {
  const data = stepDataOf(session);
  await db
    .update(dealSessions)
    .set({ stepData: { ...data, scoring: stamp }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
  await logEvent(session.id, 'scoring', stamp);
}

/* ── Per-step validation & server-side enrichment ─────────────────────────── */

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

async function buildStepPayload(
  session: DealSessionRow,
  step: WizardStep,
  body: Record<string, unknown>,
  _data: SessionStepData,
): Promise<SessionStepData[WizardStep]> {
  console.log('[buildStepPayload] called', { sessionId: session.id, step, body });

  switch (step) {
    case 'client': {
      const userId = str(body['userId']);
      console.log('[buildStepPayload:client] userId', userId);
      if (!userId || !/^\d+$/.test(userId)) throw err('invalid_step_payload');
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, Number(userId)))
        .limit(1);
      console.log('[buildStepPayload:client] db lookup result', user ?? 'NOT FOUND');
      if (!user) throw err('user_not_found');
      const result = {
        userId,
        isNewClient: body['isNewClient'] === true,
        myidVerified: body['myidVerified'] === true,
        katmConsent: body['katmConsent'] === true,
      };
      console.log('[buildStepPayload:client] returning', result);
      return result;
    }

    case 'card': {
      const cardId = str(body['cardId']);
      const maskedPan = str(body['maskedPan']);
      console.log('[buildStepPayload:card] cardId', cardId, 'maskedPan', maskedPan);
      if (!cardId || !maskedPan) throw err('invalid_step_payload');
      const result = {
        cardId,
        maskedPan,
        pcType: str(body['pcType']) ?? '',
        bank: str(body['bank']) ?? '',
        holderName: str(body['holderName']) ?? '',
        expiry: str(body['expiry']) ?? '',
      };
      console.log('[buildStepPayload:card] returning', result);
      return result;
    }

    case 'tariff': {
      const tariffId = str(body['tariffId']);
      console.log('[buildStepPayload:tariff] tariffId', tariffId);
      if (!tariffId || !/^\d+$/.test(tariffId)) throw err('invalid_step_payload');
      const [tariff] = await db.select().from(tariffs).where(eq(tariffs.id, parseInt(tariffId))).limit(1);
      console.log(
        '[buildStepPayload:tariff] db lookup result',
        tariff ?? 'NOT FOUND',
        'active',
        tariff?.active,
      );
      if (!tariff || !tariff.active) throw err('tariff_not_found');
      const result = {
        tariffId,
        name: tariff.name,
        termMonths: tariff.termMonths,
        markupPercent: parseFloat(tariff.markupPercent),
        minAmount: tariff.minAmount?.toString() ?? null,
        maxAmount: tariff.maxAmount?.toString() ?? null,
      };
      console.log('[buildStepPayload:tariff] returning', result);
      return result;
    }

    case 'products': {
      const rawLines = Array.isArray(body['lines']) ? (body['lines'] as unknown[]) : [];
      console.log('[buildStepPayload:products] rawLines', rawLines);
      if (rawLines.length === 0) throw err('invalid_step_payload');
      const lines = rawLines.map((l) => {
        const line = l as Record<string, unknown>;
        const productId = str(line['productId']);
        const quantity = typeof line['quantity'] === 'number' ? Math.floor(line['quantity']) : 0;
        console.log('[buildStepPayload:products] parsed line', { productId, quantity });
        if (!productId || !/^\d+$/.test(productId) || quantity < 1)
          throw err('invalid_step_payload');
        return { productId, quantity };
      });

      const resolved = [];
      for (const line of lines) {
        const [p] = await db
          .select()
          .from(products)
          .where(eq(products.id, Number(line.productId)))
          .limit(1);
        console.log('[buildStepPayload:products] product lookup', {
          productId: line.productId,
          found: !!p,
          active: p?.active,
          merchantMatch: p?.merchantId === session.merchantId,
        });
        if (!p || !p.active || p.merchantId !== session.merchantId) throw err('product_not_found');
        resolved.push({
          productId: line.productId,
          productName: p.name,
          // Price snapshot — the Deal is built from this, not the live price (ADR-0024)
          price: p.price,
          mxikCode: p.mxikCode ?? null,
          packageCode: p.packageCode ?? null,
          packageName: p.packageName ?? null,
          quantity: line.quantity,
        });
      }
      console.log('[buildStepPayload:products] returning', resolved);
      return { lines: resolved };
    }

    case 'payment': {
      const day = body['paymentDay'];
      console.log('[buildStepPayload:payment] paymentDay', day);
      if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 28) {
        throw err('invalid_step_payload');
      }
      console.log('[buildStepPayload:payment] returning', { paymentDay: day });
      return { paymentDay: day };
    }

    case 'verification': {
      const lang = body['lang'];
      console.log(
        '[buildStepPayload:verification] lang',
        lang,
        'otpVerifiedAt',
        body['otpVerifiedAt'],
      );
      if (lang !== 'ru' && lang !== 'uz') throw err('invalid_step_payload');
      const result = { lang, otpVerifiedAt: str(body['otpVerifiedAt']) } as any;
      console.log('[buildStepPayload:verification] returning', result);
      return result;
    }
  }
}
