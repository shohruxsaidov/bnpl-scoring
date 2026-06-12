<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Dialog from 'primevue/dialog'
import { useDealStore, DEAL_STEPS, type DealStepKey } from '@/stores/deal'
import { useClientScoringStore } from '@/stores/client-scoring'
import {
  abandonDealSession,
  createDealSession,
  fetchActiveSession,
  type DealSessionDto,
} from '@/composables/use-deal-session-api'
import type { ScoreDecision } from '@/types'
import StepClient from './steps/step-client.vue'
import StepCard from './steps/step-card.vue'
import StepTariff from './steps/step-tariff.vue'
import StepProducts from './steps/step-products.vue'
import StepPaymentDay from './steps/step-payment-day.vue'
import StepVerification from './steps/step-verification.vue'
import StepDone from './steps/step-done.vue'

const deal = useDealStore()
const scoring = useClientScoringStore()
const { t } = useI18n()

// ── Server session (ADR-0024) ───────────────────────────────────────────────
// The server is the source of truth for a Wizard run. On open we fetch the
// agent's active session: with progress → offer resume; without → adopt it;
// none → open a fresh one. The persisted Pinia store is only a cache.
const sessionError = ref(false)

/**
 * Steps render only after the server session is resolved — otherwise a step
 * could mount with stale localStorage state before hydration replaces it.
 */
const ready = ref(false)

/** The active server session held while the resume dialog is open. */
const pendingSession = ref<DealSessionDto | null>(null)

/** Hydrate the scoring store from the session's server-stamped scoring block. */
function hydrateScoring(dto: DealSessionDto) {
  scoring.reset()
  const s = dto.stepData.scoring
  if (!s) return
  scoring.setCompleted({
    scoringId: s.scoringId ?? `plum-${s.cardId}`,
    scoreSum: s.scoreSum,
    coefficient: s.coefficient,
    decision: s.decision as ScoreDecision,
    platformCreditLimit: s.platformCreditLimit,
    criteriaScores: s.criteriaScores,
  })
}

async function openFreshSession() {
  sessionError.value = false
  try {
    const created = await createDealSession()
    sessionStorage.removeItem('signing_token')
    sessionStorage.removeItem('myid_sign_deal_id')
    deal.reset()
    scoring.reset()
    deal.setDealSessionId(created.id)
    ready.value = true
  } catch {
    sessionError.value = true
  }
}

// ── Resume dialog ───────────────────────────────────────────────────────────
const showResumeDialog = ref(false)

/** True when the persisted store has a client but the deal hasn't been submitted yet. */
const hasInProgressDeal = computed(
  () => deal.sessionData.client !== null && deal.sessionData.createdDealId === null,
)

const resumeClientName = computed(() => {
  const c = pendingSession.value?.client ?? deal.sessionData.client
  if (!c) return ''
  return `${c.firstName} ${c.lastName}`
})

const resumeStepLabel = computed(() =>
  stepLabel(pendingSession.value?.currentStep ?? deal.currentStep),
)

function resumeDeal() {
  showResumeDialog.value = false
  if (pendingSession.value) {
    deal.hydrateFromSession(pendingSession.value)
    hydrateScoring(pendingSession.value)
    pendingSession.value = null
  }
  ready.value = true
}

async function startFresh() {
  showResumeDialog.value = false
  pendingSession.value = null
  // The server auto-abandons the previous active session on create
  await openFreshSession()
}

// ── Close deal ──────────────────────────────────────────────────────────────
const showCloseDialog = ref(false)

/** A draft worth discarding exists and the deal hasn't been submitted. */
const canCloseDeal = computed(
  () => hasInProgressDeal.value && deal.currentStep !== 'done',
)

async function confirmCloseDeal() {
  showCloseDialog.value = false
  const id = deal.dealSessionId
  if (id) {
    try {
      await abandonDealSession(id)
    } catch {
      // Already closed server-side is fine — a fresh session replaces it anyway
    }
  }
  await openFreshSession()
}

// ── Step labels ─────────────────────────────────────────────────────────────
const STEP_LABEL_KEYS: Record<string, string> = {
  client: 'deal.stepClient',
  card: 'deal.stepCard',
  tariff: 'deal.stepTariff',
  products: 'deal.stepProducts',
  payment: 'deal.stepPayment',
  verification: 'deal.stepVerification',
  done: 'deal.stepDone',
}

function stepLabel(key: string): string {
  return STEP_LABEL_KEYS[key] ? t(STEP_LABEL_KEYS[key]) : key
}

const mobileStepLabel = computed(() => {
  const idx = deal.currentIndex
  const label = stepLabel(deal.currentStep)
  return `${idx + 1} / ${deal.steps.length} — ${label}`
})

