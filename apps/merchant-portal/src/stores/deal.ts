import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type {
  BasketItem,
  Card,
  Client,
  DealPaymentSchedule,
  Product,
  Tariff,
} from '@/types'
import type { DealSessionDto } from '@/composables/use-deal-session-api'
import { buildSchedulePreview } from '@/utils/schedule-preview'

export type DealStepKey =
  | 'client'
  | 'karta'
  | 'tarif'
  | 'mahsulot'
  | 'payment'
  | 'verification'
  | 'done'

export interface DealStep {
  key: DealStepKey
  label: string
  icon: string
}

export const DEAL_STEPS: DealStep[] = [
  { key: 'client', label: 'Клиент', icon: 'pi pi-user' },
  { key: 'karta', label: 'Karta', icon: 'pi pi-credit-card' },
  { key: 'tarif', label: 'Tarif', icon: 'pi pi-percentage' },
  { key: 'mahsulot', label: 'Mahsulot', icon: 'pi pi-shopping-bag' },
  { key: 'payment', label: "To'lov kuni", icon: 'pi pi-calendar' },
  { key: 'verification', label: 'Верификация', icon: 'pi pi-shield' },
  { key: 'done', label: 'Готово', icon: 'pi pi-check-circle' },
]

export interface KatmSummary {
  demandId: string
  consentId: string
  score: number
  scoringClass: string
  scoringLevel: string
  activeLoans: number
  allDebtSum: number
  overdueCount: number
  overdueAmount: number
  hasDefaults: boolean
  hasCreditBan: boolean
}

interface SessionData {
  client: Client | null
  isNewClient: boolean
  myidVerified: boolean
  katmConsent: boolean
  katmResult: KatmSummary | null
  selectedCard: Card | null
  tariff: Tariff | null
  basket: BasketItem[]
  paymentDay: number | null
  schedule: DealPaymentSchedule[]
  createdDealId: string | null
  createdDealNumber: string | null
}

function emptySession(): SessionData {
  return {
    client: null,
    isNewClient: false,
    myidVerified: false,
    katmConsent: false,
    katmResult: null,
    selectedCard: null,
    tariff: null,
    basket: [],
    paymentDay: null,
    schedule: [],
    createdDealId: null,
    createdDealNumber: null,
  }
}

function emptyCompleted(): Record<DealStepKey, boolean> {
  return {
    client: false,
    karta: false,
    tarif: false,
    mahsulot: false,
    payment: false,
    verification: false,
    done: false,
  }
}

