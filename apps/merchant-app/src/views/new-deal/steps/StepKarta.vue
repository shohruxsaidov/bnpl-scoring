<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import { useDealStore } from '@/stores/deal'
import { useClientScoringStore } from '@/stores/clientScoring'
import { apiFetch } from '@/utils/apiFetch'
import type { Card, CardScoreResult, ScoreDecision } from '@/types'

const deal = useDealStore()
const clientScoring = useClientScoringStore()
const { t } = useI18n()

// ── Card list ────────────────────────────────────────────────────────────────

const cards = ref<Card[]>([])
const loadingCards = ref(false)
const loadCardsError = ref<string | null>(null)

async function fetchCards() {
  const clientId = deal.sessionData.client?.id
  if (!clientId) return

  loadingCards.value = true
  loadCardsError.value = null
  try {
    const data = await apiFetch<{ cards: Card[] }>(
      `/merchant/cards?clientId=${clientId}`,
    )
    cards.value = data.cards
    // Restore previously selected card if it still exists in the list
    if (deal.sessionData.selectedCard) {
      const stillExists = cards.value.some(
        (c) => c.plumCardId === deal.sessionData.selectedCard?.plumCardId,
      )
      if (!stillExists) deal.setCard(null as unknown as Card)
    }
  } catch {
    loadCardsError.value = t('stepKarta.loadCardsError')
  } finally {
    loadingCards.value = false
  }
}

onMounted(fetchCards)

// ── Card selection ───────────────────────────────────────────────────────────

const selectedId = ref<string | null>(
  deal.sessionData.selectedCard?.plumCardId ?? null,
)

function selectCard(plumCardId: string) {
  selectedId.value = plumCardId
  // Reset scoring result when switching cards
  result.value = null
  scoreError.value = null
}

const selectedCard = computed(() =>
  cards.value.find((c) => c.plumCardId === selectedId.value),
)

// ── Add card flow ────────────────────────────────────────────────────────────

const adding = ref(false)
const newPan = ref('')
const newExpiry = ref('')

// OTP phase
const addSessionId = ref<string | null>(null)
const maskedPhone = ref<string | null>(null)
const otpCode = ref('')
const addLoading = ref(false)
const addError = ref<string | null>(null)

function openAddForm() {
  adding.value = true
  addSessionId.value = null
  maskedPhone.value = null
  otpCode.value = ''
  newPan.value = ''
  newExpiry.value = ''
  addError.value = null
}

function cancelAdd() {
  adding.value = false
  addSessionId.value = null
  maskedPhone.value = null
  otpCode.value = ''
  newPan.value = ''
  newExpiry.value = ''
  addError.value = null
}

async function requestAddCard() {
  if (!/^\d{4} \d{4} \d{4} \d{4}$/.test(newPan.value)) return
  if (!newExpiry.value) return

  addLoading.value = true
  addError.value = null
  try {
    const data = await apiFetch<{ sessionId: string; maskedPhone: string }>(
      '/merchant/cards/add',
      {
        method: 'POST',
        body: JSON.stringify({
          clientId: deal.sessionData.client?.id,
          cardNumber: newPan.value,
          expiry: newExpiry.value,
        }),
      },
    )
    addSessionId.value = data.sessionId
    maskedPhone.value = data.maskedPhone
  } catch {
    addError.value = t('stepKarta.addCardError')
  } finally {
    addLoading.value = false
  }
}

async function confirmOtp() {
  if (!addSessionId.value || otpCode.value.length < 4) return

  addLoading.value = true
  addError.value = null
  try {
    const data = await apiFetch<{ card: Card }>(
      '/merchant/cards/confirm',
      {
        method: 'POST',
        body: JSON.stringify({ sessionId: addSessionId.value, otp: otpCode.value }),
      },
    )
    cards.value.push(data.card)
    selectedId.value = data.card.plumCardId
    result.value = null
    cancelAdd()
  } catch {
    addError.value = t('stepKarta.otpError')
  } finally {
    addLoading.value = false
  }
}

