<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import InputMask from 'primevue/inputmask'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { useMerchantsStore } from '@/stores/merchants'
import { useRegions } from '@/composables/use-regions'
import type { Category } from '@/types'

const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const store = useMerchantsStore()

const TOTAL_STEPS = 6
const step = ref(1)
const saving = ref(false)

const merchantId = ref<string | null>(null)
const branchId = ref<string | null>(null)
const createdCategories = ref<Category[]>([])

const STEPS = computed(() => [
  t('onboarding.stepMerchant'),
  t('onboarding.stepBankAccount'),
  t('onboarding.stepBranch'),
  t('onboarding.stepEmployees'),
  t('onboarding.stepCategories'),
  t('onboarding.stepProducts'),
])

onMounted(() => { store.fetchBankList() })

const { regionOptions, districtOptions, onRegionChange } = useRegions()

const ROLE_OPTIONS = [
  { label: 'Agent', value: 'agent' },
  { label: 'Merchant Admin', value: 'merchant_admin' },
]

// Step 1 – Merchant
const m = ref({ name: '', legalName: '', inn: '', phone: '', address: '', regionId: null as number | null })
const mRegion = ref<number | null>(null)
const mErrors = ref({ name: false, legalName: false, inn: false, phone: false, address: false })

function validateMerchant(): boolean {
  mErrors.value.name = !m.value.name.trim()
  mErrors.value.legalName = !m.value.legalName.trim()
  mErrors.value.inn = !m.value.inn || m.value.inn.includes('_') || m.value.inn.replace(/\D/g, '').length !== 9
  mErrors.value.phone = !m.value.phone || m.value.phone.includes('_')
  mErrors.value.address = !m.value.address.trim()
  return !Object.values(mErrors.value).some(Boolean)
}

async function submitStep1() {
  if (!validateMerchant()) return
  saving.value = true
  try {
    const formData = {
      ...m.value,
      regionId: m.value.regionId ?? undefined,
    }
    formData.phone = '998' + formData.phone.replace(/\D/g, '')
    const merchant = await store.create(formData)
    merchantId.value = merchant.id
    step.value = 2
  } catch {
    toast.add({ severity: 'error', summary: t('onboarding.errorMerchant'), life: 3000 })
  } finally {
    saving.value = false
  }
}

// Step 2 – Bank Account
const ba = ref({ mfo: '', accountNumber: '' })
const baErrors = ref({ mfo: false, accountNumber: false })

const bankOptions = computed(() =>
  store.bankList.map((b) => ({ label: `${b.mfo} — ${b.bankName}`, value: b.mfo }))
)

function validateBankAccount(): boolean {
  baErrors.value.mfo = !ba.value.mfo
  baErrors.value.accountNumber = !ba.value.accountNumber || ba.value.accountNumber.replace(/\D/g, '').length !== 20
  return !Object.values(baErrors.value).some(Boolean)
}

async function submitStep2() {
  if (!validateBankAccount()) return
  saving.value = true
  try {
    const selectedBank = store.bankList.find((b) => b.mfo === ba.value.mfo)
    await store.update(merchantId.value!, {
      mfo: ba.value.mfo,
      accountNumber: ba.value.accountNumber.replace(/\D/g, ''),
      bankName: selectedBank?.bankName ?? '',
    })
    step.value = 3
  } catch {
    toast.add({ severity: 'error', summary: t('onboarding.errorBankAccount'), life: 3000 })
  } finally {
    saving.value = false
  }
}

// Step 3 – Branch
const b = ref({ name: '', address: '', phone: '', regionId: null as number | null })
const bRegion = ref<number | null>(null)
const bErrors = ref({ name: false, address: false, phone: false })

function validateBranch(): boolean {
  bErrors.value.name = !b.value.name.trim()
  bErrors.value.address = !b.value.address.trim()
  bErrors.value.phone = !b.value.phone || b.value.phone.includes('_')
  return !Object.values(bErrors.value).some(Boolean)
}

