<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import MonoAmount from '@/components/MonoAmount.vue'
import { useScoringStore } from '@/stores/scoring'
import { API_URL } from '@/stores/auth'

useI18n()
const scoring = useScoringStore()

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------

type Step = 'limit' | 'intro' | 'katm' | 'card' | 'otp' | 'scoring' | 'error'

const step = ref<Step>('intro')
const error = ref('')

// card step
const cardNumber = ref('')
const cardExpiry = ref('')

// session tracking
const sessionId = ref('')
const plumgateSessionId = ref('')
const maskedPhone = ref('')
const confirmedCard = ref<{ plumCardId: string; pcType: 'uzcard' | 'humo'; maskedPan: string } | null>(null)
const otp = ref('')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any).code ?? 'error')
  return data as T
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function genConsentId(): string {
  return 'CS-' + Date.now().toString(36).toUpperCase()
}

// ---------------------------------------------------------------------------
// Init: load limit then decide starting step
// ---------------------------------------------------------------------------

onMounted(async () => {
  if (!scoring.loaded) {
    await scoring.fetchLimit()
  }
  step.value = scoring.limit ? 'limit' : 'intro'
})

// ---------------------------------------------------------------------------
// Step transitions
// ---------------------------------------------------------------------------

async function startScoring() {
  step.value = 'katm'
  error.value = ''
  try {
    const data = await apiFetch<{ sessionId: string }>('/client/scoring/start', {
      consentId: genConsentId(),
      consentDate: today(),
    })
    sessionId.value = data.sessionId
    step.value = 'card'
  } catch (e: any) {
    error.value = e.message ?? 'error'
    step.value = 'error'
  }
}

async function addCard() {
  const raw = cardNumber.value.replace(/\s/g, '')
  step.value = 'otp'
  error.value = ''
  try {
    const data = await apiFetch<{ sessionId: string; maskedPhone: string }>(
      `/client/scoring/${sessionId.value}/card/add`,
      { cardNumber: raw, expiry: cardExpiry.value },
    )
    plumgateSessionId.value = data.sessionId
    maskedPhone.value = data.maskedPhone
  } catch (e: any) {
    error.value = e.message ?? 'error'
    step.value = 'error'
  }
}

async function confirmOtp() {
  error.value = ''
  try {
    const data = await apiFetch<{ card: { plumCardId: string; pcType: 'uzcard' | 'humo'; maskedPan: string } }>(
      `/client/scoring/${sessionId.value}/card/confirm`,
      { plumgateSessionId: plumgateSessionId.value, otp: otp.value },
    )
    confirmedCard.value = data.card
    await runCardScoring()
  } catch (e: any) {
    error.value = e.message ?? 'error'
    step.value = 'error'
  }
}

async function runCardScoring() {
  if (!confirmedCard.value) return
  step.value = 'scoring'
  try {
    const data = await apiFetch<{ platformCreditLimit: number; scoreSum: number; decision: string; scoredAt?: string }>(
      `/client/scoring/${sessionId.value}/card/score`,
      { plumCardId: confirmedCard.value.plumCardId, pcType: confirmedCard.value.pcType },
    )
    scoring.setLimit({ limitAmount: data.platformCreditLimit, scoredAt: new Date().toISOString() })
    step.value = 'limit'
  } catch (e: any) {
    error.value = e.message ?? 'error'
    step.value = 'error'
  }
}

function retry() {
  sessionId.value = ''
  plumgateSessionId.value = ''
  maskedPhone.value = ''
  confirmedCard.value = null
  otp.value = ''
  cardNumber.value = ''
  cardExpiry.value = ''
  error.value = ''
  step.value = 'intro'
}

const backLimitStep = () => {
  step.value = 'limit'
  scoring.fetchLimit()
}

function startRescore() {
  scoring.clearLimit()
  retry()
}

// ---------------------------------------------------------------------------
// Card number formatting
// ---------------------------------------------------------------------------

function onCardInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 16)
  cardNumber.value = raw.replace(/(.{4})/g, '$1 ').trim()
}

function onExpiryInput(e: Event) {
  let raw = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4)
  if (raw.length > 2) raw = raw.slice(0, 2) + '/' + raw.slice(2)
  cardExpiry.value = raw
}

const cardValid = computed(() => {
  const digits = cardNumber.value.replace(/\s/g, '')
  return digits.length === 16 && /^\d+$/.test(digits) && /^\d{2}\/\d{2}$/.test(cardExpiry.value)
})
</script>

