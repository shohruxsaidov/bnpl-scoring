<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useDealStore } from '@/stores/deal'
import { useClientScoringStore } from '@/stores/client-scoring'
import { apiFetch } from '@/utils/apiFetch'
import type { Bailsman, BailsmanRelation, Card, CardScoreResult, ScoreDecision } from '@/types'

const deal = useDealStore()
const clientScoring = useClientScoringStore()
const { t } = useI18n()

// ── Bailsmen ─────────────────────────────────────────────────────────────────

interface BailsmanLocal {
  relation: string
  phone: string
}

const localBailsmen = ref<BailsmanLocal[]>([])

const RELATION_OPTIONS = computed(() => [
  { label: t('stepCard.bailsmen.relations.father'), value: 'father' },
  { label: t('stepCard.bailsmen.relations.mother'), value: 'mother' },
  { label: t('stepCard.bailsmen.relations.brother'), value: 'brother' },
  { label: t('stepCard.bailsmen.relations.friend'), value: 'friend' },
  { label: t('stepCard.bailsmen.relations.other'), value: 'other' },
])

function rawDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

function handleBailsmanPhone(idx: number, e: Event) {
  const raw = rawDigits((e.target as HTMLInputElement).value).slice(0, 9)
  let fmt = raw
  if (raw.length > 2) fmt = raw.slice(0, 2) + ' ' + raw.slice(2)
  if (raw.length > 5) fmt = raw.slice(0, 2) + ' ' + raw.slice(2, 5) + ' ' + raw.slice(5)
  if (raw.length > 7) fmt = raw.slice(0, 2) + ' ' + raw.slice(2, 5) + ' ' + raw.slice(5, 7) + ' ' + raw.slice(7)
  localBailsmen.value[idx].phone = fmt
}

function addBailsman() {
  if (localBailsmen.value.length < 5) {
    localBailsmen.value.push({ relation: '', phone: '' })
  }
}

function removeBailsman(idx: number) {
  if (localBailsmen.value.length > 1) {
    localBailsmen.value.splice(idx, 1)
  }
}

const bailsmenValid = computed(() =>
  localBailsmen.value.length >= 1 &&
  localBailsmen.value.every(b => b.relation !== '' && rawDigits(b.phone).length === 9),
)

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
      `/merchant/deal-sessions/${deal.dealSessionId}/cards`,
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
    loadCardsError.value = t('stepCard.loadCardsError')
  } finally {
    loadingCards.value = false
  }
}

onMounted(() => {
  if (deal.sessionData.bailsmen.length > 0) {
    localBailsmen.value = deal.sessionData.bailsmen.map(b => ({
      relation: b.relation,
      phone: b.phone.replace(/^\+998/, ''),
    }))
  } else {
    localBailsmen.value = [{ relation: '', phone: '' }]
  }
  fetchCards()
})

// ── Card selection ───────────────────────────────────────────────────────────

const selectedId = ref<string | null>(
  deal.sessionData.selectedCard?.plumCardId ?? null,
)

function selectCard(plumCardId: string) {
  selectedId.value = plumCardId
  // Reset scoring result when switching cards
  result.value = null
  serverResult.value = null
  scoreError.value = null
}

const selectedCard = computed(() =>
  cards.value.find((c) => c.plumCardId === selectedId.value),
)

// ── Add card flow ────────────────────────────────────────────────────────────

const adding = ref(false)
const newPan = ref('')
const newExpiry = ref('')

function handlePanInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 16)
  newPan.value = raw.replace(/(.{4})/g, '$1 ').trimEnd()
}

function handleExpiryInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4)
  newExpiry.value = raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw
}

// OTP phase
const addSessionId = ref<string | null>(null)
const maskedPhone = ref<string | null>(null)
const otpCode = ref('')
const addLoading = ref(false)
const addError = ref<string | null>(null)

// Resend OTP cooldown
const RESEND_COOLDOWN_SECONDS = 60
const resendCooldown = ref(0)
let resendTimer: ReturnType<typeof setInterval> | null = null

function stopResendTimer() {
  if (resendTimer) {
    clearInterval(resendTimer)
    resendTimer = null
  }
}