export const useDealStore = defineStore(
  'deal',
  () => {
    const currentStep = ref<DealStepKey>('client')
    const completed = ref<Record<DealStepKey, boolean>>(emptyCompleted())
    const sessionData = ref<SessionData>(emptySession())
    /** Server-side Deal Session id (ADR-0024) — set the moment the Wizard opens. */
    const dealSessionId = ref<string | null>(null)

    const steps = computed(() => DEAL_STEPS)

    const currentIndex = computed(() =>
      DEAL_STEPS.findIndex((x) => x.key === currentStep.value),
    )

    const basketTotal = computed(() =>
      sessionData.value.basket.reduce(
        (sum, i) => sum + Math.round(parseFloat(i.product.price) * 100) * i.quantity,
        0,
      ),
    )

    const basketCount = computed(() =>
      sessionData.value.basket.reduce((n, i) => n + i.quantity, 0),
    )

    function reset() {
      currentStep.value = 'client'
      completed.value = emptyCompleted()
      sessionData.value = emptySession()
      dealSessionId.value = null
    }

    function setDealSessionId(id: string) {
      dealSessionId.value = id
    }

    /**
     * Rebuild the local wizard state from the server session — the server is
     * the source of truth (ADR-0024); the persisted store is only a cache.
     */
    function hydrateFromSession(dto: DealSessionDto) {
      const data = dto.stepData
      const fresh = emptySession()

      fresh.client = dto.client
      fresh.isNewClient = data.client?.isNewClient ?? false
      fresh.myidVerified = data.client?.myidVerified ?? false
      fresh.katmConsent = data.client?.katmConsent ?? false

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
        }
      }

      if (data.karta) {
        fresh.selectedCard = {
          id: data.karta.cardId,
          plumCardId: data.karta.cardId,
          pcType: data.karta.pcType,
          maskedPan: data.karta.maskedPan,
          holderName: data.karta.holderName,
          expiry: data.karta.expiry,
          bank: data.karta.bank,
        }
      }

      if (data.tarif) {
        fresh.tariff = {
          id: data.tarif.tariffId,
          name: data.tarif.name,
          termMonths: data.tarif.termMonths,
          markupPercent: data.tarif.markupPercent,
          minAmount: data.tarif.minAmount != null ? parseInt(data.tarif.minAmount, 10) : null,
          maxAmount: data.tarif.maxAmount != null ? parseInt(data.tarif.maxAmount, 10) : null,
          active: true,
        }
      }

      if (data.mahsulot) {
        fresh.basket = data.mahsulot.lines.map((line) => ({
          product: {
            id: line.productId,
            merchantId: '',
            categoryId: '',
            name: line.productName,
            price: line.price,
            mxikCode: line.mxikCode,
            packageCode: line.packageCode,
            packageName: line.packageName,
            active: true,
            createdAt: '',
          },
          quantity: line.quantity,
        }))
      }

      fresh.paymentDay = data.payment?.paymentDay ?? null

      if (fresh.tariff && fresh.paymentDay) {
        const principal = fresh.basket.reduce(
          (sum, i) => sum + Math.round(parseFloat(i.product.price) * 100) * i.quantity,
          0,
        )
        const totalPayable = Math.round(principal * (1 + fresh.tariff.markupPercent / 100))
        fresh.schedule = buildSchedulePreview(totalPayable, fresh.tariff.termMonths, fresh.paymentDay)
      }

      sessionData.value = fresh
      dealSessionId.value = dto.id

      const done = emptyCompleted()
      done.client = !!data.client
      done.karta = !!data.karta
      done.tarif = !!data.tarif
      done.mahsulot = !!data.mahsulot
      done.payment = !!data.payment
      done.verification = false // verification completes only when the Deal is created
      completed.value = done

      const step = dto.currentStep as DealStepKey
      currentStep.value = DEAL_STEPS.some((s) => s.key === step) && step !== 'done' ? step : 'client'
    }

    function goTo(step: DealStepKey) {
      currentStep.value = step
    }

    function complete(step: DealStepKey) {
      completed.value[step] = true
      const idx = DEAL_STEPS.findIndex((x) => x.key === step)
      const next = DEAL_STEPS[idx + 1]
      if (next) currentStep.value = next.key
    }

    function back() {
      const idx = currentIndex.value
      if (idx > 0) currentStep.value = DEAL_STEPS[idx - 1].key
    }

    function setClient(client: Client, opts?: { isNew?: boolean; myidVerified?: boolean }) {
      sessionData.value.client = client
      sessionData.value.isNewClient = opts?.isNew ?? false
      sessionData.value.myidVerified = opts?.myidVerified ?? false
    }

    function setKatmConsent(v: boolean) {
      sessionData.value.katmConsent = v
    }

    function setKatmResult(result: KatmSummary) {
      sessionData.value.katmResult = result
    }

    function setCard(card: Card) {
      sessionData.value.selectedCard = card
    }

    function setTariff(tariff: Tariff) {
      sessionData.value.tariff = tariff
    }

    function addToBasket(product: Product) {
      const existing = sessionData.value.basket.find((i) => i.product.id === product.id)
      if (existing) existing.quantity++
      else sessionData.value.basket.push({ product, quantity: 1 })
    }

    function incrementItem(productId: string) {
      const i = sessionData.value.basket.find((x) => x.product.id === productId)
      if (i) i.quantity++
    }

    function decrementItem(productId: string) {
      const i = sessionData.value.basket.find((x) => x.product.id === productId)
      if (i && i.quantity > 1) i.quantity--
      else removeFromBasket(productId)
    }

    function removeFromBasket(productId: string) {
      sessionData.value.basket = sessionData.value.basket.filter(
        (i) => i.product.id !== productId,
      )
    }

    function setPaymentDay(day: number) {
      sessionData.value.paymentDay = day
    }

    function setSchedule(rows: DealPaymentSchedule[]) {
      sessionData.value.schedule = rows
    }

    function setCreatedDealId(id: string, dealNumber?: string | null) {
      sessionData.value.createdDealId = id
      sessionData.value.createdDealNumber = dealNumber ?? null
    }

    return {
      currentStep,
      completed,
      sessionData,
      dealSessionId,
      steps,
      currentIndex,
      basketTotal,
      basketCount,
      reset,
      setDealSessionId,
      hydrateFromSession,
      goTo,
      complete,
      back,
      setClient,
      setKatmConsent,
      setKatmResult,
      setCard,
      setTariff,
      addToBasket,
      incrementItem,
      decrementItem,
      removeFromBasket,
      setPaymentDay,
      setSchedule,
      setCreatedDealId,
    }
  },
  {
    persist: {
      pick: ['currentStep', 'completed', 'sessionData', 'dealSessionId'],
    },
  },
)
