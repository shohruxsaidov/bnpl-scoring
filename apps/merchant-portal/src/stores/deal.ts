import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import type {
  Bailsman,
  BasketItem,
  Card,
  Client,
  DealPaymentSchedule,
  Product,
  Tariff,
} from '@/types';
import type { DealSessionDto } from '@/composables/use-deal-session-api';
import { buildSchedulePreview } from '@/utils/schedule-preview';

export type DealStepKey =
  | 'client'
  | 'card'
  | 'contacts'
  | 'tariff'
  | 'products'
  | 'payment'
  | 'verification'
  | 'done';

export type DealFlowMode = 'full' | 'reuse';

export interface DealStep {
  key: DealStepKey;
  label: string;
  icon: string;
}

// Full path — the client is scored from scratch (client → card → …).
export const DEAL_STEPS: DealStep[] = [
  { key: 'client', label: 'Клиент', icon: 'pi pi-user' },
  { key: 'card', label: 'Karta', icon: 'pi pi-credit-card' },
  { key: 'tariff', label: 'Tarif', icon: 'pi pi-percentage' },
  { key: 'products', label: 'Mahsulot', icon: 'pi pi-shopping-bag' },
  { key: 'payment', label: "To'lov kuni", icon: 'pi pi-calendar' },
  { key: 'verification', label: 'Верификация', icon: 'pi pi-shield' },
  { key: 'done', label: 'Готово', icon: 'pi pi-check-circle' },
];

// Reuse path — a returning client with a valid cached limit skips scoring; the
// card step is replaced by a contacts-only step.
export const DEAL_STEPS_REUSE: DealStep[] = [
  { key: 'client', label: 'Клиент', icon: 'pi pi-user' },
  { key: 'contacts', label: 'Kontaktlar', icon: 'pi pi-users' },
  { key: 'tariff', label: 'Tarif', icon: 'pi pi-percentage' },
  { key: 'products', label: 'Mahsulot', icon: 'pi pi-shopping-bag' },
  { key: 'payment', label: "To'lov kuni", icon: 'pi pi-calendar' },
  { key: 'verification', label: 'Верификация', icon: 'pi pi-shield' },
  { key: 'done', label: 'Готово', icon: 'pi pi-check-circle' },
];

export interface KatmSummary {
  demandId: string;
  /** Present on resumed sessions (server stamp); the live query response omits it */
  consentId?: string;
  score: number;
  scoringClass: string;
  scoringLevel: string;
  activeLoans: number;
  allDebtSum: number;
  overdueCount: number;
  overdueAmount: number;
  hasDefaults: boolean;
  hasCreditBan: boolean;
}

interface SessionData {
  client: Client | null;
  isNewClient: boolean;
  myidVerified: boolean;
  katmConsent: boolean;
  katmResult: KatmSummary | null;
  /** true while the bureau builds the report asynchronously (ADR-0025) */
  katmPending: boolean;
  selectedCard: Card | null;
  bailsmen: Bailsman[];
  tariff: Tariff | null;
  basket: BasketItem[];
  /** Confirmed prepayment amount in tiyin (ADR-0026); null = no prepayment */
  prepaymentAmount: number | null;
  paymentDay: number | null;
  schedule: DealPaymentSchedule[];
  createdDealId: string | null;
  createdDealNumber: string | null;
}

function emptySession(): SessionData {
  return {
    client: null,
    isNewClient: false,
    myidVerified: false,
    katmConsent: false,
    katmResult: null,
    katmPending: false,
    selectedCard: null,
    bailsmen: [],
    tariff: null,
    basket: [],
    prepaymentAmount: null,
    paymentDay: null,
    schedule: [],
    createdDealId: null,
    createdDealNumber: null,
  };
}

function emptyCompleted(): Record<DealStepKey, boolean> {
  return {
    client: false,
    card: false,
    contacts: false,
    tariff: false,
    products: false,
    payment: false,
    verification: false,
    done: false,
  };
}

