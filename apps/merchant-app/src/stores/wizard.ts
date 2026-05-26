import { defineStore } from 'pinia'
import type {
  BasketItem,
  Card,
  CardScoreResult,
  Client,
  Product,
  ScheduleRow,
  Tariff,
} from '@/types'

export type WizardStepKey =
  | 'client'
  | 'karta'
  | 'tarif'
  | 'mahsulot'
  | 'payment'
  | 'verification'
  | 'done'

export interface WizardStep {
  key: WizardStepKey
  label: string
  icon: string
}

export const WIZARD_STEPS: WizardStep[] = [
  { key: 'client', label: 'Клиент', icon: 'pi pi-user' },
  { key: 'karta', label: 'Karta', icon: 'pi pi-credit-card' },
  { key: 'tarif', label: 'Tarif', icon: 'pi pi-percentage' },
  { key: 'mahsulot', label: 'Mahsulot', icon: 'pi pi-shopping-bag' },
  { key: 'payment', label: "To'lov kuni", icon: 'pi pi-calendar' },
  { key: 'verification', label: 'Верификация', icon: 'pi pi-shield' },
  { key: 'done', label: 'Готово', icon: 'pi pi-check-circle' },
]

interface SessionData {
  client: Client | null
  isNewClient: boolean
  myidVerified: boolean
  katmConsent: boolean
  selectedCard: Card | null
  cardScore: CardScoreResult | null
  tariff: Tariff | null
  basket: BasketItem[]
  paymentDay: number
  schedule: ScheduleRow[]
  createdDealId: string | null
}

function emptySession(): SessionData {
  return {
    client: null,
    isNewClient: false,
    myidVerified: false,
    katmConsent: false,
    selectedCard: null,
    cardScore: null,
    tariff: null,
    basket: [],
    paymentDay: 5,
    schedule: [],
    createdDealId: null,
  }
}

interface WizardState {
  currentStep: WizardStepKey
  completed: Record<WizardStepKey, boolean>
  sessionData: SessionData
}

export const useWizardStore = defineStore('wizard', {
  state: (): WizardState => ({
    currentStep: 'client',
    completed: {
      client: false,
      karta: false,
      tarif: false,
      mahsulot: false,
      payment: false,
      verification: false,
      done: false,
    },
    sessionData: emptySession(),
  }),

  getters: {
    steps: (): WizardStep[] => WIZARD_STEPS,

    currentIndex: (s): number =>
      WIZARD_STEPS.findIndex((x) => x.key === s.currentStep),

    basketTotal: (s): number =>
      s.sessionData.basket.reduce(
        (sum, i) => sum + Math.round(parseFloat(i.product.tanNarxi) * 100) * i.quantity,
        0,
      ),

    basketCount: (s): number =>
      s.sessionData.basket.reduce((n, i) => n + i.quantity, 0),
  },

  actions: {
    reset() {
      this.currentStep = 'client'
      this.completed = {
        client: false,
        karta: false,
        tarif: false,
        mahsulot: false,
        payment: false,
        verification: false,
        done: false,
      }
      this.sessionData = emptySession()
    },

    goTo(step: WizardStepKey) {
      this.currentStep = step
    },

    complete(step: WizardStepKey) {
      this.completed[step] = true
      const idx = WIZARD_STEPS.findIndex((x) => x.key === step)
      const next = WIZARD_STEPS[idx + 1]
      if (next) this.currentStep = next.key
    },

    back() {
      const idx = this.currentIndex
      if (idx > 0) this.currentStep = WIZARD_STEPS[idx - 1].key
    },

    // -- Session mutations --
    setClient(client: Client, opts?: { isNew?: boolean; myidVerified?: boolean }) {
      this.sessionData.client = client
      this.sessionData.isNewClient = opts?.isNew ?? false
      this.sessionData.myidVerified = opts?.myidVerified ?? false
    },
    setKatmConsent(v: boolean) {
      this.sessionData.katmConsent = v
    },
    setCard(card: Card) {
      this.sessionData.selectedCard = card
    },
    setCardScore(result: CardScoreResult) {
      this.sessionData.cardScore = result
    },
    setTariff(tariff: Tariff) {
      this.sessionData.tariff = tariff
    },
    addToBasket(product: Product) {
      const existing = this.sessionData.basket.find(
        (i) => i.product.id === product.id,
      )
      if (existing) existing.quantity++
      else this.sessionData.basket.push({ product, quantity: 1 })
    },
    incrementItem(productId: string) {
      const i = this.sessionData.basket.find((x) => x.product.id === productId)
      if (i) i.quantity++
    },
    decrementItem(productId: string) {
      const i = this.sessionData.basket.find((x) => x.product.id === productId)
      if (i && i.quantity > 1) i.quantity--
      else this.removeFromBasket(productId)
    },
    removeFromBasket(productId: string) {
      this.sessionData.basket = this.sessionData.basket.filter(
        (i) => i.product.id !== productId,
      )
    },
    setPaymentDay(day: number) {
      this.sessionData.paymentDay = day
    },
    setSchedule(rows: ScheduleRow[]) {
      this.sessionData.schedule = rows
    },
    setCreatedDealId(id: string) {
      this.sessionData.createdDealId = id
    },
  },
})
