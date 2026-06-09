<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { useScoringTestCasesStore, type ApprovalOutcome, type ScoringTestCase } from '@/stores/scoring-test-cases'

const store = useScoringTestCasesStore()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()

onMounted(async () => {
  try {
    await store.fetchAll()
  } catch {
    toast.add({ severity: 'error', summary: t('scoringTestCases.loadFailed'), life: 3000 })
  }
})

// ── Dialog state ─────────────────────────────────────────────────────────────
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const formTab = ref(0)

const form = reactive({
  name: '',
  description: '',
  expectedOutcome: 'approved' as ApprovalOutcome,
  // Personal
  age: null as number | null,
  gender: null as string | null,
  citizenship: null as string | null,
  passportRegion: '',
  // Income
  incomeSum: null as number | null,
  workExperienceMonths: null as number | null,
  monthlyPaymentRatio: null as number | null,
  // Credit
  creditHistoryContracts: null as number | null,
  contingentLiability: null as number | null,
  overdue30Count: null as number | null,
  overdue30to60Count: null as number | null,
  overdue60to90Count: null as number | null,
  overdue90Count: null as number | null,
  allDebts: null as number | null,
  // Obligations
  hasCoBorrower: false,
  coBorrowerMaxDays: null as number | null,
  hasGuarantor: false,
  guarantorMaxDays: null as number | null,
  hasPledger: false,
  pledgerMaxDays: null as number | null,
  hasMortgage: false,
  loanApplicationCount: null as number | null,
  // Legal
  hasJuridical: false,
  hasDecommission: false,
})

const FORM_TABS = ['scoringTestCases.personal', 'scoringTestCases.income', 'scoringTestCases.credit', 'scoringTestCases.obligations', 'scoringTestCases.legal']

const outcomeOptions = [
  { label: t('scoringTestCases.approved'), value: 'approved' },
  { label: t('scoringTestCases.partial'),  value: 'partial' },
  { label: t('scoringTestCases.denied'),   value: 'denied' },
  { label: t('scoringTestCases.rejected'), value: 'rejected' },
]

const genderOptions = [
  { label: t('scoringTry.male'),   value: 'Male' },
  { label: t('scoringTry.female'), value: 'Female' },
]

const citizenshipOptions = [
  { label: t('scoringTry.uzbekistan'),  value: 'Uzbekistan' },
  { label: t('scoringTry.nonResident'), value: 'NonResident' },
]

function resetForm() {
  form.name = ''
  form.description = ''
  form.expectedOutcome = 'approved'
  form.age = null; form.gender = null; form.citizenship = null; form.passportRegion = ''
  form.incomeSum = null; form.workExperienceMonths = null; form.monthlyPaymentRatio = null
  form.creditHistoryContracts = null; form.contingentLiability = null
  form.overdue30Count = null; form.overdue30to60Count = null
  form.overdue60to90Count = null; form.overdue90Count = null; form.allDebts = null
  form.hasCoBorrower = false; form.coBorrowerMaxDays = null
  form.hasGuarantor = false; form.guarantorMaxDays = null
  form.hasPledger = false; form.pledgerMaxDays = null
  form.hasMortgage = false; form.loanApplicationCount = null
  form.hasJuridical = false; form.hasDecommission = false
  formTab.value = 0
}