async function submitStep3() {
  if (!validateBranch()) return
  saving.value = true
  try {
    const formData = {
      ...b.value,
      regionId: b.value.regionId ?? undefined,
    }
    formData.phone = '998' + formData.phone.replace(/\D/g, '')
    const branch = await store.createBranch(merchantId.value!, formData)
    branchId.value = branch.id
    step.value = 4
  } catch {
    toast.add({ severity: 'error', summary: t('onboarding.errorBranch'), life: 3000 })
  } finally {
    saving.value = false
  }
}

// Step 4 – Employees
function emptyEmp() { return { fullName: '', phone: '', password: '', roles: ['agent'] as string[] } }
const emps = ref([emptyEmp()])

async function submitStep4() {
  const valid = emps.value.filter(e => e.fullName.trim() && e.phone.trim() && e.password.length >= 8)
  if (!valid.length) { step.value = 5; return }
  saving.value = true
  try {
    for (const emp of valid) {
      await store.createEmployee(branchId.value!, emp)
    }
    step.value = 5
  } catch {
    toast.add({ severity: 'error', summary: t('onboarding.errorEmployee'), life: 3000 })
  } finally {
    saving.value = false
  }
}

// Step 5 – Categories
const cats = ref([{ name: '' }])

async function submitStep5() {
  const valid = cats.value.filter(c => c.name.trim())
  if (!valid.length) { step.value = 6; return }
  saving.value = true
  try {
    for (const cat of valid) {
      const created = await store.createCategory(merchantId.value!, { name: cat.name.trim() })
      createdCategories.value.push(created)
    }
    step.value = 6
  } catch {
    toast.add({ severity: 'error', summary: t('onboarding.errorCategory'), life: 3000 })
  } finally {
    saving.value = false
  }
}

// Step 6 – Products
function emptyProd() { return { name: '', categoryId: '', price: '' } }
const prods = ref([emptyProd()])

const categoryOptions = computed(() =>
  createdCategories.value.map(c => ({ label: c.name, value: c.id }))
)

async function submitStep6() {
  const valid = prods.value.filter(p => p.name.trim() && p.categoryId && p.price.trim())
  if (!valid.length) { finish(); return }
  saving.value = true
  try {
    for (const p of valid) {
      await store.createProduct(merchantId.value!, {
        categoryId: p.categoryId,
        name: p.name.trim(),
        price: p.price.trim(),
      })
    }
    finish()
  } catch {
    toast.add({ severity: 'error', summary: t('onboarding.errorProduct'), life: 3000 })
  } finally {
    saving.value = false
  }
}

function skip() {
  if (step.value < TOTAL_STEPS) step.value++
  else finish()
}

function finish() {
  router.push(merchantId.value ? `/merchants/${merchantId.value}` : '/merchants')
}
</script>

