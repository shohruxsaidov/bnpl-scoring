<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useDealStore } from '@/stores/deal'
import { useClientScoringStore } from '@/stores/client-scoring'
import { saveSessionStep } from '@/composables/use-deal-session-api'
import type { BailsmanRelation, ScoreDecision } from '@/types'

// Reuse path (reuse scoring) — the client already holds a valid cached limit, so
// scoring is skipped: this step only collects bailsmen. The server rehydrates the
// scoring stamp from the client's prior run when the step is saved.

const deal = useDealStore()
const clientScoring = useClientScoringStore()
const { t } = useI18n()

interface BailsmanLocal {
  relation: string
  phone: string
}

const localBailsmen = ref<BailsmanLocal[]>([])

const RELATION_OPTIONS = computed(() => [
  { label: t('stepCard.contacts.relations.father'), value: 'father' },
  { label: t('stepCard.contacts.relations.mother'), value: 'mother' },
  { label: t('stepCard.contacts.relations.brother'), value: 'brother' },
  { label: t('stepCard.contacts.relations.friend'), value: 'friend' },
  { label: t('stepCard.contacts.relations.other'), value: 'other' },
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
  if (localBailsmen.value.length < 5) localBailsmen.value.push({ relation: '', phone: '' })
}

function removeBailsman(idx: number) {
  if (localBailsmen.value.length > 1) localBailsmen.value.splice(idx, 1)
}

const bailsmenValid = computed(
  () =>
    localBailsmen.value.length >= 1 &&
    localBailsmen.value.every((b) => b.relation !== '' && rawDigits(b.phone).length === 9),
)

const limitText = computed(() =>
  clientScoring.platformCreditLimit != null
    ? new Intl.NumberFormat('ru-RU').format(clientScoring.platformCreditLimit)
    : '',
)

onMounted(() => {
  if (deal.sessionData.bailsmen.length > 0) {
    localBailsmen.value = deal.sessionData.bailsmen.map((b) => ({
      relation: b.relation,
      phone: b.phone.replace(/^\+998/, ''),
    }))
  } else {
    localBailsmen.value = [{ relation: '', phone: '' }]
  }
})

const saving = ref(false)
const saveError = ref('')

async function next() {
  if (!bailsmenValid.value || saving.value) return
  saving.value = true
  saveError.value = ''

  const bailsmen = localBailsmen.value.map((b) => ({
    relation: b.relation as BailsmanRelation,
    phone: '+998' + rawDigits(b.phone),
  }))

  try {
    // Server saves bailsmen AND rehydrates the reused scoring stamp (reuse scoring).
    const dto = await saveSessionStep(deal.dealSessionId!, 'contacts', { bailsmen })
    deal.setBailsmen(bailsmen)

    const s = dto.stepData.scoring
    if (s) {
      clientScoring.setCompleted({
        scoringId: s.scoringId ?? 'reuse',
        scoreSum: s.scoreSum,
        coefficient: s.coefficient,
        decision: s.decision as ScoreDecision,
        platformCreditLimit: s.platformCreditLimit,
        criteriaScores: s.criteriaScores,
      })
    }
    deal.complete('contacts')
  } catch {
    saveError.value = t('deal.stepSaveError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="step-card surface-card">
    <header class="sc-head">
      <div>
        <h2>{{ $t('stepContacts.title') }}</h2>
        <p>{{ $t('stepContacts.subtitle') }}</p>
      </div>
    </header>

    <!-- Reused limit banner -->
    <div v-if="limitText" class="reuse-banner">
      <i class="pi pi-check-circle" />
      <span>
        {{ $t('stepContacts.reusedLimit') }}
        <strong class="font-mono">
          {{ limitText }} {{ $t('stepClient.reuseLimitCurrency') }}
          {{ $t('stepClient.reuseLimitPerMonth') }}
        </strong>
      </span>
    </div>

    <!-- Bailsmen -->
    <div class="bailsmen-section">
      <div class="bailsmen-header">
        <span class="bailsmen-title">{{ $t('stepCard.contacts.title') }}</span>
      </div>

      <div v-for="(b, idx) in localBailsmen" :key="idx" class="bailsman-row">
        <div class="field bailsman-relation">
          <label class="field-label">{{ $t('stepCard.contacts.relation') }}</label>
          <Select v-model="b.relation" :options="RELATION_OPTIONS" optionLabel="label" optionValue="value"
            :placeholder="$t('stepCard.contacts.relationPlaceholder')" class="bailsman-select" />
        </div>
        <div class="field bailsman-phone">
          <label class="field-label">{{ $t('stepVerification.phone') }}</label>
          <div class="phone-input-wrap">
            <span class="phone-prefix">+998</span>
            <InputText :value="b.phone" placeholder="90 123 45 67" class="font-mono bailsman-phone-input"
              maxlength="12" inputmode="numeric" @input="handleBailsmanPhone(idx, $event)" />
          </div>
        </div>
        <button class="btn-remove-bailsman" :disabled="localBailsmen.length <= 1" @click="removeBailsman(idx)">
          <i class="pi pi-trash" />
        </button>
      </div>

      <button class="btn-ghost" :disabled="localBailsmen.length >= 5" @click="addBailsman">
        <i class="pi pi-plus" /> {{ $t('stepCard.contacts.add') }}
      </button>
    </div>

    <transition name="fade">
      <div v-if="saveError" class="save-error-block">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ saveError }}</span>
      </div>
    </transition>

    <footer class="sc-foot">
      <button class="btn-gradient" :disabled="!bailsmenValid || saving" @click="next">
        <i v-if="saving" class="pi pi-spin pi-spinner" />
        {{ $t('common.continue') }} <i v-if="!saving" class="pi pi-arrow-right" />
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

.reuse-banner {
  margin-top: 1.2rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--success);
  background: var(--success-bg);
  padding: 0.8rem 1.1rem;
  border-radius: 12px;
  font-size: 0.88rem;
}

.reuse-banner strong {
  color: var(--text-primary);
}

.bailsmen-section {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.bailsmen-header {
  display: flex;
  align-items: center;
}

.bailsmen-title {
  font-weight: 700;
  font-size: 0.95rem;
}

.bailsman-row {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
}

.bailsman-relation {
  flex: 1;
}

.bailsman-phone {
  flex: 1.3;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.bailsman-select {
  width: 100%;
}

.phone-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.phone-prefix {
  font-weight: 700;
  color: var(--text-secondary);
}

.bailsman-phone-input {
  flex: 1;
}

.btn-remove-bailsman {
  height: 42px;
  width: 42px;
  flex-shrink: 0;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--danger);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-remove-bailsman:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-ghost {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border-radius: 10px;
  border: 1px dashed var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
}

.btn-ghost:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.save-error-block {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--danger);
  background: var(--danger-bg, #fff0f0);
  padding: 0.8rem 1.1rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.86rem;
}

.sc-foot {
  margin-top: 1.8rem;
  display: flex;
  justify-content: flex-end;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
