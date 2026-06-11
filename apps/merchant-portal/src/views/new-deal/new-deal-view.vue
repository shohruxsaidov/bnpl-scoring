<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Dialog from 'primevue/dialog'
import { useDealStore, DEAL_STEPS, type DealStepKey } from '@/stores/deal'
import { useClientScoringStore } from '@/stores/client-scoring'
import StepClient from './steps/step-client.vue'
import StepKarta from './steps/step-karta.vue'
import StepTarif from './steps/step-tarif.vue'
import StepMahsulot from './steps/step-mahsulot.vue'
import StepPaymentDay from './steps/step-payment-day.vue'
import StepVerification from './steps/step-verification.vue'
import StepDone from './steps/step-done.vue'

const deal = useDealStore()
const scoring = useClientScoringStore()
const { t } = useI18n()

// ── Resume dialog ───────────────────────────────────────────────────────────
const showResumeDialog = ref(false)

/** True when the persisted store has a client but the deal hasn't been submitted yet. */
const hasInProgressDeal = computed(
  () => deal.sessionData.client !== null && deal.sessionData.createdDealId === null,
)

const resumeClientName = computed(() => {
  const c = deal.sessionData.client
  if (!c) return ''
  return `${c.firstName} ${c.lastName}`
})

const resumeStepLabel = computed(() => stepLabel(deal.currentStep))

function resumeDeal() {
  showResumeDialog.value = false
  // Deal state is already loaded from localStorage — just let the user continue.
}

function startFresh() {
  showResumeDialog.value = false
  sessionStorage.removeItem('signing_token')
  sessionStorage.removeItem('myid_sign_deal_id')
  deal.reset()
  scoring.reset()
}

// ── Step labels ─────────────────────────────────────────────────────────────
const STEP_LABEL_KEYS: Record<string, string> = {
  client: 'deal.stepClient',
  karta: 'deal.stepKarta',
  tarif: 'deal.stepTarif',
  mahsulot: 'deal.stepMahsulot',
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

onMounted(() => {
  const fromReg = sessionStorage.getItem('myid_callback_complete')
  if (fromReg) {
    sessionStorage.removeItem('myid_callback_complete')
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
    return
  }

  // 3. Persisted in-progress deal — ask agent whether to continue or start fresh.
  if (hasInProgressDeal.value) {
    showResumeDialog.value = true
    return
  }

  // 4. No prior session — clean slate.
  sessionStorage.removeItem('signing_token')
  deal.reset()
  scoring.reset()
})

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

    <!-- ── Step indicator ────────────────────────────────────────────────── -->
    <div class="stepper surface-card">
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

    <!-- ── Active step ───────────────────────────────────────────────────── -->
    <div class="step-body">
      <StepClient v-if="deal.currentStep === 'client'" />
      <StepKarta v-else-if="deal.currentStep === 'karta'" />
      <StepTarif v-else-if="deal.currentStep === 'tarif'" />
      <StepMahsulot v-else-if="deal.currentStep === 'mahsulot'" />
      <StepPaymentDay v-else-if="deal.currentStep === 'payment'" />
      <StepVerification v-else-if="deal.currentStep === 'verification'" />
      <StepDone v-else-if="deal.currentStep === 'done'" />
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
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.5rem 1.8rem;
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
    flex-wrap: wrap;
    padding: 0.85rem 1rem 0.7rem;
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
