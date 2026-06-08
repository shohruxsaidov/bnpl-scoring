<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { useScoringModelStore } from '@/stores/scoring-model'
import type { CriterionResult } from '@/stores/scoring-model'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const store = useScoringModelStore()

const modelId = Number(route.params.id)
const step = ref(0) // 0-4 = input steps, 5 = result
const loading = ref(false)
const result = ref<{ totalScore: number; coefficient: number; breakdown: CriterionResult[] } | null>(null)

const STEPS = computed(() => [
  t('scoringTry.stepPersonal'),
  t('scoringTry.stepIncome'),
  t('scoringTry.stepCredit'),
  t('scoringTry.stepObligations'),
  t('scoringTry.stepLegal'),
])

onMounted(async () => {
  try {
    await store.loadRevision(modelId)
  } catch {
    toast.add({ severity: 'error', summary: t('scoringModel.loadFailed'), life: 3000 })
  }
})

function isEnabled(criterionKey: string): boolean {
  const p = store.revision?.params as Record<string, { Enabled?: boolean }> | undefined
  return p?.[criterionKey]?.Enabled !== false
}

// ── Derived step visibility ────────────────────────────────────────────────
const stepHasFields = computed(() => [
  isEnabled('Age') || isEnabled('Gender') || isEnabled('Citizenship') || isEnabled('PassportData'),
  isEnabled('IncomeSum') || isEnabled('WorkExperience') || isEnabled('MonthlyAveragePayment'),
  isEnabled('OverduePrincipalDays') || isEnabled('ContingentLiability') || isEnabled('Overdue30Days') || isEnabled('Overdue30To60Days') || isEnabled('Overdue60To90Days') || isEnabled('Overdue90Days') || isEnabled('AllDebts'),
  isEnabled('CoBorrowerLiability') || isEnabled('GuarantorLiability') || isEnabled('PledgerLiability') || isEnabled('Mortgage') || isEnabled('LoanApplication'),
  isEnabled('Juridical') || isEnabled('DeCommissioned'),
])

// ── Input state ───────────────────────────────────────────────────────────

// Step 0: Personal
const age = ref<number | null>(null)
const gender = ref<string | null>(null)
const citizenship = ref<string | null>(null)
const passportRegion = ref<string>('')

// Step 1: Income
const incomeSum = ref<number | null>(null)
const workExperienceMonths = ref<number | null>(null)
const monthlyPaymentRatio = ref<number | null>(null)

// Step 2: Credit history
const overduePrincipalContracts = ref<number | null>(null)
const contingentLiability = ref<number | null>(null)
const overdue30Count = ref<number | null>(null)
const overdue30to60Count = ref<number | null>(null)
const overdue60to90Count = ref<number | null>(null)
const overdue90Count = ref<number | null>(null)
const allDebts = ref<number | null>(null)

// Step 3: Obligations
const hasCoBorrower = ref(false)
const coBorrowerMaxDays = ref<number | null>(null)
const hasGuarantor = ref(false)
const guarantorMaxDays = ref<number | null>(null)
const hasPledger = ref(false)
const pledgerMaxDays = ref<number | null>(null)
const hasMortgage = ref(false)
const loanApplicationCount = ref<number | null>(null)

// Step 4: Legal
const hasJuridical = ref(false)
const hasDecommission = ref(false)

// ── Options ───────────────────────────────────────────────────────────────
const genderOptions = [
  { label: t('scoringTry.male'), value: 'Male' },
  { label: t('scoringTry.female'), value: 'Female' },
]
const citizenshipOptions = [
  { label: t('scoringTry.uzbekistan'), value: 'Uzbekistan' },
  { label: t('scoringTry.nonResident'), value: 'NonResident' },
]

// ── Navigation ────────────────────────────────────────────────────────────
const isLast = computed(() => step.value === STEPS.value.length - 1)

function back() {
  if (step.value > 0) step.value--
  else router.push('/scoring-model')
}

async function next() {
  if (!isLast.value) { step.value++; return }
  await calculate()
}