function startResendCooldown() {
  stopResendTimer()
  resendCooldown.value = RESEND_COOLDOWN_SECONDS
  resendTimer = setInterval(() => {
    resendCooldown.value -= 1
    if (resendCooldown.value <= 0) stopResendTimer()
  }, 1000)
}

onUnmounted(stopResendTimer)

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
  stopResendTimer()
  resendCooldown.value = 0
}

async function requestAddCard() {
  const rawPan = newPan.value.replace(/\s/g, '')
  if (!/^\d{16}$/.test(rawPan)) return
  if (!newExpiry.value) return

  addLoading.value = true
  addError.value = null
  try {
    const data = await apiFetch<{ sessionId: string; maskedPhone: string }>(
      `/merchant/deal-sessions/${deal.dealSessionId}/cards/add`,
      {
        method: 'POST',
        body: JSON.stringify({
          cardNumber: rawPan,
          expiry: newExpiry.value,
        }),
      },
    )
    addSessionId.value = data.sessionId
    maskedPhone.value = data.maskedPhone
    startResendCooldown()
  } catch {
    addError.value = t('stepCard.addCardError')
  } finally {
    addLoading.value = false
  }
}

async function resendOtp() {
  if (resendCooldown.value > 0 || addLoading.value) return
  otpCode.value = ''
  await requestAddCard()
}

async function confirmOtp() {
  if (!addSessionId.value || otpCode.value.length < 4) return

  addLoading.value = true
  addError.value = null
  try {
    const data = await apiFetch<{ card: Card }>(
      `/merchant/deal-sessions/${deal.dealSessionId}/cards/confirm`,
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
    addError.value = t('stepCard.otpError')
  } finally {
    addLoading.value = false
  }
}

// ── Scoring ──────────────────────────────────────────────────────────────────
// The server runs the score AND stamps the full result onto the Deal Session
// (ADR-0024) — the response here is display-only.

type RejectionCode = 'credit_ban' | 'card_declined' | 'model_stop_factor'

interface ServerScoreResult {
  score: number
  limit: number
  decision: string
  scoringId: string | null
  coefficient: number
  criteriaScores: Record<string, unknown>
  sessionClosed?: boolean
  rejectionReason?: { code: RejectionCode; factorKey?: string } | null
}

const scoring = ref(false)
const progress = ref(0)
const result = ref<CardScoreResult | null>(null)
const serverResult = ref<ServerScoreResult | null>(null)
const scoreError = ref<string | null>(null)
const rejected = ref(false)

const rejectionDesc = computed(() => {
  const reason = serverResult.value?.rejectionReason
  if (!reason) return t('stepCard.rejectedDesc')
  if (reason.code === 'credit_ban') return t('stepCard.rejectedCreditBan')
  if (reason.code === 'card_declined') return t('stepCard.rejectedCardDeclined')
  if (reason.code === 'model_stop_factor') {
    const breakdown = (serverResult.value?.criteriaScores?.model as Record<string, unknown> | undefined)
      ?.breakdown as Array<{ key: string; name: string }> | undefined
    const factorName = breakdown?.find((b) => b.key === reason.factorKey)?.name ?? reason.factorKey
    return t('stepCard.rejectedStopFactor', { factor: factorName })
  }
  return t('stepCard.rejectedDesc')
})

let progressTimer: ReturnType<typeof setInterval> | null = null

function clearTimer() {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null }
}

async function runScoring(): Promise<CardScoreResult | null> {
  if (!selectedCard.value || !deal.dealSessionId || !deal.sessionData.client) return null

  scoring.value = true
  progress.value = 0
  result.value = null
  serverResult.value = null
  scoreError.value = null

  // Animate progress bar — stays below 85 % until real result arrives
  progressTimer = setInterval(() => {
    if (progress.value < 85) progress.value += 6 + Math.random() * 6
  }, 250)

  try {
    const data = await apiFetch<ServerScoreResult>(
      `/merchant/deal-sessions/${deal.dealSessionId}/cards/score`,
      {
        method: 'POST',
        body: JSON.stringify({
          plumCardId: selectedCard.value.plumCardId,
          pcType: selectedCard.value.pcType,
          maskedPan: selectedCard.value.maskedPan,
          bank: selectedCard.value.bank,
          holderName: selectedCard.value.holderName,
          expiry: selectedCard.value.expiry,
          bailsmen: localBailsmen.value.map(b => ({
            relation: b.relation as BailsmanRelation,
            phone: '+998' + rawDigits(b.phone),
          })),
        }),
      },
    )
    clearTimer()
    progress.value = 100
    serverResult.value = data
    result.value = {
      score: data.score,
      decision: data.decision as ScoreDecision,
      limit: data.limit,
    }
    return result.value
  } catch {
    clearTimer()
    progress.value = 0
    scoreError.value = t('stepCard.scoreError')
    return null
  } finally {
    scoring.value = false
  }
}