<template>
  <div class="scoring-page">

    <!-- ── Limit display ───────────────────────────────────────────────────── -->
    <div v-if="step === 'limit' && scoring.limit" class="limit-view">
      <div class="limit-hero">
        <div class="limit-label">{{ $t('scoring.yourLimit') }}</div>
        <MonoAmount :value="scoring.limit.limitAmount" size="xl" :gradient="false" class="limit-amount" />
        <div class="limit-updated">
          {{ $t('scoring.updatedOn', { date: formatDate(scoring.limit.scoredAt) }) }}
        </div>
      </div>

      <div class="limit-card surface-card">
        <div class="lc-row">
          <i class="pi pi-check-circle lc-icon success" />
          <div>
            <div class="lc-title">{{ $t('scoring.katmChecked') }}</div>
            <div class="lc-sub">{{ $t('scoring.katmCheckedSub') }}</div>
          </div>
        </div>
        <div class="lc-row">
          <i class="pi pi-credit-card lc-icon" />
          <div>
            <div class="lc-title">{{ $t('scoring.cardScored') }}</div>
            <div class="lc-sub">{{ $t('scoring.cardScoredSub') }}</div>
          </div>
        </div>
      </div>

      <button class="btn-ghost rescore-btn" @click="startRescore">
        <i class="pi pi-refresh" />
        {{ $t('scoring.rescore') }}
      </button>
    </div>

    <!-- ── Intro ───────────────────────────────────────────────────────────── -->
    <div v-else-if="step === 'intro'" class="wizard-view">
      <div class="wz-hero">
        <div class="wz-icon-wrap">
          <i class="pi pi-star-fill wz-hero-icon" />
        </div>
        <h1 class="wz-title">{{ $t('scoring.introTitle') }}</h1>
        <p class="wz-sub">{{ $t('scoring.introSub') }}</p>
      </div>

      <div class="wz-steps surface-card">
        <div class="wz-step-row">
          <span class="step-num">1</span>
          <span class="step-text">{{ $t('scoring.step1') }}</span>
        </div>
        <div class="wz-step-row">
          <span class="step-num">2</span>
          <span class="step-text">{{ $t('scoring.step2') }}</span>
        </div>
        <div class="wz-step-row">
          <span class="step-num">3</span>
          <span class="step-text">{{ $t('scoring.step3') }}</span>
        </div>
      </div>

      <div class="consent-block surface-card">
        <p class="consent-text">{{ $t('scoring.consentText') }}</p>
      </div>

      <button class="btn-ghost wz-btn" @click="backLimitStep">
        {{ $t('common.back') }}
      </button>
      <button class="btn-gradient wz-btn" @click="startScoring">
        {{ $t('scoring.startBtn') }}
      </button>
    </div>

    <!-- ── KATM loading ────────────────────────────────────────────────────── -->
    <div v-else-if="step === 'katm'" class="loading-view">
      <div class="loading-spinner" />
      <div class="loading-title">{{ $t('scoring.katmRunning') }}</div>
      <div class="loading-sub">{{ $t('scoring.katmRunningSub') }}</div>
    </div>

    <!-- ── Card entry ──────────────────────────────────────────────────────── -->
    <div v-else-if="step === 'card'" class="wizard-view">
      <div class="wz-header">
        <div class="wz-step-badge">2 / 3</div>
        <h2 class="wz-step-title">{{ $t('scoring.cardTitle') }}</h2>
        <p class="wz-step-sub">{{ $t('scoring.cardSub') }}</p>
      </div>

      <div class="form-card surface-card">
        <label class="field-label">{{ $t('scoring.cardNumber') }}</label>
        <input class="field-input font-mono" :value="cardNumber" placeholder="0000 0000 0000 0000" inputmode="numeric"
          maxlength="19" @input="onCardInput" />

        <label class="field-label mt">{{ $t('scoring.cardExpiry') }}</label>
        <input class="field-input font-mono" :value="cardExpiry" placeholder="MM/YY" inputmode="numeric" maxlength="5"
          @input="onExpiryInput" />
      </div>

      <button class="btn-gradient wz-btn" :disabled="!cardValid" @click="addCard">
        {{ $t('scoring.cardBtn') }}
      </button>
    </div>

    <!-- ── OTP ────────────────────────────────────────────────────────────── -->
    <div v-else-if="step === 'otp'" class="wizard-view">
      <div class="wz-header">
        <div class="wz-step-badge">3 / 3</div>
        <h2 class="wz-step-title">{{ $t('scoring.otpTitle') }}</h2>
        <p v-if="maskedPhone" class="wz-step-sub">
          {{ $t('scoring.otpSentTo', { phone: maskedPhone }) }}
        </p>
        <p v-else class="wz-step-sub">{{ $t('scoring.otpSub') }}</p>
      </div>

      <div class="form-card surface-card">
        <label class="field-label">{{ $t('scoring.otpCode') }}</label>
        <input v-model="otp" class="field-input font-mono otp-input" placeholder="• • • •" inputmode="numeric"
          maxlength="8" />
      </div>

      <button class="btn-gradient wz-btn" :disabled="otp.length < 4" @click="confirmOtp">
        {{ $t('scoring.otpBtn') }}
      </button>
    </div>

    <!-- ── Card scoring loading ────────────────────────────────────────────── -->
    <div v-else-if="step === 'scoring'" class="loading-view">
      <div class="loading-spinner" />
      <div class="loading-title">{{ $t('scoring.scoringRunning') }}</div>
      <div class="loading-sub">{{ $t('scoring.scoringRunningSub') }}</div>
    </div>

    <!-- ── Error ───────────────────────────────────────────────────────────── -->
    <div v-else-if="step === 'error'" class="error-view">
      <div class="error-icon-wrap">
        <i class="pi pi-times-circle error-icon" />
      </div>
      <div class="error-title">{{ $t('scoring.errorTitle') }}</div>
      <div class="error-sub">{{ $t('scoring.errorSub') }}</div>
      <button class="btn-gradient wz-btn" @click="retry">
        <i class="pi pi-refresh" />
        {{ $t('scoring.retryBtn') }}
      </button>
    </div>

  </div>