async function calculate() {
  loading.value = true
  try {
    const inputs: Record<string, unknown> = {}

    if (age.value !== null)                       inputs.age = age.value
    if (gender.value)                             inputs.gender = gender.value
    if (citizenship.value)                        inputs.citizenship = citizenship.value
    if (passportRegion.value)                     inputs.passportRegion = passportRegion.value
    if (incomeSum.value !== null)                 inputs.incomeSum = incomeSum.value
    if (workExperienceMonths.value !== null)      inputs.workExperienceMonths = workExperienceMonths.value
    if (monthlyPaymentRatio.value !== null)       inputs.monthlyPaymentRatio = monthlyPaymentRatio.value
    if (overduePrincipalContracts.value !== null) inputs.overduePrincipalContracts = overduePrincipalContracts.value
    if (contingentLiability.value !== null)      inputs.contingentLiability = contingentLiability.value
    if (overdue30Count.value !== null)           inputs.overdue30Count = overdue30Count.value
    if (overdue30to60Count.value !== null)       inputs.overdue30to60Count = overdue30to60Count.value
    if (overdue60to90Count.value !== null)       inputs.overdue60to90Count = overdue60to90Count.value
    if (overdue90Count.value !== null)           inputs.overdue90Count = overdue90Count.value
    if (allDebts.value !== null)                 inputs.allDebts = allDebts.value

    inputs.coBorrowerMaxDays  = hasCoBorrower.value ? (coBorrowerMaxDays.value ?? 0) : null
    inputs.guarantorMaxDays   = hasGuarantor.value  ? (guarantorMaxDays.value ?? 0)  : null
    inputs.pledgerMaxDays     = hasPledger.value    ? (pledgerMaxDays.value ?? 0)    : null
    inputs.hasMortgage        = hasMortgage.value
    if (loanApplicationCount.value !== null)     inputs.loanApplicationCount = loanApplicationCount.value
    inputs.hasJuridical    = hasJuridical.value
    inputs.hasDecommission = hasDecommission.value

    result.value = await store.tryModel(modelId, inputs)
    step.value = 5
  } catch {
    toast.add({ severity: 'error', summary: t('scoringTry.calcFailed'), life: 3000 })
  } finally {
    loading.value = false
  }
}

// ── Result helpers ────────────────────────────────────────────────────────
function verdictClass(coeff: number) {
  if (coeff >= 1) return 'verdict-approved'
  if (coeff > 0)  return 'verdict-partial'
  return 'verdict-denied'
}

function verdictLabel(coeff: number) {
  if (coeff >= 1) return t('scoringTry.approved')
  if (coeff > 0)  return t('scoringTry.partial')
  return t('scoringTry.denied')
}
</script>