// ── Scoring ──────────────────────────────────────────────────────────────────

const scoring = ref(false)
const progress = ref(0)
const result = ref<CardScoreResult | null>(null)
const scoreError = ref<string | null>(null)

let progressTimer: ReturnType<typeof setInterval> | null = null

function clearTimer() {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null }
}

async function verifyCard() {
  if (!selectedCard.value) return

  scoring.value = true
  progress.value = 0
  result.value = null
  scoreError.value = null

  // Animate progress bar — stays below 85 % until real result arrives
  progressTimer = setInterval(() => {
    if (progress.value < 85) progress.value += 6 + Math.random() * 6
  }, 250)

  try {
    const data = await apiFetch<{ score: number; limit: number; decision: string }>(
      '/merchant/cards/score',
      {
        method: 'POST',
        body: JSON.stringify({
          plumCardId: selectedCard.value.plumCardId,
          pcType: selectedCard.value.pcType,
        }),
      },
    )
    clearTimer()
    progress.value = 100
    result.value = {
      score: data.score,
      decision: data.decision as ScoreDecision,
      limit: data.limit,
    }
  } catch {
    clearTimer()
    progress.value = 0
    scoreError.value = t('stepKarta.scoreError')
  } finally {
    scoring.value = false
  }
}

function resetSelection() {
  selectedId.value = null
  result.value = null
  scoreError.value = null
}

// ── Decision display ─────────────────────────────────────────────────────────

const decisionMeta = computed(() => {
  if (!result.value) return null
  const d = result.value.decision
  if (d === 'approved')
    return { label: t('stepKarta.approved'), color: 'var(--success)', bg: 'var(--success-bg)' }
  if (d === 'manual_review')
    return { label: t('stepKarta.manualReview'), color: 'var(--warning)', bg: 'var(--warning-bg)' }
  return { label: t('stepKarta.declined'), color: 'var(--danger)', bg: 'var(--danger-bg)' }
})

// ── Continue ─────────────────────────────────────────────────────────────────

function next() {
  if (!selectedCard.value || !result.value) return

  deal.setCard(selectedCard.value)
  clientScoring.setCompleted({
    scoringId: `plum-${selectedCard.value.plumCardId}-${Date.now()}`,
    scoreSum: result.value.score,
    coefficient: result.value.score >= 700 ? 1.0 : result.value.score >= 600 ? 0.8 : 0,
    decision: result.value.decision,
    platformCreditLimit: result.value.limit,
    criteriaScores: {},
  })
  deal.complete('karta')
}
</script>