onMounted(async () => {
  // 1. Returning from MyID registration callback — wizard state (incl. the
  //    server session id) survived in the persisted store; just continue.
  const fromReg = sessionStorage.getItem('myid_callback_complete')
  if (fromReg) {
    sessionStorage.removeItem('myid_callback_complete')
    ready.value = true
    return
  }

  // 2. Returning from MyID signing callback.
  const fromSign =
    sessionStorage.getItem('myid_sign_deal_id') ||
    sessionStorage.getItem('myid_sign_failed')
  if (fromSign) {
    // If the callback already created the deal, advance straight to StepDone.
    const dealId = sessionStorage.getItem('myid_sign_deal_id')
    if (dealId) {
      const dealNumber = sessionStorage.getItem('myid_sign_deal_number')
      sessionStorage.removeItem('myid_sign_deal_id')
      sessionStorage.removeItem('myid_sign_deal_number')
      sessionStorage.removeItem('myid_sign_complete')
      deal.setCreatedDealId(dealId, dealNumber)
      deal.complete('verification') // moves currentStep → 'done'
    }
    // Flags (myid_sign_complete / myid_sign_failed) intentionally left for StepVerification
    // to read in case the deal was NOT created (e.g. network error during step 2).
    ready.value = true
    return
  }

  // 3. Server truth: fetch the agent's active session.
  await initSession()
})

async function initSession() {
  sessionError.value = false
  let active: DealSessionDto | null = null
  try {
    active = await fetchActiveSession()
  } catch {
    sessionError.value = true
    return
  }

  if (active && active.stepData.client) {
    // In-progress run — ask the agent whether to continue or start fresh.
    pendingSession.value = active
    showResumeDialog.value = true
    return
  }

  if (active) {
    // An empty run (opened but nothing saved) — adopt it silently.
    sessionStorage.removeItem('signing_token')
    deal.reset()
    scoring.reset()
    deal.setDealSessionId(active.id)
    ready.value = true
    return
  }

  // No active session — open a fresh run.
  await openFreshSession()
}

// ── Step ↔ URL sync (browser back/forward navigates between steps) ─────────
const route = useRoute()
const router = useRouter()

function stepIndex(key: string): number {
  return DEAL_STEPS.findIndex((s) => s.key === key)
}

onMounted(() => {
  if (route.query.step !== deal.currentStep) {
    router.replace({ query: { ...route.query, step: deal.currentStep } })
  }
})

// Store → URL: each step change becomes a history entry.
watch(
  () => deal.currentStep,
  (step) => {
    if (route.name !== 'deals-create' || route.query.step === step) return
    router.push({ query: { ...route.query, step } })
  },
)

// URL → store: browser back/forward (or a hand-edited query) moves the wizard.
watch(
  () => route.query.step,
  (q) => {
    if (route.name !== 'deals-create') return
    const step = typeof q === 'string' ? (q as DealStepKey) : null
    if (!step || step === deal.currentStep) return

    const idx = stepIndex(step)
    const reachable =
      idx !== -1 && (idx < deal.currentIndex || deal.completed[step])

    // Once the deal is submitted, or the target step is unreachable,
    // snap the URL back to the actual step instead of moving the wizard.
    if (deal.currentStep === 'done' || !reachable) {
      router.replace({ query: { ...route.query, step: deal.currentStep } })
      return
    }
    deal.goTo(step)
  },
)

function stepState(idx: number, key: string): 'done' | 'current' | 'todo' {
  if (deal.completed[key as keyof typeof deal.completed]) return 'done'
  if (idx === deal.currentIndex) return 'current'
  return 'todo'
}
</script>