<template>
  <div class="wizard-page">
    <!-- Page header -->
    <div class="wizard-header">
      <div>
        <h1 class="wizard-title">{{ t('onboarding.title') }}</h1>
        <p class="wizard-subtitle">{{ t('onboarding.subtitle') }}</p>
      </div>
      <button v-if="merchantId" class="finish-early-btn" @click="finish">
        {{ t('onboarding.finish') }} →
      </button>
    </div>

    <!-- Step indicator -->
    <div class="stepper surface-card">
      <div v-for="(label, i) in STEPS" :key="i" class="step" :class="{ current: step === i + 1, done: step > i + 1 }">
        <div class="step-icon">
          <i v-if="step > i + 1" class="pi pi-check" />
          <span v-else>{{ i + 1 }}</span>
        </div>
        <span class="step-label">{{ label }}</span>
        <div v-if="i < TOTAL_STEPS - 1" class="connector" />
      </div>
    </div>

    <!-- Step body -->
    <div class="step-body surface-card">
      <!-- Step 1: Merchant -->
      <template v-if="step === 1">
        <h2 class="section-title">{{ t('onboarding.merchantSection') }}</h2>
        <div class="form-grid">
          <div class="field">
            <label>{{ t('onboarding.name') }}</label>
            <InputText v-model="m.name" :class="{ 'p-invalid': mErrors.name }" class="w-full" />
            <small v-if="mErrors.name" class="error-msg">{{ t('onboarding.nameRequired') }}</small>
          </div>
          <div class="field">
            <label>{{ t('onboarding.legalName') }}</label>
            <InputText v-model="m.legalName" :class="{ 'p-invalid': mErrors.legalName }" class="w-full" />
            <small v-if="mErrors.legalName" class="error-msg">{{ t('onboarding.legalNameRequired') }}</small>
          </div>
          <div class="field">
            <label>{{ t('onboarding.inn') }}</label>
            <InputMask v-model="m.inn" mask="999999999" :class="{ 'p-invalid': mErrors.inn }" class="w-full"
              placeholder="000000000" />
            <small v-if="mErrors.inn" class="error-msg">{{ t('onboarding.innRequired') }}</small>
          </div>
          <div class="field">
            <label>{{ t('onboarding.phone') }}</label>
            <span class="p-inputgroup-addon">+998</span>
            <InputMask v-model="m.phone" mask="999999999" :class="{ 'p-invalid': mErrors.phone }" class="w-full"
              placeholder="" />
            <small v-if="mErrors.phone" class="error-msg">{{ t('onboarding.phoneRequired') }}</small>
          </div>
          <div class="field col-span-2">
            <label>{{ t('onboarding.address') }}</label>
            <InputText v-model="m.address" :class="{ 'p-invalid': mErrors.address }" class="w-full" />
            <small v-if="mErrors.address" class="error-msg">{{ t('onboarding.addressRequired') }}</small>
          </div>
          <div class="field">
            <label>{{ t('onboarding.region') }} <span class="optional-hint">({{ t('onboarding.skip') }})</span></label>
            <Select v-model="mRegion" :options="regionOptions" option-label="label" option-value="value"
              :placeholder="t('onboarding.selectRegion')" filter show-clear class="w-full"
              @change="onRegionChange(mRegion, (v) => { m.regionId = v })" />
          </div>
          <div class="field">
            <label>{{ t('onboarding.district') }} <span class="optional-hint">({{ t('onboarding.skip') }})</span></label>
            <Select v-model="m.regionId" :options="districtOptions" option-label="label" option-value="value"
              :placeholder="t('onboarding.selectDistrict')" filter show-clear class="w-full"
              :disabled="!mRegion" />
          </div>
        </div>
        <div class="actions">
          <button class="btn-primary" :disabled="saving" @click="submitStep1">
            <i v-if="saving" class="pi pi-spin pi-spinner" />
            {{ saving ? t('onboarding.saving') : t('onboarding.next') }}
            <i v-if="!saving" class="pi pi-arrow-right" />
          </button>
        </div>
      </template>

      <!-- Step 2: Bank Account -->
      <template v-if="step === 2">
        <h2 class="section-title">{{ t('onboarding.bankAccountSection') }}</h2>
        <div class="form-grid">
          <div class="field col-span-2">
            <label>{{ t('onboarding.bank') }}</label>
            <Select v-model="ba.mfo" :options="bankOptions" option-label="label" option-value="value"
              :placeholder="t('onboarding.selectBank')" filter class="w-full"
              :class="{ 'p-invalid': baErrors.mfo }" />
            <small v-if="baErrors.mfo" class="error-msg">{{ t('onboarding.bankRequired') }}</small>
          </div>
          <div class="field col-span-2">
            <label>{{ t('onboarding.accountNumber') }}</label>
            <InputMask v-model="ba.accountNumber" mask="99999999999999999999"
              :class="{ 'p-invalid': baErrors.accountNumber }" class="w-full" placeholder="00000000000000000000" />
            <small v-if="baErrors.accountNumber" class="error-msg">{{ t('onboarding.accountNumberRequired') }}</small>
          </div>
        </div>
        <div class="actions">
          <button class="btn-secondary" @click="skip">{{ t('onboarding.skip') }}</button>
          <button class="btn-primary" :disabled="saving" @click="submitStep2">
            <i v-if="saving" class="pi pi-spin pi-spinner" />
            {{ saving ? t('onboarding.saving') : t('onboarding.next') }}
            <i v-if="!saving" class="pi pi-arrow-right" />
          </button>
        </div>
      </template>

      <!-- Step 3: Branch -->
      <template v-if="step === 3">
        <h2 class="section-title">{{ t('onboarding.branchSection') }}</h2>
        <div class="form-grid">
          <div class="field">
            <label>{{ t('onboarding.name') }}</label>
            <InputText v-model="b.name" :class="{ 'p-invalid': bErrors.name }" class="w-full" />
            <small v-if="bErrors.name" class="error-msg">{{ t('onboarding.nameRequired') }}</small>
          </div>
          <div class="field">
            <label>{{ t('onboarding.phone') }}</label>
            <span class="p-inputgroup-addon">+998</span>
            <InputMask v-model="b.phone" mask="999999999" :class="{ 'p-invalid': bErrors.phone }" class="w-full" />
            <small v-if="bErrors.phone" class="error-msg">{{ t('onboarding.phoneRequired') }}</small>
          </div>
          <div class="field col-span-2">
            <label>{{ t('onboarding.address') }}</label>
            <InputText v-model="b.address" :class="{ 'p-invalid': bErrors.address }" class="w-full" />
            <small v-if="bErrors.address" class="error-msg">{{ t('onboarding.addressRequired') }}</small>
          </div>
          <div class="field">
            <label>{{ t('onboarding.region') }} <span class="optional-hint">({{ t('onboarding.skip') }})</span></label>
            <Select v-model="bRegion" :options="regionOptions" option-label="label" option-value="value"
              :placeholder="t('onboarding.selectRegion')" filter show-clear class="w-full"
              @change="onRegionChange(bRegion, (v) => { b.regionId = v })" />
          </div>
          <div class="field">
            <label>{{ t('onboarding.district') }} <span class="optional-hint">({{ t('onboarding.skip') }})</span></label>
            <Select v-model="b.regionId" :options="districtOptions" option-label="label" option-value="value"
              :placeholder="t('onboarding.selectDistrict')" filter show-clear class="w-full"
              :disabled="!bRegion" />
          </div>
        </div>
        <div class="actions">
          <button class="btn-primary" :disabled="saving" @click="submitStep3">
            <i v-if="saving" class="pi pi-spin pi-spinner" />
            {{ saving ? t('onboarding.saving') : t('onboarding.next') }}
            <i v-if="!saving" class="pi pi-arrow-right" />
          </button>
        </div>
      </template>

      <!-- Step 4: Employees -->
      <template v-if="step === 4">
        <h2 class="section-title">{{ t('onboarding.employeesSection') }}</h2>
        <div v-for="(emp, i) in emps" :key="i" class="repeatable-row">
          <div class="form-grid">
            <div class="field">
              <label>{{ t('onboarding.fullName') }}</label>
              <InputText v-model="emp.fullName" class="w-full" />
            </div>
            <div class="field">
              <label>{{ t('onboarding.phone') }}</label>
              <InputText v-model="emp.phone" type="tel" class="w-full" />
            </div>
            <div class="field">
              <label>{{ t('onboarding.password') }}</label>
              <InputText v-model="emp.password" type="password" class="w-full"
                :placeholder="t('onboarding.passwordHint')" />
            </div>
            <div class="field">
              <label>{{ t('onboarding.roles') }}</label>
              <MultiSelect v-model="emp.roles" :options="ROLE_OPTIONS" option-label="label" option-value="value"
                :placeholder="t('onboarding.selectRoles')" class="w-full" />
            </div>
          </div>
          <button v-if="emps.length > 1" class="remove-btn" @click="emps.splice(i, 1)">
            <i class="pi pi-times" />
          </button>
        </div>
        <button class="add-another-btn" @click="emps.push(emptyEmp())">
          <i class="pi pi-plus" /> {{ t('onboarding.addAnother') }}
        </button>
        <div class="actions">
          <button class="btn-secondary" @click="skip">{{ t('onboarding.skip') }}</button>
          <button class="btn-primary" :disabled="saving" @click="submitStep4">
            <i v-if="saving" class="pi pi-spin pi-spinner" />
            {{ saving ? t('onboarding.saving') : t('onboarding.next') }}
            <i v-if="!saving" class="pi pi-arrow-right" />
          </button>
        </div>
      </template>

      <!-- Step 5: Categories -->
      <template v-if="step === 5">
        <h2 class="section-title">{{ t('onboarding.categoriesSection') }}</h2>
        <div v-for="(cat, i) in cats" :key="i" class="repeatable-row">
          <div class="field flex-1">
            <label>{{ t('onboarding.categoryName') }}</label>
            <InputText v-model="cat.name" class="w-full" />
          </div>
          <button v-if="cats.length > 1" class="remove-btn" @click="cats.splice(i, 1)">
            <i class="pi pi-times" />
          </button>
        </div>
        <button class="add-another-btn" @click="cats.push({ name: '' })">
          <i class="pi pi-plus" /> {{ t('onboarding.addAnother') }}
        </button>
        <div class="actions">
          <button class="btn-secondary" @click="skip">{{ t('onboarding.skip') }}</button>
          <button class="btn-primary" :disabled="saving" @click="submitStep5">
            <i v-if="saving" class="pi pi-spin pi-spinner" />
            {{ saving ? t('onboarding.saving') : t('onboarding.next') }}
            <i v-if="!saving" class="pi pi-arrow-right" />
          </button>
        </div>
      </template>

      <!-- Step 6: Products -->
      <template v-if="step === 6">
        <h2 class="section-title">{{ t('onboarding.productsSection') }}</h2>
        <p v-if="!categoryOptions.length" class="info-msg">{{ t('onboarding.noCategories') }}</p>
        <template v-else>
          <div v-for="(prod, i) in prods" :key="i" class="repeatable-row">
            <div class="form-grid">
              <div class="field">
                <label>{{ t('onboarding.productName') }}</label>
                <InputText v-model="prod.name" class="w-full" />
              </div>
              <div class="field">
                <label>{{ t('onboarding.category') }}</label>
                <Select v-model="prod.categoryId" :options="categoryOptions" option-label="label" option-value="value"
                  :placeholder="t('onboarding.selectCategory')" class="w-full" />
              </div>
              <div class="field">
                <label>{{ t('onboarding.price') }}</label>
                <InputText v-model="prod.price" class="w-full" />
              </div>
            </div>
            <button v-if="prods.length > 1" class="remove-btn" @click="prods.splice(i, 1)">
              <i class="pi pi-times" />
            </button>
          </div>
          <button class="add-another-btn" @click="prods.push(emptyProd())">
            <i class="pi pi-plus" /> {{ t('onboarding.addAnother') }}
          </button>
        </template>
        <div class="actions">
          <button class="btn-secondary" @click="finish">{{ t('onboarding.skip') }}</button>
          <button class="btn-primary" :disabled="saving || !categoryOptions.length" @click="submitStep6">
            <i v-if="saving" class="pi pi-spin pi-spinner" />
            {{ saving ? t('onboarding.saving') : t('onboarding.finish') }}
            <i v-if="!saving" class="pi pi-check" />
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
  position: relative;
}

