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
  console.log('[saveStep] called', { sessionId: session.id, step, body });

  const data = stepDataOf(session);
  console.log('[saveStep] current stepData', data);

  const saved = await buildStepPayload(session, step, body, data);
  console.log('[saveStep] buildStepPayload result', saved);

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
  console.log('[saveStep] next stepData after invalidation', next);

  // Any step save voids the signature. The old rule dropped `signing` only when the
  // CLIENT changed, on the reasoning that "the OTP is the last act of the run, so
  // new terms always get a fresh consent" — but nothing enforced that. `signing` is
  // not a step key, so the slice above never reached it, and an Agent could take the
  // акцепт, press Back, add a product, and walk forward to a gate still reading
  // `ready`. The Deal was then built on a basket the client had never seen.
  //
  // The authoritative guard is the terms digest stamped with the акцепт and
  // re-checked at deal creation (deals/signing/terms) — that is what stops a caller
  // going straight at the API. Dropping the stamp here is the honest UI half of it:
  // the Agent sees the gate reopen the moment they change something, instead of
  // meeting `terms_changed` at the end and not knowing why.
  if (next.signing) {
    console.log('[saveStep] dropping signing (step changed)', step);
    delete next.signing;
  }
  // An outstanding "sign on your phone" request is for terms that just moved. Pull
  // it, so the client's app stops offering a deal that no longer exists. The Agent
  // re-sends, which is a fresh акцепт against the new terms by construction.
  if (next.signingRequest) {
    console.log('[saveStep] dropping signingRequest (step changed)', step);
    delete next.signingRequest;
  }

  if (step === 'client') {
    // A (re)selected client invalidates any scoring + contacts collected for the
    // previous one, and lets the next /start re-decide the flow mode.
    if (next.scoring) {
      console.log('[saveStep] dropping scoring (client changed)');
      delete next.scoring;
    }
    if (next.bailsmen) {
      console.log('[saveStep] dropping bailsmen (client changed)');
      delete next.bailsmen;
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
  if (step === 'products' && next.prepayment) {
    console.log('[saveStep] dropping prepayment (products changed)');
    delete next.prepayment;
  }

  const after = seq[idx + 1] ?? 'verification';
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

  console.log('[saveStep] done — returning updated session');
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
  console.log('[buildStepPayload] called', { sessionId: session.id, step, body });

  switch (step) {
    case 'client': {
      const userId = session.userId?.toString() ?? null;
      console.log('[buildStepPayload:client] userId from session', userId);
      if (!userId) throw err('invalid_step_payload');
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

    case 'contacts': {
      // Reuse path only — 1..5 bailsmen, each { relation, phone }. Mirrors the
      // full path's /cards/score bailsmen validation.
      const raw = Array.isArray(body['bailsmen']) ? (body['bailsmen'] as unknown[]) : [];
      console.log('[buildStepPayload:contacts] raw bailsmen count', raw.length);
      if (raw.length < 1 || raw.length > 5) throw err('invalid_step_payload');
      const RELATIONS = new Set(['father', 'mother', 'brother', 'friend', 'other']);
      const bailsmen = raw.map((b) => {
        const item = b as Record<string, unknown>;
        const relation = str(item['relation']);
        const phone = str(item['phone']);
        if (!relation || !RELATIONS.has(relation) || !phone) throw err('invalid_step_payload');
        return { relation, phone } as BailsmanItem;
      });
      console.log('[buildStepPayload:contacts] returning', bailsmen);
      // Stored under stepData.bailsmen by saveStep (not next[step]).
      return bailsmen;
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
        const labels = Array.isArray(line['labels'])
          ? (line['labels'] as unknown[]).map((x) => (typeof x === 'string' ? x.trim() : ''))
          : [];
        console.log('[buildStepPayload:products] parsed line', { productId, quantity });
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
        console.log('[buildStepPayload:products] product lookup', {
          productId: line.productId,
          found: !!p,
          active: p?.active,
          merchantMatch: p?.merchantId === session.merchantId,
        });
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
      // Contract language only. The signing proofs (MyID + OTP) are NOT here —
      // they are server stamps under stepData.signing, because this block is
      // client-writable and a re-save replaces it wholesale.
      const lang = body['lang'];
      console.log('[buildStepPayload:verification] lang', lang);
      if (lang !== 'ru' && lang !== 'uz') throw err('invalid_step_payload');
      console.log('[buildStepPayload:verification] returning', { lang });
      return { lang };
    }
  }
}