</template>

<style scoped>
.scoring-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 8rem);
  padding-bottom: 1rem;
}

/* ── Limit display ─────────────────────────────────────────────────────────── */
.limit-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.limit-hero {
  background: var(--gradient-hero);
  border-radius: 24px;
  padding: 2rem 1.5rem;
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: var(--accent-glow);
}

.limit-amount {
  color: #fff;
}

.limit-label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.85;
}

.limit-updated {
  font-size: 0.8rem;
  opacity: 0.75;
  margin-top: 0.25rem;
}

.limit-card {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lc-row {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}

.lc-icon {
  font-size: 1.2rem;
  color: var(--accent-2);
  margin-top: 0.1rem;
  flex-shrink: 0;
}

.lc-icon.success {
  color: var(--success);
}

.lc-title {
  font-size: 0.9rem;
  font-weight: 700;
}

.lc-sub {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
}

.rescore-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

/* ── Wizard shared ─────────────────────────────────────────────────────────── */
.wizard-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.wz-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.75rem;
  padding: 1rem 0 0.5rem;
}

.wz-icon-wrap {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--gradient-hero);
  display: grid;
  place-items: center;
  box-shadow: var(--accent-glow);
}

.wz-hero-icon {
  font-size: 1.8rem;
  color: #fff;
}

.wz-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
}

.wz-sub {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  max-width: 280px;
}

.wz-steps {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.wz-step-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--gradient-hero);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 800;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.step-text {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.consent-block {
  padding: 1rem 1.25rem;
}

.consent-text {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.55;
}

.wz-header {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.wz-step-badge {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: var(--gradient-hero);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

.wz-step-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
}

.wz-step-sub {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.form-card {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
}

.field-input {
  width: 100%;
  background: var(--bg-surface);
  border: 1.5px solid var(--border-subtle);
  border-radius: 12px;
  padding: 0.85rem 1rem;
  font-size: 1rem;
  color: var(--text-primary);
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}

.field-input:focus {
  border-color: var(--accent-2);
}

.mt {
  margin-top: 1.1rem;
}

.otp-input {
  font-size: 1.4rem;
  text-align: center;
  letter-spacing: 0.2em;
}

.wz-btn {
  width: 100%;
}

/* ── Loading ───────────────────────────────────────────────────────────────── */
.loading-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  flex: 1;
  padding: 3rem 1rem;
}

.loading-spinner {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 4px solid var(--border-subtle);
  border-top-color: var(--accent-2);
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-title {
  font-size: 1.1rem;
  font-weight: 800;
  text-align: center;
}

.loading-sub {
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-align: center;
  max-width: 240px;
}

/* ── Error ─────────────────────────────────────────────────────────────────── */
.error-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex: 1;
  padding: 3rem 1rem;
}

.error-icon-wrap {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--danger-bg);
  display: grid;
  place-items: center;
}

.error-icon {
  font-size: 2rem;
  color: var(--danger);
}

.error-title {
  font-size: 1.1rem;
  font-weight: 800;
  text-align: center;
}

.error-sub {
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-align: center;
  max-width: 240px;
}
</style>