function fillForm(tc: ScoringTestCase) {
  const i = tc.inputs as Record<string, unknown>
  form.name = tc.name
  form.description = tc.description ?? ''
  form.expectedOutcome = tc.expectedOutcome
  form.age = (i.age as number) ?? null
  form.gender = (i.gender as string) ?? null
  form.citizenship = (i.citizenship as string) ?? null
  form.passportRegion = (i.passportRegion as string) ?? ''
  form.incomeSum = (i.incomeSum as number) ?? null
  form.workExperienceMonths = (i.workExperienceMonths as number) ?? null
  form.monthlyPaymentRatio = (i.monthlyPaymentRatio as number) ?? null
  form.creditHistoryContracts = (i.creditHistoryContracts as number) ?? null
  form.contingentLiability = (i.contingentLiability as number) ?? null
  form.overdue30Count = (i.overdue30Count as number) ?? null
  form.overdue30to60Count = (i.overdue30to60Count as number) ?? null
  form.overdue60to90Count = (i.overdue60to90Count as number) ?? null
  form.overdue90Count = (i.overdue90Count as number) ?? null
  form.allDebts = (i.allDebts as number) ?? null
  form.hasCoBorrower = i.coBorrowerMaxDays !== null && i.coBorrowerMaxDays !== undefined
  form.coBorrowerMaxDays = (i.coBorrowerMaxDays as number) ?? null
  form.hasGuarantor = i.guarantorMaxDays !== null && i.guarantorMaxDays !== undefined
  form.guarantorMaxDays = (i.guarantorMaxDays as number) ?? null
  form.hasPledger = i.pledgerMaxDays !== null && i.pledgerMaxDays !== undefined
  form.pledgerMaxDays = (i.pledgerMaxDays as number) ?? null
  form.hasMortgage = (i.hasMortgage as boolean) ?? false
  form.loanApplicationCount = (i.loanApplicationCount as number) ?? null
  form.hasJuridical = (i.hasJuridical as boolean) ?? false
  form.hasDecommission = (i.hasDecommission as boolean) ?? false
  formTab.value = 0
}

function buildInputs(): Record<string, unknown> {
  const inputs: Record<string, unknown> = {}
  if (form.age !== null)                    inputs.age = form.age
  if (form.gender)                          inputs.gender = form.gender
  if (form.citizenship)                     inputs.citizenship = form.citizenship
  if (form.passportRegion)                  inputs.passportRegion = form.passportRegion
  if (form.incomeSum !== null)              inputs.incomeSum = form.incomeSum
  if (form.workExperienceMonths !== null)   inputs.workExperienceMonths = form.workExperienceMonths
  if (form.monthlyPaymentRatio !== null)    inputs.monthlyPaymentRatio = form.monthlyPaymentRatio
  if (form.creditHistoryContracts !== null) inputs.creditHistoryContracts = form.creditHistoryContracts
  if (form.contingentLiability !== null)    inputs.contingentLiability = form.contingentLiability
  if (form.overdue30Count !== null)         inputs.overdue30Count = form.overdue30Count
  if (form.overdue30to60Count !== null)     inputs.overdue30to60Count = form.overdue30to60Count
  if (form.overdue60to90Count !== null)     inputs.overdue60to90Count = form.overdue60to90Count
  if (form.overdue90Count !== null)         inputs.overdue90Count = form.overdue90Count
  if (form.allDebts !== null)               inputs.allDebts = form.allDebts
  inputs.coBorrowerMaxDays = form.hasCoBorrower ? (form.coBorrowerMaxDays ?? 0) : null
  inputs.guarantorMaxDays  = form.hasGuarantor  ? (form.guarantorMaxDays ?? 0)  : null
  inputs.pledgerMaxDays    = form.hasPledger    ? (form.pledgerMaxDays ?? 0)    : null
  inputs.hasMortgage       = form.hasMortgage
  if (form.loanApplicationCount !== null)   inputs.loanApplicationCount = form.loanApplicationCount
  inputs.hasJuridical    = form.hasJuridical
  inputs.hasDecommission = form.hasDecommission
  return inputs
}

function openCreate() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(tc: ScoringTestCase) {
  editingId.value = tc.id
  fillForm(tc)
  dialogVisible.value = true
}

async function save() {
  if (!form.name.trim()) return
  saving.value = true
  try {
    const payload = { name: form.name.trim(), description: form.description || undefined, inputs: buildInputs(), expectedOutcome: form.expectedOutcome }
    if (editingId.value) {
      await store.update(editingId.value, payload)
    } else {
      await store.create(payload)
    }
    dialogVisible.value = false
  } catch {
    toast.add({ severity: 'error', summary: editingId.value ? t('scoringTestCases.updateFailed') : t('scoringTestCases.createFailed'), life: 3000 })
  } finally {
    saving.value = false
  }
}