<template>
  <div class="wizard-page">
    <!-- Page header -->
    <div class="wizard-header">
      <div>
        <h1 class="wizard-title">{{ t('scoringTry.title') }}</h1>
        <p class="wizard-subtitle">{{ t('scoringTry.subtitle') }}</p>
      </div>
      <button class="finish-early-btn" @click="router.push('/scoring-model')">
        {{ t('scoringTry.backToModel') }} →
      </button>
    </div>

    <!-- Step indicator -->
    <div v-if="step < 5" class="stepper surface-card">
      <div
        v-for="(label, i) in STEPS"
        :key="i"
        class="step"
        :class="{ current: step === i, done: step > i }"
      >
        <div class="step-icon">
          <i v-if="step > i" class="pi pi-check" />
          <span v-else>{{ i + 1 }}</span>
        </div>
        <span class="step-label">{{ label }}</span>
        <div v-if="i < STEPS.length - 1" class="connector" />
      </div>
    </div>

    <!-- Step body -->
    <div class="step-body surface-card">

      <!-- Step 0: Personal -->
      <template v-if="step === 0">
        <h2 class="section-title">{{ t('scoringTry.stepPersonal') }}</h2>
        <p v-if="!stepHasFields[0]" class="step-empty">{{ t('scoringTry.allDisabled') }}</p>
        <div v-else class="form-grid">
          <div v-if="isEnabled('Age')" class="field">
            <label>{{ t('scoringTry.age') }}</label>
            <InputNumber v-model="age" :min="0" :max="120" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div v-if="isEnabled('Gender')" class="field">
            <label>{{ t('scoringTry.gender') }}</label>
            <Select v-model="gender" :options="genderOptions" option-label="label" option-value="value" :placeholder="t('scoringTry.optional')" class="w-full" />
          </div>
          <div v-if="isEnabled('Citizenship')" class="field">
            <label>{{ t('scoringTry.citizenship') }}</label>
            <Select v-model="citizenship" :options="citizenshipOptions" option-label="label" option-value="value" :placeholder="t('scoringTry.optional')" class="w-full" />
          </div>
          <div v-if="isEnabled('PassportData')" class="field">
            <label>{{ t('scoringTry.passportRegion') }}</label>
            <InputText v-model="passportRegion" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
        </div>
        <div class="actions">
          <button class="btn-secondary" @click="back">
            <i class="pi pi-arrow-left" /> {{ t('common.cancel') }}
          </button>
          <button class="btn-primary" @click="next">
            {{ t('common.next') }} <i class="pi pi-arrow-right" />
          </button>
        </div>
      </template>

      <!-- Step 1: Income -->
      <template v-if="step === 1">
        <h2 class="section-title">{{ t('scoringTry.stepIncome') }}</h2>
        <p v-if="!stepHasFields[1]" class="step-empty">{{ t('scoringTry.allDisabled') }}</p>
        <div v-else class="form-grid">
          <div v-if="isEnabled('IncomeSum')" class="field col-span-2">
            <label>{{ t('scoringTry.incomeSum') }}</label>
            <small class="field-hint">{{ t('scoringTry.incomeSumHint') }}</small>
            <InputNumber v-model="incomeSum" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div v-if="isEnabled('WorkExperience')" class="field">
            <label>{{ t('scoringTry.workExperience') }}</label>
            <small class="field-hint">{{ t('scoringTry.workExperienceHint') }}</small>
            <InputNumber v-model="workExperienceMonths" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div v-if="isEnabled('MonthlyAveragePayment')" class="field">
            <label>{{ t('scoringTry.monthlyPaymentRatio') }}</label>
            <small class="field-hint">{{ t('scoringTry.monthlyPaymentHint') }}</small>
            <InputNumber v-model="monthlyPaymentRatio" :min="0" :max="200" :max-fraction-digits="1" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
        </div>
        <div class="actions">
          <button class="btn-secondary" @click="back">
            <i class="pi pi-arrow-left" /> {{ t('common.back') }}
          </button>
          <button class="btn-primary" @click="next">
            {{ t('common.next') }} <i class="pi pi-arrow-right" />
          </button>
        </div>
      </template>

      <!-- Step 2: Credit history -->
      <template v-if="step === 2">
        <h2 class="section-title">{{ t('scoringTry.stepCredit') }}</h2>
        <p v-if="!stepHasFields[2]" class="step-empty">{{ t('scoringTry.allDisabled') }}</p>
        <div v-else class="form-grid">
          <div v-if="isEnabled('OverduePrincipalDays')" class="field col-span-2">
            <label>{{ t('scoringTry.overduePrincipal') }}</label>
            <small class="field-hint">{{ t('scoringTry.overduePrincipalHint') }}</small>
            <InputNumber v-model="overduePrincipalContracts" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div v-if="isEnabled('ContingentLiability')" class="field col-span-2">
            <label>{{ t('scoringTry.contingentLiability') }}</label>
            <InputNumber v-model="contingentLiability" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div v-if="isEnabled('Overdue30Days')" class="field">
            <label>{{ t('scoringTry.overdue30') }}</label>
            <InputNumber v-model="overdue30Count" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div v-if="isEnabled('Overdue30To60Days')" class="field">
            <label>{{ t('scoringTry.overdue30to60') }}</label>
            <InputNumber v-model="overdue30to60Count" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div v-if="isEnabled('Overdue60To90Days')" class="field">
            <label>{{ t('scoringTry.overdue60to90') }}</label>
            <InputNumber v-model="overdue60to90Count" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div v-if="isEnabled('Overdue90Days')" class="field">
            <label>{{ t('scoringTry.overdue90') }}</label>
            <InputNumber v-model="overdue90Count" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div v-if="isEnabled('AllDebts')" class="field col-span-2">
            <label>{{ t('scoringTry.allDebts') }}</label>
            <small class="field-hint">{{ t('scoringTry.allDebtsHint') }}</small>
            <InputNumber v-model="allDebts" :min="0" :use-grouping="true" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
        </div>
        <div class="actions">
          <button class="btn-secondary" @click="back">
            <i class="pi pi-arrow-left" /> {{ t('common.back') }}
          </button>
          <button class="btn-primary" @click="next">
            {{ t('common.next') }} <i class="pi pi-arrow-right" />
          </button>
        </div>
      </template>

      <!-- Step 3: Obligations -->
      <template v-if="step === 3">
        <h2 class="section-title">{{ t('scoringTry.stepObligations') }}</h2>
        <p v-if="!stepHasFields[3]" class="step-empty">{{ t('scoringTry.allDisabled') }}</p>
        <div v-else class="form-grid">
          <div v-if="isEnabled('CoBorrowerLiability')" class="field col-span-2">
            <div class="toggle-row">
              <span>{{ t('scoringTry.hasCoBorrower') }}</span>
              <ToggleSwitch v-model="hasCoBorrower" />
            </div>
            <InputNumber v-if="hasCoBorrower" v-model="coBorrowerMaxDays" :min="0" :use-grouping="false" class="w-full toggle-extra" :placeholder="t('scoringTry.maxOverdueDays')" />
          </div>
          <div v-if="isEnabled('GuarantorLiability')" class="field col-span-2">
            <div class="toggle-row">
              <span>{{ t('scoringTry.hasGuarantor') }}</span>
              <ToggleSwitch v-model="hasGuarantor" />
            </div>
            <InputNumber v-if="hasGuarantor" v-model="guarantorMaxDays" :min="0" :use-grouping="false" class="w-full toggle-extra" :placeholder="t('scoringTry.maxOverdueDays')" />
          </div>
          <div v-if="isEnabled('PledgerLiability')" class="field col-span-2">
            <div class="toggle-row">
              <span>{{ t('scoringTry.hasPledger') }}</span>
              <ToggleSwitch v-model="hasPledger" />
            </div>
            <InputNumber v-if="hasPledger" v-model="pledgerMaxDays" :min="0" :use-grouping="false" class="w-full toggle-extra" :placeholder="t('scoringTry.maxOverdueDays')" />
          </div>
          <div v-if="isEnabled('Mortgage')" class="field col-span-2">
            <div class="toggle-row">
              <span>{{ t('scoringTry.hasMortgage') }}</span>
              <ToggleSwitch v-model="hasMortgage" />
            </div>
          </div>
          <div v-if="isEnabled('LoanApplication')" class="field col-span-2">
            <label>{{ t('scoringTry.loanApplications') }}</label>
            <InputNumber v-model="loanApplicationCount" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
        </div>
        <div class="actions">
          <button class="btn-secondary" @click="back">
            <i class="pi pi-arrow-left" /> {{ t('common.back') }}
          </button>
          <button class="btn-primary" @click="next">
            {{ t('common.next') }} <i class="pi pi-arrow-right" />
          </button>
        </div>
      </template>

      <!-- Step 4: Legal -->
      <template v-if="step === 4">
        <h2 class="section-title">{{ t('scoringTry.stepLegal') }}</h2>
        <p v-if="!stepHasFields[4]" class="step-empty">{{ t('scoringTry.allDisabled') }}</p>
        <div v-else class="form-grid">
          <div v-if="isEnabled('Juridical')" class="field col-span-2">
            <div class="toggle-row">
              <span>{{ t('scoringTry.hasJuridical') }}</span>
              <ToggleSwitch v-model="hasJuridical" />
            </div>
          </div>
          <div v-if="isEnabled('DeCommissioned')" class="field col-span-2">
            <div class="toggle-row">
              <span>{{ t('scoringTry.hasDecommission') }}</span>
              <ToggleSwitch v-model="hasDecommission" />
            </div>
          </div>
        </div>
        <div class="actions">
          <button class="btn-secondary" @click="back">
            <i class="pi pi-arrow-left" /> {{ t('common.back') }}
          </button>
          <button class="btn-primary" :disabled="loading" @click="next">
            <i v-if="loading" class="pi pi-spin pi-spinner" />
            {{ loading ? t('scoringTry.calculating') : t('scoringTry.calculate') }}
            <i v-if="!loading" class="pi pi-calculator" />
          </button>
        </div>
      </template>

      <!-- Step 5: Result -->
      <template v-if="step === 5 && result">
        <h2 class="section-title">{{ t('scoringTry.result') }}</h2>

        <div class="result-summary">
          <div class="summary-card">
            <span class="summary-label">{{ t('scoringTry.totalScore') }}</span>
            <span class="summary-value">{{ result.totalScore.toFixed(1) }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">{{ t('scoringTry.coefficient') }}</span>
            <span class="summary-value">{{ result.coefficient }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">{{ t('scoringTry.verdict') }}</span>
            <span class="verdict-badge" :class="verdictClass(result.coefficient)">
              {{ verdictLabel(result.coefficient) }}
            </span>
          </div>
        </div>

        <table class="breakdown-table">
          <thead>
            <tr>
              <th class="bc-name">{{ t('scoringTry.criterion') }}</th>
              <th class="bc-num">{{ t('scoringTry.rawScore') }}</th>
              <th class="bc-num">× {{ t('scoringModel.importantLevel') }}</th>
              <th class="bc-num">= {{ t('scoringTry.weighted') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in result.breakdown" :key="row.key" :class="{ skipped: row.skipped }">
              <td class="bc-name">
                {{ row.name }}
                <span v-if="row.skipped" class="skip-badge">{{ t('scoringTry.skipped') }}</span>
              </td>
              <td class="bc-num">{{ row.skipped ? '—' : row.rawScore }}</td>
              <td class="bc-num">{{ row.importantLevel }}</td>
              <td class="bc-num" :class="{ positive: row.weightedScore > 0, negative: row.weightedScore < 0 }">
                {{ row.skipped ? '—' : row.weightedScore.toFixed(1) }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td class="bc-name">{{ t('scoringTry.total') }}</td>
              <td class="bc-num" />
              <td class="bc-num" />
              <td class="bc-num total-score">{{ result.totalScore.toFixed(1) }}</td>
            </tr>
          </tfoot>
        </table>

        <div class="actions">
          <button class="btn-secondary" @click="step = 0; result = null">
            {{ t('scoringTry.tryAgain') }}
          </button>
          <button class="btn-primary" @click="router.push('/scoring-model')">
            {{ t('scoringTry.backToModel') }} <i class="pi pi-arrow-right" />
          </button>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
.wizard-page {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
}

/* ── Page header ─────────────────────────────────────────────────────────────*/
.wizard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.wizard-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.wizard-subtitle {
  font-size: 0.86rem;
  color: var(--text-secondary);
  margin: 0;
}

.finish-early-btn {
  padding: 0.45rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.finish-early-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── Stepper ─────────────────────────────────────────────────────────────────*/
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
  font-size: 1rem;
  font-weight: 700;
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
  text-align: center;
}

.step.current .step-label {
  color: var(--accent-2);
}

.step.done .step-label {
  color: var(--success);
}

.connector {
  position: absolute;
  top: 21px;
  left: calc(50% + 28px);
  right: calc(-50% + 28px);
  height: 2px;
  background: var(--border-subtle);
  z-index: 1;
}

.step.done .connector {
  background: var(--success);
}

/* ── Step body ───────────────────────────────────────────────────────────────*/
.step-body {
  padding: 2rem 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 320px;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

/* ── Form ────────────────────────────────────────────────────────────────────*/
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field.col-span-2 {
  grid-column: span 2;
}

.field label, .field > span {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.7;
  margin-top: -0.15rem;
}

.step-empty {
  font-size: 0.84rem;
  color: var(--text-secondary);
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  margin: 0;
}

.w-full {
  width: 100%;
}

/* ── Toggle rows ─────────────────────────────────────────────────────────────*/
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
}

.toggle-row span {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: none;
  letter-spacing: 0;
}

.toggle-extra {
  margin-top: 0.25rem;
}

/* ── Actions ─────────────────────────────────────────────────────────────────*/
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
  margin-top: auto;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.6rem;
  border-radius: 10px;
  border: none;
  background: var(--gradient-hero);
  color: #fff;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  transition: opacity 0.15s, box-shadow 0.15s;
  box-shadow: var(--accent-glow);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.4rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary:hover {
  border-color: var(--text-secondary);
  color: var(--text-primary);
}

/* ── Result ──────────────────────────────────────────────────────────────────*/
.result-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.summary-card {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.summary-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

.summary-value {
  font-size: 1.6rem;
  font-weight: 800;
  font-family: monospace;
}

.verdict-badge {
  display: inline-block;
  font-size: 0.9rem;
  font-weight: 800;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  margin-top: 0.2rem;
}

.verdict-approved { background: color-mix(in srgb, #22c55e 15%, transparent); color: #22c55e; }
.verdict-partial   { background: color-mix(in srgb, #f59e0b 15%, transparent); color: #f59e0b; }
.verdict-denied    { background: color-mix(in srgb, #ef4444 15%, transparent); color: #ef4444; }

.breakdown-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.breakdown-table thead tr {
  border-bottom: 2px solid var(--border-subtle);
}

.breakdown-table th {
  padding: 0.45rem 0.75rem;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.breakdown-table td {
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.breakdown-table tr:last-child td { border-bottom: none; }
.bc-name { text-align: left; }
.bc-num  { text-align: right; font-family: monospace; }

.skipped td { opacity: 0.45; }

.skip-badge {
  margin-left: 0.4rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 0.06rem 0.3rem;
}

.positive { color: #22c55e; font-weight: 700; }
.negative { color: #ef4444; font-weight: 700; }

.total-row td {
  border-top: 2px solid var(--border-subtle);
  font-weight: 800;
  padding-top: 0.5rem;
}

.total-score {
  font-size: 1rem;
  color: var(--accent-2);
}

/* ── Responsive ──────────────────────────────────────────────────────────────*/
@media (max-width: 700px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field.col-span-2 {
    grid-column: span 1;
  }

  .stepper {
    padding: 1rem;
  }

  .step-label {
    display: none;
  }

  .step-body {
    padding: 1.25rem;
  }

  .result-summary {
    grid-template-columns: 1fr;
  }
}
</style>