<template>
  <div class="step-card surface-card">
    <header class="sc-head">
      <div>
        <h2>{{ $t('stepKarta.title') }}</h2>
        <p>{{ $t('stepKarta.subtitle') }}</p>
      </div>
    </header>

    <!-- Loading cards -->
    <div v-if="loadingCards" class="state-row">
      <i class="pi pi-spin pi-spinner" />
      <span>{{ $t('stepKarta.loadingCards') }}</span>
    </div>

    <!-- Load error -->
    <div v-else-if="loadCardsError" class="state-row state-error">
      <i class="pi pi-exclamation-circle" />
      <span>{{ loadCardsError }}</span>
      <button class="btn-ghost" @click="fetchCards">{{ $t('common.retry') }}</button>
      <button class="btn-ghost" style="margin-left: auto" @click="openAddForm">
        <i class="pi pi-plus" /> {{ $t('stepKarta.addCard') }}
      </button>
    </div>

    <!-- Card grid -->
    <div v-else class="cards-grid">
      <button
        v-for="card in cards"
        :key="card.plumCardId"
        class="bank-card"
        :class="{ selected: selectedId === card.plumCardId }"
        @click="selectCard(card.plumCardId)"
      >
        <div class="bc-top">
          <span class="bc-bank">{{ card.bank }}</span>
          <i
            class="pi"
            :class="selectedId === card.plumCardId ? 'pi-check-circle' : 'pi-circle'"
          />
        </div>
        <div class="bc-pan font-mono">{{ card.maskedPan }}</div>
        <div class="bc-foot">
          <span>{{ card.holderName }}</span>
          <span class="font-mono">{{ card.expiry }}</span>
        </div>
      </button>

      <button v-if="!adding" class="add-card" @click="openAddForm">
        <i class="pi pi-plus" />
        <span>{{ $t('stepKarta.addCard') }}</span>
      </button>
    </div>

    <!-- Add card form -->
    <div v-if="adding" class="add-form">
      <!-- Phase 1: card details -->
      <template v-if="!addSessionId">
        <div class="field">
          <label class="field-label">{{ $t('stepKarta.cardNumber') }}</label>
          <InputText
            v-model="newPan"
            placeholder="8600 1234 5678 9012"
            class="font-mono"
            maxlength="19"
          />
        </div>
        <div class="field" style="max-width: 140px">
          <label class="field-label">{{ $t('stepKarta.expiry') }}</label>
          <InputText v-model="newExpiry" placeholder="08/27" class="font-mono" maxlength="5" />
        </div>
        <div class="add-actions">
          <button class="btn-ghost" :disabled="addLoading" @click="cancelAdd">
            {{ $t('stepKarta.cancel') }}
          </button>
          <button class="btn-gradient" :disabled="addLoading" @click="requestAddCard">
            <i v-if="addLoading" class="pi pi-spin pi-spinner" />
            {{ $t('stepKarta.sendOtp') }}
          </button>
        </div>
      </template>

      <!-- Phase 2: OTP entry -->
      <template v-else>
        <div class="otp-hint">
          <i class="pi pi-mobile" />
          {{ $t('stepKarta.otpSentTo', { phone: maskedPhone }) }}
        </div>
        <div class="field" style="max-width: 200px">
          <label class="field-label">{{ $t('stepKarta.otpCode') }}</label>
          <InputText
            v-model="otpCode"
            placeholder="• • • • • •"
            class="font-mono"
            maxlength="8"
          />
        </div>
        <div class="add-actions">
          <button class="btn-ghost" :disabled="addLoading" @click="cancelAdd">
            {{ $t('stepKarta.cancel') }}
          </button>
          <button class="btn-gradient" :disabled="addLoading || otpCode.length < 4" @click="confirmOtp">
            <i v-if="addLoading" class="pi pi-spin pi-spinner" />
            {{ $t('stepKarta.confirm') }}
          </button>
        </div>
      </template>

      <p v-if="addError" class="add-error">{{ addError }}</p>
    </div>

    <!-- Verify row -->
    <div class="verify-row">
      <button
        class="btn-ghost"
        :disabled="!selectedId || scoring"
        @click="verifyCard"
      >
        <i v-if="scoring" class="pi pi-spin pi-spinner" />
        <i v-else class="pi pi-shield" />
        {{ scoring ? $t('stepKarta.scoringCard') : $t('stepKarta.verifyCard') }}
      </button>

      <div v-if="scoring" class="progress-track">
        <div class="progress-bar" :style="{ width: progress + '%' }" />
        <span class="progress-label font-mono">{{ Math.round(progress) }}%</span>
      </div>
    </div>

    <!-- Score result -->
    <transition name="fade">
      <div v-if="result" class="score-result">
        <div class="sr-score">
          <span class="sr-label">{{ $t('stepKarta.cardScore') }}</span>
          <span class="sr-value font-mono text-gradient">{{ result.score }}</span>
        </div>
        <div
          class="sr-decision"
          :style="{ color: decisionMeta?.color, background: decisionMeta?.bg }"
        >
          {{ decisionMeta?.label }}
        </div>
      </div>
    </transition>

    <!-- Scoring error -->
    <transition name="fade">
      <div v-if="scoreError" class="score-error-block">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ scoreError }}</span>
        <div class="score-error-actions">
          <button class="btn-ghost" @click="verifyCard">
            <i class="pi pi-refresh" /> {{ $t('common.retry') }}
          </button>
          <button class="btn-ghost btn-muted" @click="resetSelection">
            {{ $t('stepKarta.useDifferentCard') }}
          </button>
        </div>
      </div>
    </transition>

    <footer class="sc-foot">
      <button class="btn-ghost" @click="deal.back()">
        <i class="pi pi-arrow-left" /> {{ $t('common.back') }}
      </button>
      <button class="btn-gradient" :disabled="!result" @click="next">
        {{ $t('common.continue') }} <i class="pi pi-arrow-right" />
      </button>
    </footer>
  </div>