function removeCase(tc: ScoringTestCase) {
  confirm.require({
    message: t('scoringTestCases.deleteConfirm', { name: tc.name }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    accept: async () => {
      try {
        await store.remove(tc.id)
      } catch {
        toast.add({ severity: 'error', summary: t('scoringTestCases.deleteFailed'), life: 3000 })
      }
    },
  })
}

function outcomeClass(o: string) {
  if (o === 'approved') return 'badge-approved'
  if (o === 'partial')  return 'badge-partial'
  if (o === 'denied')   return 'badge-denied'
  return 'badge-rejected'
}

function outcomeLabel(o: string) {
  return t(`scoringTestCases.${o}`)
}
</script>

<template>
  <div class="list-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('scoringTestCases.title') }}</h1>
        <p class="page-subtitle">{{ t('scoringTestCases.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" @click="router.push('/scoring-test-cases/run')">
          {{ t('scoringTestCases.runSuite') }}
        </button>
        <button class="btn-primary" @click="openCreate">
          <i class="pi pi-plus" /> {{ t('scoringTestCases.newTestCase') }}
        </button>
      </div>
    </div>

    <div class="surface-card table-card">
      <div v-if="store.loading" class="state-row">
        <i class="pi pi-spin pi-spinner" /> {{ t('common.loading') }}
      </div>

      <table v-else class="cases-table">
        <thead>
          <tr>
            <th class="col-name">{{ t('scoringTestCases.name') }}</th>
            <th class="col-outcome">{{ t('scoringTestCases.expectedOutcome') }}</th>
            <th class="col-date">{{ t('scoringModel.createdAt') }}</th>
            <th class="col-actions" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="tc in store.cases" :key="tc.id" class="case-row">
            <td class="col-name">
              <span class="case-name">{{ tc.name }}</span>
              <span v-if="tc.description" class="case-desc">{{ tc.description }}</span>
            </td>
            <td class="col-outcome">
              <span class="outcome-badge" :class="outcomeClass(tc.expectedOutcome)">
                {{ outcomeLabel(tc.expectedOutcome) }}
              </span>
            </td>
            <td class="col-date">{{ new Date(tc.createdAt).toLocaleDateString() }}</td>
            <td class="col-actions">
              <button class="icon-btn" :title="t('common.edit')" @click.stop="openEdit(tc)">
                <i class="pi pi-pencil" />
              </button>
              <button class="icon-btn danger" :title="t('common.delete')" @click.stop="removeCase(tc)">
                <i class="pi pi-trash" />
              </button>
            </td>
          </tr>
          <tr v-if="!store.cases.length && !store.loading">
            <td colspan="4" class="state-row">{{ t('common.noData') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Create / edit dialog -->
  <Dialog
    v-model:visible="dialogVisible"
    :header="editingId ? t('scoringTestCases.editTitle') : t('scoringTestCases.createTitle')"
    modal
    :style="{ width: '680px' }"
    :draggable="false"
  >
    <div class="dialog-body">
      <!-- Name + outcome -->
      <div class="form-grid">
        <div class="field col-span-2">
          <label>{{ t('scoringTestCases.name') }}</label>
          <InputText v-model="form.name" class="w-full" />
        </div>
        <div class="field col-span-2">
          <label>{{ t('scoringTestCases.description') }}</label>
          <Textarea v-model="form.description" class="w-full" :rows="2" auto-resize />
        </div>
        <div class="field col-span-2">
          <label>{{ t('scoringTestCases.expectedOutcome') }}</label>
          <Select v-model="form.expectedOutcome" :options="outcomeOptions" option-label="label" option-value="value" class="w-full" />
        </div>
      </div>

      <!-- Input tabs -->
      <div class="input-section">
        <p class="section-header">{{ t('scoringTestCases.inputs') }}</p>
        <div class="tab-bar">
          <button
            v-for="(tabKey, i) in FORM_TABS"
            :key="i"
            class="tab-btn"
            :class="{ active: formTab === i }"
            @click="formTab = i"
          >
            {{ t(tabKey) }}
          </button>
        </div>

        <!-- Tab 0: Personal -->
        <div v-if="formTab === 0" class="form-grid">
          <div class="field">
            <label>{{ t('scoringTry.age') }}</label>
            <InputNumber v-model="form.age" :min="0" :max="120" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div class="field">
            <label>{{ t('scoringTry.gender') }}</label>
            <Select v-model="form.gender" :options="genderOptions" option-label="label" option-value="value" :placeholder="t('scoringTry.optional')" class="w-full" />
          </div>
          <div class="field">
            <label>{{ t('scoringTry.citizenship') }}</label>
            <Select v-model="form.citizenship" :options="citizenshipOptions" option-label="label" option-value="value" :placeholder="t('scoringTry.optional')" class="w-full" />
          </div>
          <div class="field">
            <label>{{ t('scoringTry.passportRegion') }}</label>
            <InputText v-model="form.passportRegion" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
        </div>

        <!-- Tab 1: Income -->
        <div v-else-if="formTab === 1" class="form-grid">
          <div class="field col-span-2">
            <label>{{ t('scoringTry.incomeSum') }}</label>
            <InputNumber v-model="form.incomeSum" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div class="field">
            <label>{{ t('scoringTry.workExperience') }}</label>
            <InputNumber v-model="form.workExperienceMonths" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div class="field">
            <label>{{ t('scoringTry.monthlyPaymentRatio') }}</label>
            <InputNumber v-model="form.monthlyPaymentRatio" :min="0" :max-fraction-digits="1" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
        </div>

        <!-- Tab 2: Credit -->
        <div v-else-if="formTab === 2" class="form-grid">
          <div class="field col-span-2">
            <label>{{ t('scoringTry.overduePrincipal') }}</label>
            <InputNumber v-model="form.creditHistoryContracts" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div class="field col-span-2">
            <label>{{ t('scoringTry.contingentLiability') }}</label>
            <InputNumber v-model="form.contingentLiability" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div class="field">
            <label>{{ t('scoringTry.overdue30') }}</label>
            <InputNumber v-model="form.overdue30Count" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div class="field">
            <label>{{ t('scoringTry.overdue30to60') }}</label>
            <InputNumber v-model="form.overdue30to60Count" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div class="field">
            <label>{{ t('scoringTry.overdue60to90') }}</label>
            <InputNumber v-model="form.overdue60to90Count" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div class="field">
            <label>{{ t('scoringTry.overdue90') }}</label>
            <InputNumber v-model="form.overdue90Count" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
          <div class="field col-span-2">
            <label>{{ t('scoringTry.allDebts') }}</label>
            <InputNumber v-model="form.allDebts" :min="0" :use-grouping="true" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
        </div>

        <!-- Tab 3: Obligations -->
        <div v-else-if="formTab === 3" class="form-grid">
          <div class="field col-span-2">
            <div class="toggle-row">
              <span>{{ t('scoringTry.hasCoBorrower') }}</span>
              <ToggleSwitch v-model="form.hasCoBorrower" />
            </div>
            <InputNumber v-if="form.hasCoBorrower" v-model="form.coBorrowerMaxDays" :min="0" :use-grouping="false" class="w-full toggle-extra" :placeholder="t('scoringTry.maxOverdueDays')" />
          </div>
          <div class="field col-span-2">
            <div class="toggle-row">
              <span>{{ t('scoringTry.hasGuarantor') }}</span>
              <ToggleSwitch v-model="form.hasGuarantor" />
            </div>
            <InputNumber v-if="form.hasGuarantor" v-model="form.guarantorMaxDays" :min="0" :use-grouping="false" class="w-full toggle-extra" :placeholder="t('scoringTry.maxOverdueDays')" />
          </div>
          <div class="field col-span-2">
            <div class="toggle-row">
              <span>{{ t('scoringTry.hasPledger') }}</span>
              <ToggleSwitch v-model="form.hasPledger" />
            </div>
            <InputNumber v-if="form.hasPledger" v-model="form.pledgerMaxDays" :min="0" :use-grouping="false" class="w-full toggle-extra" :placeholder="t('scoringTry.maxOverdueDays')" />
          </div>
          <div class="field col-span-2">
            <div class="toggle-row">
              <span>{{ t('scoringTry.hasMortgage') }}</span>
              <ToggleSwitch v-model="form.hasMortgage" />
            </div>
          </div>
          <div class="field col-span-2">
            <label>{{ t('scoringTry.loanApplications') }}</label>
            <InputNumber v-model="form.loanApplicationCount" :min="0" :use-grouping="false" class="w-full" :placeholder="t('scoringTry.optional')" />
          </div>
        </div>

        <!-- Tab 4: Legal -->
        <div v-else-if="formTab === 4" class="form-grid">
          <div class="field col-span-2">
            <div class="toggle-row">
              <span>{{ t('scoringTry.hasJuridical') }}</span>
              <ToggleSwitch v-model="form.hasJuridical" />
            </div>
          </div>
          <div class="field col-span-2">
            <div class="toggle-row">
              <span>{{ t('scoringTry.hasDecommission') }}</span>
              <ToggleSwitch v-model="form.hasDecommission" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="btn-secondary" @click="dialogVisible = false">{{ t('common.cancel') }}</button>
      <button class="btn-primary" :disabled="!form.name.trim() || saving" @click="save">
        <i v-if="saving" class="pi pi-spin pi-spinner" />
        {{ t('common.save') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.list-page {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.page-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.page-subtitle {
  font-size: 0.86rem;
  color: var(--text-secondary);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.table-card { overflow: hidden; }

.cases-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.cases-table thead tr {
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-base);
}

.cases-table th {
  padding: 0.65rem 1.25rem;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  white-space: nowrap;
}

.case-row {
  border-bottom: 1px solid var(--border-subtle);
}

.case-row:last-child { border-bottom: none; }

.cases-table td {
  padding: 0.85rem 1.25rem;
  vertical-align: middle;
}

.col-name { }
.col-outcome { width: 160px; }
.col-date { width: 140px; color: var(--text-secondary); font-size: 0.84rem; }
.col-actions { width: 80px; }

.case-name {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
}

.case-desc {
  display: block;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.15rem;
}

.outcome-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 5px;
}

.badge-approved { background: color-mix(in srgb, #22c55e 15%, transparent); color: #22c55e; }
.badge-partial  { background: color-mix(in srgb, #f59e0b 15%, transparent); color: #f59e0b; }
.badge-denied   { background: color-mix(in srgb, #ef4444 15%, transparent); color: #ef4444; }
.badge-rejected { background: color-mix(in srgb, #a855f7 15%, transparent); color: #a855f7; }

.icon-btn {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-subtle);
  border-radius: 7px;
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-grid;
  place-items: center;
  font-size: 0.8rem;
  transition: all 0.15s;
  margin-left: 4px;
}

.icon-btn:hover { border-color: var(--text-secondary); color: var(--text-primary); }
.icon-btn.danger:hover { border-color: var(--danger); color: var(--danger); }

.state-row {
  padding: 2.5rem 1.25rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

/* ── Dialog ─────────────────────────────────────────────────────────────────*/
.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-height: 68vh;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border-top: 1px solid var(--border-subtle);
  padding-top: 1rem;
}

.section-header {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  margin: 0;
}

.tab-bar {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 0.3rem 0.75rem;
  border-radius: 7px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.tab-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field.col-span-2 { grid-column: span 2; }

.field label, .field > span {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.w-full { width: 100%; }

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
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

.toggle-extra { margin-top: 0.25rem; }

/* ── Buttons ────────────────────────────────────────────────────────────────*/
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.4rem;
  border-radius: 9px;
  border: none;
  background: var(--gradient-hero);
  color: #fff;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  transition: opacity 0.15s;
  box-shadow: var(--accent-glow);
}

.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.2rem;
  border-radius: 9px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary:hover { border-color: var(--text-secondary); color: var(--text-primary); }
</style>
