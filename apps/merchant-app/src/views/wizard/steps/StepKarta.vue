<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import { useWizardStore } from '@/stores/wizard'
import type { Card, CardScoreResult, ScoreDecision } from '@/types'

const wizard = useWizardStore()
const { t } = useI18n()

const cards = ref<Card[]>([
  {
    id: 'card_1',
    maskedPan: '8600 •••• •••• 4417',
    holderName: 'AKMAL TURSUNOV',
    expiry: '08/27',
    bank: 'Uzcard',
  },
  {
    id: 'card_2',
    maskedPan: '9860 •••• •••• 1290',
    holderName: 'AKMAL TURSUNOV',
    expiry: '11/26',
    bank: 'Humo',
  },
])

const selectedId = ref<string | null>(wizard.sessionData.selectedCard?.id ?? null)
const adding = ref(false)
const newPan = ref('')
const newExpiry = ref('')

const scoring = ref(false)
const progress = ref(0)
const result = ref<CardScoreResult | null>(wizard.sessionData.cardScore)

let timer: ReturnType<typeof setInterval> | null = null

function selectCard(id: string) {
  selectedId.value = id
  result.value = null
}

function addCard() {
  if (!/^\d{4} \d{4} \d{4} \d{4}$/.test(newPan.value)) return
  const masked =
    newPan.value.slice(0, 4) + ' •••• •••• ' + newPan.value.slice(-4)
  const card: Card = {
    id: `card_${cards.value.length + 1}`,
    maskedPan: masked,
    holderName: (`${wizard.sessionData.client?.firstName ?? ''} ${wizard.sessionData.client?.lastName ?? ''}`.trim() || 'CLIENT').toUpperCase(),
    expiry: newExpiry.value || '01/28',
    bank: 'Uzcard',
  }
  cards.value.push(card)
  selectedId.value = card.id
  adding.value = false
  newPan.value = ''
  newExpiry.value = ''
}

function verifyCard() {
  if (!selectedId.value) return
  scoring.value = true
  progress.value = 0
  result.value = null
  timer = setInterval(() => {
    progress.value += 12 + Math.random() * 10
    if (progress.value >= 100) {
      progress.value = 100
      if (timer) clearInterval(timer)
      const score = 620 + Math.floor(Math.random() * 220)
      const decision: ScoreDecision =
        score >= 700 ? 'approved' : score >= 600 ? 'manual_review' : 'declined'
      result.value = {
        score,
        decision,
        limit: 3000000000,
      }
      scoring.value = false
    }
  }, 220)
}

const selectedCard = computed(() =>
  cards.value.find((c) => c.id === selectedId.value),
)

const decisionMeta = computed(() => {
  if (!result.value) return null
  const d = result.value.decision
  if (d === 'approved')
    return { label: t('stepKarta.approved'), color: 'var(--success)', bg: 'var(--success-bg)' }
  if (d === 'manual_review')
    return { label: t('stepKarta.manualReview'), color: 'var(--warning)', bg: 'var(--warning-bg)' }
  return { label: t('stepKarta.declined'), color: 'var(--danger)', bg: 'var(--danger-bg)' }
})

function next() {
  if (selectedCard.value && result.value) {
    wizard.setCard(selectedCard.value)
    wizard.setCardScore(result.value)
    wizard.complete('karta')
  }
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

    <div class="cards-grid">
      <button
        v-for="card in cards"
        :key="card.id"
        class="bank-card"
        :class="{ selected: selectedId === card.id }"
        @click="selectCard(card.id)"
      >
        <div class="bc-top">
          <span class="bc-bank">{{ card.bank }}</span>
          <i
            class="pi"
            :class="selectedId === card.id ? 'pi-check-circle' : 'pi-circle'"
          />
        </div>
        <div class="bc-pan font-mono">{{ card.maskedPan }}</div>
        <div class="bc-foot">
          <span>{{ card.holderName }}</span>
          <span class="font-mono">{{ card.expiry }}</span>
        </div>
      </button>

      <button v-if="!adding" class="add-card" @click="adding = true">
        <i class="pi pi-plus" />
        <span>{{ $t('stepKarta.addCard') }}</span>
      </button>
    </div>

    <div v-if="adding" class="add-form">
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
        <InputText v-model="newExpiry" placeholder="08/27" class="font-mono" />
      </div>
      <div class="add-actions">
        <button class="btn-ghost" @click="adding = false">{{ $t('stepKarta.cancel') }}</button>
        <button class="btn-gradient" @click="addCard">{{ $t('stepKarta.add') }}</button>
      </div>
    </div>

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

    <footer class="sc-foot">
      <button class="btn-ghost" @click="wizard.back()">
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
.add-form {
  display: flex;
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