function resetSelection() {
  selectedId.value = null
  result.value = null
  serverResult.value = null
  scoreError.value = null
  rejected.value = false
}

// ── Continue ─────────────────────────────────────────────────────────────────

async function next() {
  if (!selectedCard.value || scoring.value) return
  if (!bailsmenValid.value) return

  // Scoring endpoint saves the card step + scoring stamp server-side (ADR-0024).
  // Reuse the result if this card was already scored on a prior pass.
  const score = result.value && serverResult.value ? result.value : await runScoring()
  const server = serverResult.value
  if (!score || !server || !selectedCard.value) return

  if (server.sessionClosed) {
    rejected.value = true
    return
  }

  deal.setCard(selectedCard.value)
  deal.setBailsmen(localBailsmen.value.map(b => ({
    relation: b.relation as BailsmanRelation,
    phone: '+998' + rawDigits(b.phone),
  })))

  clientScoring.setCompleted({
    scoringId: server.scoringId ?? `plum-${selectedCard.value.plumCardId}-${Date.now()}`,
    scoreSum: server.score,
    coefficient: server.coefficient,
    decision: server.decision as ScoreDecision,
    platformCreditLimit: server.limit,
    criteriaScores: server.criteriaScores,
  })
  deal.complete('card')
}
</script>