</template>

<style scoped>
.step-card {
  padding: 2rem;
}
.sc-head h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
}
.sc-head p {
  margin: 0.3rem 0 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

/* ── State rows ──────────────────────────────────────────────────────────── */
.state-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
.state-error {
  color: var(--danger);
}

/* ── Cards grid ──────────────────────────────────────────────────────────── */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.1rem;
  margin: 1.8rem 0;
}
.bank-card {
  text-align: left;
  border: 2px solid var(--border-subtle);
  background: var(--bg-surface);
  border-radius: 16px;
  padding: 1.2rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  transition: all 0.15s ease;
}
.bank-card.selected {
  border-color: var(--accent-2);
  box-shadow: var(--accent-glow);
}
.bc-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.bc-bank {
  font-weight: 800;
  font-size: 0.9rem;
}
.bc-top i {
  color: var(--accent-2);
}
.bc-pan {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.bc-foot {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.add-card {
  border: 2px dashed var(--border-subtle);
  background: transparent;
  border-radius: 16px;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.15s ease;
  min-height: 130px;
}
.add-card:hover {
  border-color: var(--accent-2);
  color: var(--accent-2);
}

/* ── Add card form ───────────────────────────────────────────────────────── */
.add-form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
  background: var(--bg-surface);
  padding: 1.2rem;
  border-radius: 14px;
  margin-bottom: 1.4rem;
}
.add-form .field {
  flex: 1;
}
.add-actions {
  display: flex;
  gap: 0.6rem;
}
.otp-hint {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  color: var(--text-secondary);
}
.add-error {
  width: 100%;
  margin: 0;
  font-size: 0.82rem;
  color: var(--danger);
}

/* ── Verify row ──────────────────────────────────────────────────────────── */
.verify-row {
  display: flex;
  align-items: center;
  gap: 1.2rem;
}
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}
.progress-track {
  flex: 1;
  position: relative;
  height: 10px;
  background: var(--bg-surface);
  border-radius: 999px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: var(--gradient-hero);
  transition: width 0.2s ease;
}
.progress-label {
  position: absolute;
  right: 0;
  top: -22px;
  font-size: 0.74rem;
  color: var(--text-secondary);
  font-weight: 700;
}

/* ── Score result ────────────────────────────────────────────────────────── */
.score-result {
  margin-top: 1.4rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  background: var(--bg-surface);
  padding: 1.3rem 1.6rem;
  border-radius: 16px;
}
.sr-score {
  display: flex;
  flex-direction: column;
}
.sr-label {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
}
.sr-value {
  font-size: 2.2rem;
  font-weight: 800;
}
.sr-decision {
  padding: 0.4rem 1rem;
  border-radius: 999px;
  font-weight: 800;
  font-size: 0.85rem;
}

/* ── Score error block ───────────────────────────────────────────────────── */
.score-error-block {
  margin-top: 1.2rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  background: var(--danger-bg, #fff0f0);
  color: var(--danger);
  padding: 1rem 1.4rem;
  border-radius: 14px;
  font-size: 0.88rem;
  font-weight: 600;
}
.score-error-actions {
  display: flex;
  gap: 0.6rem;
  margin-left: auto;
}
.btn-muted {
  opacity: 0.7;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.sc-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2rem;
  padding-top: 1.4rem;
  border-top: 1px solid var(--border-subtle);
}
.btn-gradient {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.fade-enter-active {
  transition: opacity 0.35s ease;
}
.fade-enter-from {
  opacity: 0;
}
</style>
