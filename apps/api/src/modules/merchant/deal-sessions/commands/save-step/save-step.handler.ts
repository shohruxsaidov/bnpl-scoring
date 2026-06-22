import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { products, tariffs } from '@db/schema';
import {
  err,
  stepDataOf,
  WIZARD_STEPS,
  type WizardStep,
  type DealSessionRow,
  type SessionStepData,
} from '../../types';

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

  const idx = WIZARD_STEPS.indexOf(step);
  for (const later of WIZARD_STEPS.slice(idx + 1)) delete next[later];
  console.log('[saveStep] next stepData after invalidation', next);

  if (step === 'client') {
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
): Promise<SessionStepData[WizardStep]> {
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