<template>
  <div class="step-card surface-card">
    <header class="sc-head">
      <div>
        <h2>{{ $t('stepCard.title') }}</h2>
        <p>{{ $t('stepCard.subtitle') }}</p>
      </div>
    </header>

    <!-- Loading cards -->
    <div v-if="loadingCards" class="state-row">
      <i class="pi pi-spin pi-spinner" />
      <span>{{ $t('stepCard.loadingCards') }}</span>
    </div>

    <!-- Load error -->
    <div v-else-if="loadCardsError" class="state-row state-error">
      <i class="pi pi-exclamation-circle" />
      <span>{{ loadCardsError }}</span>
      <button class="btn-ghost" @click="fetchCards">{{ $t('common.retry') }}</button>
      <button class="btn-ghost" style="margin-left: auto" @click="openAddForm">
        <i class="pi pi-plus" /> {{ $t('stepCard.addCard') }}
      </button>
    </div>

    <!-- Card grid -->
    <div v-else class="cards-grid">
      <button v-for="card in cards" :key="card.plumCardId" class="bank-card"
        :class="{ selected: selectedId === card.plumCardId }" @click="selectCard(card.plumCardId)">
        <div class="bc-top">
          <span class="bc-bank">{{ card.bank }}</span>
          <i class="pi" :class="selectedId === card.plumCardId ? 'pi-check-circle' : 'pi-circle'" />
        </div>
        <div class="bc-pan font-mono">{{ card.maskedPan }}</div>
        <div class="bc-foot">
          <span>{{ card.holderName }}</span>
          <span class="font-mono">{{ card.expiry }}</span>
        </div>
      </button>

      <button v-if="!adding" class="add-card" @click="openAddForm">
        <i class="pi pi-plus" />
        <span>{{ $t('stepCard.addCard') }}</span>
      </button>
    </div>

    <!-- Add card form -->
    <div v-if="adding" class="add-form">
      <!-- Phase 1: card details -->
      <template v-if="!addSessionId">
        <div class="field">
          <label class="field-label">{{ $t('stepCard.cardNumber') }}</label>
          <InputText :value="newPan" placeholder="8600 1234 5678 9012" class="font-mono" maxlength="19"
            inputmode="numeric" @input="handlePanInput" />
        </div>
        <div class="field" style="max-width: 140px">
          <label class="field-label">{{ $t('stepCard.expiry') }}</label>
          <InputText :value="newExpiry" placeholder="08/27" class="font-mono" maxlength="5" inputmode="numeric"
            @input="handleExpiryInput" />
        </div>
        <div class="add-actions">
          <button class="btn-ghost" :disabled="addLoading" @click="cancelAdd">
            {{ $t('stepCard.cancel') }}
          </button>
          <button class="btn-gradient" :disabled="addLoading" @click="requestAddCard">
            <i v-if="addLoading" class="pi pi-spin pi-spinner" />
            {{ $t('stepCard.sendOtp') }}
          </button>
        </div>
      </template>

      <!-- Phase 2: OTP entry -->
      <template v-else>
        <div class="otp-hint">
          <i class="pi pi-mobile" />
          {{ $t('stepCard.otpSentTo', { phone: maskedPhone }) }}
        </div>
        <div class="field" style="max-width: 200px">
          <label class="field-label">{{ $t('stepCard.otpCode') }}</label>
          <InputText v-model="otpCode" placeholder="• • • • • •" class="font-mono" maxlength="8" />
        </div>
        <div class="add-actions">
          <button class="btn-ghost" :disabled="addLoading" @click="cancelAdd">
            {{ $t('stepCard.cancel') }}
          </button>
          <button class="btn-gradient" :disabled="addLoading || otpCode.length < 4" @click="confirmOtp">
            <i v-if="addLoading" class="pi pi-spin pi-spinner" />
            {{ $t('stepCard.confirm') }}
          </button>
        </div>
        <button class="btn-link resend-btn" :disabled="resendCooldown > 0 || addLoading" @click="resendOtp">
          <i class="pi pi-refresh" />
          {{ resendCooldown > 0
            ? $t('stepCard.resendIn', { seconds: resendCooldown })
            : $t('stepCard.resendOtp') }}
        </button>
      </template>

      <p v-if="addError" class="add-error">{{ addError }}</p>
    </div>

    <!-- Bailsmen -->
    <div v-if="selectedId && !adding" class="bailsmen-section">
      <div class="bailsmen-header">
        <span class="bailsmen-title">{{ $t('stepCard.bailsmen.title') }}</span>
      </div>

      <div v-for="(b, idx) in localBailsmen" :key="idx" class="bailsman-row">
        <div class="field bailsman-relation">
          <label class="field-label">{{ $t('stepCard.bailsmen.relation') }}</label>
          <Select
            v-model="b.relation"
            :options="RELATION_OPTIONS"
            optionLabel="label"
            optionValue="value"
            :placeholder="$t('stepCard.bailsmen.relationPlaceholder')"
            class="bailsman-select"
          />
        </div>
        <div class="field bailsman-phone">
          <label class="field-label">{{ $t('stepCard.bailsmen.phone') }}</label>
          <div class="phone-input-wrap">
            <span class="phone-prefix">+998</span>
            <InputText
              :value="b.phone"
              placeholder="90 123 45 67"
              class="font-mono bailsman-phone-input"
              maxlength="12"
              inputmode="numeric"
              @input="handleBailsmanPhone(idx, $event)"
            />
          </div>
        </div>
        <button
          class="btn-remove-bailsman"
          :disabled="localBailsmen.length <= 1"
          @click="removeBailsman(idx)"
        >
          <i class="pi pi-trash" />
        </button>
      </div>

      <button class="btn-ghost" :disabled="localBailsmen.length >= 5" @click="addBailsman">
        <i class="pi pi-plus" /> {{ $t('stepCard.bailsmen.add') }}
      </button>
    </div>

    <!-- Scoring progress -->
    <div v-if="scoring" class="verify-row">
      <span class="scoring-label">
        <i class="pi pi-spin pi-spinner" /> {{ $t('stepCard.scoringCard') }}
      </span>
      <div class="progress-track">
        <div class="progress-bar" :style="{ width: progress + '%' }" />
        <span class="progress-label font-mono">{{ Math.round(progress) }}%</span>
      </div>
    </div>

    <!-- Scoring error -->
    <transition name="fade">
      <div v-if="scoreError" class="score-error-block">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ scoreError }}</span>
        <div class="score-error-actions">
          <button class="btn-ghost" @click="next">
            <i class="pi pi-refresh" /> {{ $t('common.retry') }}
          </button>
          <button class="btn-ghost btn-muted" @click="resetSelection">
            {{ $t('stepCard.useDifferentCard') }}
          </button>
        </div>
      </div>
    </transition>

    <!-- Scoring rejected -->
    <transition name="fade">
      <div v-if="rejected" class="rejected-block">
        <i class="pi pi-times-circle rejected-icon" />
        <div class="rejected-body">
          <p class="rejected-title">{{ $t('stepCard.rejectedTitle') }}</p>
          <p class="rejected-desc">{{ rejectionDesc }}</p>
        </div>
        <button class="btn-ghost" style="margin-left: auto" @click="deal.reset()">
          {{ $t('stepCard.newSession') }}
        </button>
      </div>
    </transition>

    <footer v-if="!rejected" class="sc-foot">
      <button class="btn-ghost" @click="deal.back()">
        <i class="pi pi-arrow-left" /> {{ $t('common.back') }}
      </button>
      <button class="btn-gradient" :disabled="!selectedId || scoring || !bailsmenValid" @click="next">
        <i v-if="scoring" class="pi pi-spin pi-spinner" />
        {{ $t('common.continue') }} <i v-if="!scoring" class="pi pi-arrow-right" />
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