export const useDealStore = defineStore(
  'deal',
  () => {
    const currentStep = ref<DealStepKey>('client');
    const completed = ref<Record<DealStepKey, boolean>>(emptyCompleted());
    const sessionData = ref<SessionData>(emptySession());
    /** Server-side Deal Session id (ADR-0024) — set the moment the Wizard opens. */
    const dealSessionId = ref<string | null>(null);
    /** Which step sequence this run follows (reuse scoring). Server-authoritative. */
    const flowMode = ref<DealFlowMode>('full');

    const steps = computed(() => (flowMode.value === 'reuse' ? DEAL_STEPS_REUSE : DEAL_STEPS));

    const currentIndex = computed(() => steps.value.findIndex((x) => x.key === currentStep.value));

    const basketTotal = computed(() =>
      sessionData.value.basket.reduce(
        (sum, i) => sum + Math.round(parseFloat(i.product.price) * 100) * i.quantity,
        0,
      ),
    );

    const basketCount = computed(() =>
      sessionData.value.basket.reduce((n, i) => n + i.quantity, 0),
    );

    function reset() {
      currentStep.value = 'client';
      completed.value = emptyCompleted();
      sessionData.value = emptySession();
      dealSessionId.value = null;
      flowMode.value = 'full';
    }

    function setDealSessionId(id: string) {
      dealSessionId.value = id;
    }

    function setFlowMode(mode: DealFlowMode) {
      flowMode.value = mode;
    }

    /**
     * Rebuild the local wizard state from the server session — the server is
     * the source of truth (ADR-0024); the persisted store is only a cache.
     */
    function hydrateFromSession(dto: DealSessionDto) {
      const data = dto.stepData;
      // Set the flow mode first — the stepper sequence and currentStep validity
      // below depend on it (reuse scoring).
      flowMode.value = data.flowMode === 'reuse' ? 'reuse' : 'full';
      const fresh = emptySession();

      fresh.client = dto.client;
      fresh.isNewClient = data.client?.isNewClient ?? false;
      fresh.myidVerified = data.client?.myidVerified ?? false;
      fresh.katmConsent = data.client?.katmConsent ?? false;

      fresh.katmPending = data.katmPending?.status === 'pending';

      if (data.katm) {
        fresh.katmResult = {
          demandId: data.katm.demandId,
          consentId: data.katm.consentId,
          score: data.katm.score,
          scoringClass: data.katm.scoringClass,
          scoringLevel: data.katm.scoringLevel,
          activeLoans: data.katm.activeLoans,
          allDebtSum: data.katm.allDebtSum,
          overdueCount: data.katm.overdueCount,
          overdueAmount: data.katm.overdueAmount,
          hasDefaults: data.katm.hasDefaults,
          hasCreditBan: data.katm.hasCreditBan,
        };
      }

      if (data.bailsmen?.length) {
        fresh.bailsmen = data.bailsmen as Bailsman[];
      }

      if (data.card) {
        fresh.selectedCard = {
          id: data.card.cardId,
          plumCardId: data.card.cardId,
          pcType: data.card.pcType,
          maskedPan: data.card.maskedPan,
          holderName: data.card.holderName,
          expiry: data.card.expiry,
          bank: data.card.bank,
        };
      }

      if (data.tariff) {
        fresh.tariff = {
          id: data.tariff.tariffId,
          name: data.tariff.name,
          termMonths: data.tariff.termMonths,
          markupPercent: data.tariff.markupPercent,
          minAmount: data.tariff.minAmount != null ? parseInt(data.tariff.minAmount, 10) : null,
          maxAmount: data.tariff.maxAmount != null ? parseInt(data.tariff.maxAmount, 10) : null,
          active: true,
        };
      }

      if (data.products) {
        fresh.basket = data.products.lines.map((line) => ({
          product: {
            id: line.productId,
            merchantId: '',
            categoryId: '',
            name: line.productName,
            price: line.price,
            mxikCode: line.mxikCode,
            packageCode: line.packageCode,
            packageName: line.packageName,
            isLabeled: line.isLabeled ?? false,
            active: true,
            createdAt: '',
          },
          quantity: line.quantity,
          labels: line.labels ?? [],
        }));
      }

      fresh.prepaymentAmount = data.prepayment?.amount ?? null;
      fresh.paymentDay = data.payment?.paymentDay ?? null;

      if (fresh.tariff && fresh.paymentDay) {
        const principal = fresh.basket.reduce(
          (sum, i) => sum + Math.round(parseFloat(i.product.price) * 100) * i.quantity,
          0,
        );
        const totalPayable = Math.round(principal * (1 + fresh.tariff.markupPercent / 100));
        fresh.schedule = buildSchedulePreview(
          totalPayable,
          fresh.tariff.termMonths,
          fresh.paymentDay,
        );
      }

      sessionData.value = fresh;
      dealSessionId.value = dto.id;

      const done = emptyCompleted();
      done.client = !!data.client;
      done.card = !!data.card;
      done.contacts = !!data.bailsmen?.length; // reuse path — contacts == bailsmen saved
      done.tariff = !!data.tariff;
      done.products = !!data.products;
      done.payment = !!data.payment;
      done.verification = false; // verification completes only when the Deal is created
      completed.value = done;

      const step = dto.currentStep as DealStepKey;
      currentStep.value =
        steps.value.some((s) => s.key === step) && step !== 'done' ? step : 'client';
    }

    function goTo(step: DealStepKey) {
      currentStep.value = step;
    }

    function complete(step: DealStepKey) {
      completed.value[step] = true;
      const seq = steps.value;
      const idx = seq.findIndex((x) => x.key === step);
      const next = seq[idx + 1];
      if (next) currentStep.value = next.key;
    }

    function back() {
      const idx = currentIndex.value;
      if (idx > 0) currentStep.value = steps.value[idx - 1].key;
    }

    function setClient(client: Client, opts?: { isNew?: boolean; myidVerified?: boolean }) {
      sessionData.value.client = client;
      sessionData.value.isNewClient = opts?.isNew ?? false;
      sessionData.value.myidVerified = opts?.myidVerified ?? false;
    }

    function setKatmConsent(v: boolean) {
      sessionData.value.katmConsent = v;
    }

    function setKatmResult(result: KatmSummary) {
      sessionData.value.katmResult = result;
      sessionData.value.katmPending = false;
    }

    function setKatmPending(v: boolean) {
      sessionData.value.katmPending = v;
    }

    function setCard(card: Card) {
      sessionData.value.selectedCard = card;
    }

    function setBailsmen(bailsmen: Bailsman[]) {
      sessionData.value.bailsmen = bailsmen;
    }

    function setTariff(tariff: Tariff) {
      sessionData.value.tariff = tariff;
    }

    function setPrepayment(amount: number) {
      sessionData.value.prepaymentAmount = amount;
    }

    function clearPrepayment() {
      sessionData.value.prepaymentAmount = null;
    }

    function addToBasket(product: Product) {
      const existing = sessionData.value.basket.find((i) => i.product.id === product.id);
      if (existing) existing.quantity++;
      else sessionData.value.basket.push({ product, quantity: 1, labels: [] });
      sessionData.value.prepaymentAmount = null;
    }

    /** Add one unit of a labeled product, carrying its unique marking code. */
    function addLabeledUnit(product: Product, label: string) {
      const existing = sessionData.value.basket.find((i) => i.product.id === product.id);
      if (existing) {
        existing.labels.push(label);
        existing.quantity = existing.labels.length;
      } else {
        sessionData.value.basket.push({ product, quantity: 1, labels: [label] });
      }
      sessionData.value.prepaymentAmount = null;
    }

    /** True if a marking code is already used anywhere in the basket. */
    function labelExistsInBasket(label: string): boolean {
      const needle = label.trim();
      return sessionData.value.basket.some((i) => i.labels.includes(needle));
    }

    function incrementItem(productId: string) {
      const i = sessionData.value.basket.find((x) => x.product.id === productId);
      if (i) i.quantity++;
      sessionData.value.prepaymentAmount = null;
    }

    function decrementItem(productId: string) {
      const i = sessionData.value.basket.find((x) => x.product.id === productId);
      if (i && i.quantity > 1) {
        // Labeled lines drop their last marking code along with the unit.
        if (i.product.isLabeled) i.labels.pop();
        i.quantity--;
      } else removeFromBasket(productId);
      sessionData.value.prepaymentAmount = null;
    }

    function removeFromBasket(productId: string) {
      sessionData.value.basket = sessionData.value.basket.filter((i) => i.product.id !== productId);
      sessionData.value.prepaymentAmount = null;
    }

    function setPaymentDay(day: number) {
      sessionData.value.paymentDay = day;
    }

    function setSchedule(rows: DealPaymentSchedule[]) {
      sessionData.value.schedule = rows;
    }

    function setCreatedDealId(id: string, dealNumber?: string | null) {
      sessionData.value.createdDealId = id;
      sessionData.value.createdDealNumber = dealNumber ?? null;
    }

    return {
      currentStep,
      completed,
      sessionData,
      dealSessionId,
      flowMode,
      steps,
      currentIndex,
      basketTotal,
      basketCount,
      reset,
      setDealSessionId,
      setFlowMode,
      hydrateFromSession,
      goTo,
      complete,
      back,
      setClient,
      setKatmConsent,
      setKatmResult,
      setKatmPending,
      setCard,
      setBailsmen,
      setTariff,
      setPrepayment,
      clearPrepayment,
      addToBasket,
      addLabeledUnit,
      labelExistsInBasket,
      incrementItem,
      decrementItem,
      removeFromBasket,
      setPaymentDay,
      setSchedule,
      setCreatedDealId,
    };
  },
  {
    persist: {
      pick: ['currentStep', 'completed', 'sessionData', 'dealSessionId', 'flowMode'],
    },
  },
);
