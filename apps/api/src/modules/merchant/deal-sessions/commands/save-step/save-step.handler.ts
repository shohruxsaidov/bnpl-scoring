import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { products, tariffs } from '@db/schema';
import {
  err,
  stepDataOf,
  wizardStepsFor,
  type WizardStep,
  type DealSessionRow,
  type SessionStepData,
  type BailsmanItem,
} from '../../types';
import { loadReusableLimit } from '../../queries/reusable-limit/reusable-limit.handler';

export async function saveStep(
  session: DealSessionRow,
  step: WizardStep,
  body: Record<string, unknown>,
): Promise<DealSessionRow> {
  const data = stepDataOf(session);

  const saved = await buildStepPayload(session, step, body, data);

  const seq = wizardStepsFor(session);

  let next: SessionStepData;
  if (step === 'contacts') {
    // Contacts step (reuse path): bailsmen live in stepData.bailsmen (shared with
    // the full path — never a stepData.contacts key), and we rehydrate the reused
    // scoring stamp here since there is no card-score pass to produce one.
    next = { ...data, bailsmen: saved as BailsmanItem[] };
    const reused = session.userId != null ? await loadReusableLimit(session.userId) : null;
    if (!reused) throw err('reuse_limit_unavailable');
    next.scoring = reused.stamp;
  } else {
    next = { ...data, [step]: saved };
  }

  const idx = seq.indexOf(step);
  // 'contacts' is not a stepData key (bailsmen is), so its delete is a harmless no-op.
  for (const later of seq.slice(idx + 1)) delete (next as Record<string, unknown>)[later];

  if (step === 'client') {
    // A (re)selected client invalidates any scoring + contacts collected for the
    // previous one, and lets the next /start re-decide the flow mode.
    if (next.scoring) {
      delete next.scoring;
    }
    if (next.bailsmen) {
      delete next.bailsmen;
    }
  }
  if (step === 'card') {
    const cardId = (saved as NonNullable<SessionStepData['card']>).cardId;
    if (next.scoring && next.scoring.cardId !== cardId) {
      delete next.scoring;
    }
  }
  if (step === 'products' && next.prepayment) {
    delete next.prepayment;
  }
  // A parked creation failure describes the run as it was. Saving a step is the
  // agent acting on it — redoing Товары IS the answer to `product_not_found` — so
  // the reason goes with the cause. Left behind, it would sit on the screen after
  // the fix and read as a dead end where there is none.
  if (next.dealCreation) {
    delete next.dealCreation;
  }

  const after = seq[idx + 1] ?? 'verification';

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
  if (!updated) throw err('session_not_found');

  return updated;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

async function buildStepPayload(
  session: DealSessionRow,
  step: WizardStep,
  body: Record<string, unknown>,
  _data: SessionStepData,
): Promise<SessionStepData[keyof SessionStepData]> {
  switch (step) {
    case 'client': {
      const userId = session.userId?.toString() ?? null;
      if (!userId) throw err('invalid_step_payload');
      const result = {
        userId,
        isNewClient: body['isNewClient'] === true,
        myidVerified: body['myidVerified'] === true,
        katmConsent: body['katmConsent'] === true,
      };
      return result;
    }

    case 'card': {
      const cardId = str(body['cardId']);
      const result = {
        cardId,
      };
      return result;
    }

    case 'contacts': {
      // Reuse path only — 1..5 bailsmen, each { relation, phone }. Mirrors the
      // full path's /cards/score bailsmen validation.
      const raw = Array.isArray(body['bailsmen']) ? (body['bailsmen'] as unknown[]) : [];
      if (raw.length < 1 || raw.length > 5) throw err('invalid_step_payload');
      const RELATIONS = new Set(['father', 'mother', 'brother', 'friend', 'other']);
      const bailsmen = raw.map((b) => {
        const item = b as Record<string, unknown>;
        const relation = str(item['relation']);
        const phone = str(item['phone']);
        if (!relation || !RELATIONS.has(relation) || !phone) throw err('invalid_step_payload');
        return { relation, phone } as BailsmanItem;
      });
      // Stored under stepData.bailsmen by saveStep (not next[step]).
      return bailsmen;
    }

    case 'tariff': {
      const tariffId = str(body['tariffId']);
      if (!tariffId || !/^\d+$/.test(tariffId)) throw err('invalid_step_payload');
      const [tariff] = await db
        .select()
        .from(tariffs)
        .where(eq(tariffs.id, parseInt(tariffId)))
        .limit(1);
      if (!tariff || !tariff.active) throw err('tariff_not_found');
      const result = {
        tariffId,
        name: tariff.name,
        termMonths: tariff.termMonths,
        markupPercent: parseFloat(tariff.markupPercent),
        minAmount: tariff.minAmount?.toString() ?? null,
        maxAmount: tariff.maxAmount?.toString() ?? null,
      };
      return result;
    }

    case 'products': {
      const rawLines = Array.isArray(body['lines']) ? (body['lines'] as unknown[]) : [];
      if (rawLines.length === 0) throw err('invalid_step_payload');
      const lines = rawLines.map((l) => {
        const line = l as Record<string, unknown>;
        const productId = str(line['productId']);
        const quantity = typeof line['quantity'] === 'number' ? Math.floor(line['quantity']) : 0;
        const labels = Array.isArray(line['labels'])
          ? (line['labels'] as unknown[]).map((x) => (typeof x === 'string' ? x.trim() : ''))
          : [];
        if (!productId || !/^\d+$/.test(productId) || quantity < 1)
          throw err('invalid_step_payload');
        return { productId, quantity, labels };
      });

      const resolved = [];
      // Marking codes are physically unique — reject duplicates across the whole basket.
      const seenLabels = new Set<string>();
      for (const line of lines) {
        const [p] = await db
          .select()
          .from(products)
          .where(eq(products.id, Number(line.productId)))
          .limit(1);

        if (!p || !p.active || p.merchantId !== session.merchantId) throw err('product_not_found');

        // Labeled ⇒ one non-empty code per unit; unlabeled ⇒ no codes at all.
        let labels: string[] = [];
        if (p.isLabeled) {
          if (line.labels.length !== line.quantity || line.labels.some((c) => !c))
            throw err('invalid_step_payload');
          for (const c of line.labels) {
            if (seenLabels.has(c)) throw err('invalid_step_payload');
            seenLabels.add(c);
          }
          labels = line.labels;
        }

        resolved.push({
          productId: line.productId,
          productName: p.name,
          price: p.price,
          mxikCode: p.mxikCode ?? null,
          packageCode: p.packageCode ?? null,
          packageName: p.packageName ?? null,
          quantity: line.quantity,
          isLabeled: p.isLabeled,
          labels,
        });
      }
      return { lines: resolved };
    }

    case 'payment': {
      const day = body['paymentDay'];
      if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 28) {
        throw err('invalid_step_payload');
      }
      return { paymentDay: day };
    }

    case 'verification': {
      // Contract language only. The signing proofs (MyID + OTP) are NOT here —
      // they are server stamps under stepData.signing, because this block is
      // client-writable and a re-save replaces it wholesale.
      const lang = body['lang'];
      if (lang !== 'ru' && lang !== 'uz') throw err('invalid_step_payload');
      return { lang };
    }
  }
}