.btn-link {
  background: none;
  border: none;
  color: var(--accent-1);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
  padding: 0;
}

.btn-link:hover {
  text-decoration: underline;
}

.resend-btn {
  align-self: flex-end;
  padding-bottom: 0.7rem;
}

.resend-btn:disabled {
  color: var(--text-secondary);
  cursor: not-allowed;
  text-decoration: none;
}

/* ── Bailsmen ────────────────────────────────────────────────────────────── */
.bailsmen-section {
  border-top: 1px solid var(--border-subtle);
  padding-top: 1.4rem;
  margin-top: 0.4rem;
}

.bailsmen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.bailsmen-title {
  font-size: 0.95rem;
  font-weight: 800;
}

.bailsman-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
  margin-bottom: 0.75rem;
}

.bailsman-relation {
  flex: 1.2;
  min-width: 0;
}

.bailsman-phone {
  flex: 1;
  min-width: 0;
}

.bailsman-select {
  width: 100%;
}

.phone-input-wrap {
  display: flex;
  align-items: stretch;
}

.phone-prefix {
  display: flex;
  align-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-right: none;
  border-radius: 8px 0 0 8px;
  padding: 0 0.65rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.bailsman-phone-input {
  border-radius: 0 8px 8px 0 !important;
  flex: 1;
  min-width: 0;
}

.btn-remove-bailsman {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0.4rem;
  color: var(--danger, #e53e3e);
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  border-radius: 6px;
  transition: opacity 0.15s ease;
  margin-bottom: 0.15rem;
}

.btn-remove-bailsman:hover:not(:disabled) {
  opacity: 0.7;
}

.btn-remove-bailsman:disabled {
  opacity: 0.25;
  cursor: not-allowed;
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

.scoring-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-secondary);
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

/* ── Rejected block ──────────────────────────────────────────────────────── */
.rejected-block {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--danger-bg, #fff0f0);
  border: 1px solid var(--danger);
  border-radius: 14px;
  padding: 1.2rem 1.4rem;
  margin-top: 1.4rem;
}

.rejected-icon {
  font-size: 2rem;
  color: var(--danger);
  flex-shrink: 0;
}

.rejected-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.rejected-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--danger);
}

.rejected-desc {
  margin: 0;
  font-size: 0.84rem;
  color: var(--text-secondary);
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

@media (max-width: 700px) {
  .step-card {
    padding: 1.2rem;
  }

  .cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .add-form {
    flex-direction: column;
    align-items: stretch;

    .field {
      max-width: none !important;
    }
  }

  .add-actions {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