<template>
  <div class="new-deal">
    <!-- ── Resume dialog ──────────────────────────────────────────────────── -->
    <Dialog v-model:visible="showResumeDialog" :header="t('deal.resumeTitle')" modal :closable="false"
      :style="{ width: '26rem' }">
      <div class="resume-body">
        <i class="pi pi-history resume-icon" />
        <p class="resume-client">{{ t('deal.resumeClient', { name: resumeClientName }) }}</p>
        <p class="resume-step">{{ t('deal.resumeStep', { step: resumeStepLabel }) }}</p>
      </div>

      <template #footer>
        <button class="p-button p-button-outlined p-button-sm" @click="startFresh">
          {{ t('deal.resumeStartFresh') }}
        </button>
        <button class="p-button p-button-sm" @click="resumeDeal">
          <i class="pi pi-play-circle" />
          {{ t('deal.resumeContinue') }}
        </button>
      </template>
    </Dialog>

    <!-- ── Close deal confirmation ───────────────────────────────────────── -->
    <Dialog v-model:visible="showCloseDialog" :header="t('deal.closeConfirmTitle')" modal
      :style="{ width: '26rem' }">
      <p class="close-confirm-body">{{ t('deal.closeConfirmBody', { name: resumeClientName }) }}</p>
      <template #footer>
        <button class="p-button p-button-outlined p-button-sm" @click="showCloseDialog = false">
          {{ t('deal.closeConfirmCancel') }}
        </button>
        <button class="p-button p-button-danger p-button-sm" @click="confirmCloseDeal">
          <i class="pi pi-times" />
          {{ t('deal.closeConfirmAction') }}
        </button>
      </template>
    </Dialog>

    <!-- ── Session error (server unreachable — wizard cannot run) ────────── -->
    <div v-if="sessionError" class="session-error surface-card">
      <i class="pi pi-exclamation-triangle" />
      <span>{{ t('deal.sessionError') }}</span>
      <button class="p-button p-button-sm" @click="initSession">
        <i class="pi pi-refresh" /> {{ t('common.retry') }}
      </button>
    </div>

    <!-- ── Step indicator ────────────────────────────────────────────────── -->
    <div class="stepper surface-card">
      <div v-if="canCloseDeal" class="stepper-bar">
        <button class="close-deal-btn" @click="showCloseDialog = true">
          <i class="pi pi-times" /> {{ t('deal.closeDeal') }}
        </button>
      </div>
      <div class="steps-row">
        <div v-for="(step, idx) in deal.steps" :key="step.key" class="step" :class="stepState(idx, step.key)">
          <div class="step-icon">
            <i v-if="stepState(idx, step.key) === 'done'" class="pi pi-check" />
            <i v-else :class="step.icon" />
          </div>
          <span class="step-label">{{ stepLabel(step.key) }}</span>
          <div v-if="idx < deal.steps.length - 1" class="connector" />
        </div>
        <div class="step-mobile-label">{{ mobileStepLabel }}</div>
      </div>
    </div>

    <!-- ── Active step (rendered only once the server session is resolved) ── -->
    <div v-if="ready" class="step-body">
      <StepClient v-if="deal.currentStep === 'client'" />
      <StepCard v-else-if="deal.currentStep === 'card'" />
      <StepTariff v-else-if="deal.currentStep === 'tariff'" />
      <StepProducts v-else-if="deal.currentStep === 'products'" />
      <StepPaymentDay v-else-if="deal.currentStep === 'payment'" />
      <StepVerification v-else-if="deal.currentStep === 'verification'" />
      <StepDone v-else-if="deal.currentStep === 'done'" />
    </div>
    <div v-else-if="!sessionError" class="step-body step-body-loading">
      <i class="pi pi-spin pi-spinner" />
    </div>
  </div>
</template>

<style scoped>
.new-deal {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
}

/* ── Stepper ───────────────────────────────────────────────────────────────*/
.stepper {
  display: flex;
  flex-direction: column;
  padding: 1rem 1.8rem 1.5rem;
}

.stepper-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.6rem;
}

.session-error {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.9rem 1.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--danger);
}

.session-error .p-button {
  margin-left: auto;
}

.steps-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

/* Without the close button, keep the original vertical padding */
.stepper:not(:has(.stepper-bar)) {
  padding-top: 1.5rem;
}

.close-deal-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-deal-btn:hover {
  color: var(--danger);
  border-color: var(--danger);
}

.close-confirm-body {
  margin: 0;
  padding: 0.5rem 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  flex: 1;
}

.step-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--bg-surface);
  border: 2px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 1.05rem;
  z-index: 2;
  transition: all 0.2s ease;
}

.step.current .step-icon {
  background: var(--gradient-hero);
  border-color: transparent;
  color: #fff;
  box-shadow: var(--accent-glow);
}

.step.done .step-icon {
  background: var(--success);
  border-color: transparent;
  color: #fff;
}

.step-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.step.current .step-label {
  color: var(--accent-2);
}

.step.done .step-label {
  color: var(--success);
}

.connector {
  position: absolute;
  top: 22px;
  left: calc(50% + 28px);
  right: calc(-50% + 28px);
  height: 2px;
  background: var(--border-subtle);
  z-index: 1;
}

.step.done .connector {
  background: var(--success);
}

.step-body {
  min-height: 400px;
}

.step-body-loading {
  display: grid;
  place-items: center;
  font-size: 1.6rem;
  color: var(--text-secondary);
}

/* ── Resume dialog body ────────────────────────────────────────────────────*/
.resume-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 0 0.5rem;
  text-align: center;
}

.resume-icon {
  font-size: 2.5rem;
  color: var(--accent-2);
}

.resume-client {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.resume-step {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
}

.step-mobile-label {
  display: none;
}

@media (max-width: 450px) {
  .stepper {
    padding: 0.85rem 1rem 0.7rem;
  }
  .steps-row {
    flex-wrap: wrap;
    gap: 0;
  }
  .step { gap: 0.3rem; }
  .step-label { display: none; }
  .step-icon { width: 36px; height: 36px; font-size: 0.85rem; }
  .connector { top: 18px; }
  .step-mobile-label {
    display: block;
    width: 100%;
    margin-top: 0.65rem;
    padding-top: 0.65rem;
    border-top: 1px solid var(--border-subtle);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--accent-2);
    text-align: center;
  }
}
</style>
