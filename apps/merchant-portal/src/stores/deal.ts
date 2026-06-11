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
      steps,
      currentIndex,
      basketTotal,
      basketCount,
      reset,
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
      pick: ['currentStep', 'completed', 'sessionData'],
    },
  },
)