.p-inputgroup-addon {
  color: var(--text-secondary);
  position: absolute;
  left: 0;
  top: 0;
  height: 40px;
  pointer-events: none;
  display: flex;
  align-items: center;
  top: 26px;
  left: 10px
}

.p-inputgroup-addon+.p-inputtext {
  padding-left: 3.25rem;
}

.field.col-span-2 {
  grid-column: span 2;
}

.field label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.w-full {
  width: 100%;
}

.error-msg {
  font-size: 0.75rem;
  color: var(--danger);
}

.optional-hint {
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--text-secondary);
  text-transform: none;
}

/* ── Repeatable rows ─────────────────────────────────────────────────────────*/
.repeatable-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--border-subtle);
}

.repeatable-row:last-of-type {
  border-bottom: none;
  padding-bottom: 0;
}

.repeatable-row .form-grid {
  flex: 1;
}

.repeatable-row .field {
  flex: 1;
}

.remove-btn {
  margin-top: 1.8rem;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: all 0.15s;
}

.remove-btn:hover {
  border-color: var(--danger);
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}

.add-another-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px dashed var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  width: fit-content;
}

.add-another-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.info-msg {
  font-size: 0.84rem;
  color: var(--text-secondary);
  padding: 1.25rem 1.5rem;
  background: var(--bg-base);
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
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
}
</style>
