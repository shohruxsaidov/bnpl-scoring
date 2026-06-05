<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import { usePaymentsStore, type Payment } from '@/stores/payments'
import { useManualPaymentsStore, type DealSearchResult } from '@/stores/manualPayments'
import { useMerchantsStore } from '@/stores/merchants'
import MonoAmount from '@/components/MonoAmount.vue'
import { formatDate } from '@/utils/money'

const store = usePaymentsStore()
const manualStore = useManualPaymentsStore()
const merchantsStore = useMerchantsStore()
const { t } = useI18n()

// ── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'schedule' | 'manual' | 'plan'
const activeTab = ref<Tab>('schedule')

function switchTab(tab: Tab) {
  activeTab.value = tab
  if (tab === 'manual' && manualStore.payments.length === 0 && !manualStore.loading) {
    manualStore.fetch()
  }
}

// ── Schedule tab ─────────────────────────────────────────────────────────────
const merchantFilter = ref<string | null>(null)
const statusFilter = ref<Payment['status'] | null>(null)
const search = ref('')

onMounted(() => {
  store.fetchPayments()
  if (merchantsStore.merchants.length === 0) merchantsStore.fetchAll().catch(() => {})
})

watch(merchantFilter, (id) => store.fetchPayments(id ?? undefined))

const merchantOptions = computed(() => [
  { label: t('payments.allMerchants'), value: null },
  ...merchantsStore.merchants.map((m) => ({ label: m.name, value: m.id })),
])

const statusOptions = computed(() => [
  { label: t('payments.allStatuses'), value: null },
  { label: t('payments.statusConfirmed'), value: 'confirmed' },
  { label: t('payments.statusPending'), value: 'pending' },
  { label: t('payments.statusPartial'), value: 'partial' },
])

const filtered = computed<Payment[]>(() => {
  let list = store.payments
  if (statusFilter.value) list = list.filter((p) => p.status === statusFilter.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (p) =>
        p.clientName.toLowerCase().includes(q) ||
        p.clientPhone.includes(q) ||
        p.dealNumber.toLowerCase().includes(q),
    )
  }
  return list
})

const stats = computed(() => {
  const confirmed = store.payments.filter((p) => p.status === 'confirmed')
  return {
    total: store.payments.length,
    confirmed: confirmed.length,
    pending: store.payments.filter((p) => p.status === 'pending').length,
    partial: store.payments.filter((p) => p.status === 'partial').length,
    volume: confirmed.reduce((s, p) => s + p.amount, 0),
  }
})

const STATUS_COLORS: Record<Payment['status'], { fg: string; bg: string }> = {
  confirmed: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  pending: { fg: 'var(--warning)', bg: 'var(--warning-bg)' },
  partial: { fg: 'var(--accent-2)', bg: 'color-mix(in srgb, var(--accent-2) 12%, transparent)' },
  cancelled: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
}

function formatSomM(tiyin: number): string {
  const som = tiyin / 100
  if (som >= 1_000_000_000) return `${(som / 1_000_000_000).toFixed(1)}B`
  if (som >= 1_000_000) return `${(som / 1_000_000).toFixed(1)}M`
  if (som >= 1_000) return `${(som / 1_000).toFixed(0)}K`
  return som.toFixed(0)
}

// ── Manual payment dialog ─────────────────────────────────────────────────────
const dialogOpen = ref(false)
const saving = ref(false)
const saveError = ref('')

const dealQuery = ref('')
const dealSearching = ref(false)
const dealResults = ref<DealSearchResult[]>([])
const selectedDeal = ref<DealSearchResult | null>(null)
const showDealDropdown = ref(false)

const form = ref({ amount: '', paymentType: 'mib', note: '' })

let searchTimeout: ReturnType<typeof setTimeout> | null = null

function openDialog() {
  dialogOpen.value = true
  saveError.value = ''
  dealQuery.value = ''
  dealResults.value = []
  selectedDeal.value = null
  showDealDropdown.value = false
  form.value = { amount: '', paymentType: 'mib', note: '' }
}

function closeDialog() {
  dialogOpen.value = false
}

async function onDealInput() {
  selectedDeal.value = null
  if (searchTimeout) clearTimeout(searchTimeout)
  if (!dealQuery.value.trim()) {
    dealResults.value = []
    showDealDropdown.value = false
    return
  }
  dealSearching.value = true
  searchTimeout = setTimeout(async () => {
    try {
      dealResults.value = await manualStore.searchDeals(dealQuery.value)
      showDealDropdown.value = dealResults.value.length > 0
    } finally {
      dealSearching.value = false
    }
  }, 300)
}

function selectDeal(deal: DealSearchResult) {
  selectedDeal.value = deal
  dealQuery.value = deal.dealNumber
  showDealDropdown.value = false
}

const paymentTypeOptions = [
  { label: t('payments.typeMib'), value: 'mib' },
  { label: t('payments.typeTransfer'), value: 'transfer' },
]

const formValid = computed(
  () =>
    selectedDeal.value !== null &&
    Number(form.value.amount) > 0 &&
    form.value.paymentType !== '',
)

async function submit() {
  if (!formValid.value || !selectedDeal.value) return
  saving.value = true
  saveError.value = ''
  try {
    await manualStore.create({
      dealId: selectedDeal.value.id,
      amount: Math.round(Number(form.value.amount) * 100),
      paymentType: form.value.paymentType,
      note: form.value.note || undefined,
    })
    closeDialog()
  } catch (err: any) {
    if (err?.message === 'OVERPAYMENT') {
      saveError.value = t('payments.errorOverpayment')
    } else {
      saveError.value = t('common.error')
    }
  } finally {
    saving.value = false
  }
}

const TYPE_LABEL: Record<string, string> = { mib: 'МИБ', transfer: 'Перевод' }

function hideDealDropdown() {
  setTimeout(() => { showDealDropdown.value = false }, 150)
}
</script>

<template>
  <div class="page">
    <template v-if="store.loading && store.payments.length === 0 && activeTab === 'schedule'">
      <div class="kpi-strip">
        <div v-for="i in 4" :key="i" class="kpi-card surface-card skeleton-card" />
      </div>
      <div class="surface-card skeleton-table" />
    </template>

    <div v-else-if="store.error && activeTab === 'schedule'" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ store.error }}</p>
      <button class="btn-ghost" @click="store.fetchPayments(merchantFilter ?? undefined)">{{ $t('common.retry') }}</button>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ $t('routeTitle.payments') }}</h1>
          <p class="page-sub">{{ $t('payments.pageSubtitle') }}</p>
        </div>
        <button v-if="activeTab === 'manual'" class="btn-primary" @click="openDialog">
          <i class="pi pi-plus" />
          {{ $t('payments.addManual') }}
        </button>
      </div>

      <!-- KPI strip -->
      <div class="kpi-strip">
        <div class="kpi-card surface-card">
          <span class="kpi-label">{{ $t('payments.totalPayments') }}</span>
          <span class="kpi-value font-mono">{{ stats.total }}</span>
        </div>
        <div class="kpi-card surface-card">
          <span class="kpi-label">{{ $t('payments.statusConfirmed') }}</span>
          <span class="kpi-value font-mono" style="color:var(--success)">{{ stats.confirmed }}</span>
        </div>
        <div class="kpi-card surface-card">
          <span class="kpi-label">{{ $t('payments.statusPending') }}</span>
          <span class="kpi-value font-mono" style="color:var(--warning)">{{ stats.pending }}</span>
        </div>
        <div class="kpi-card surface-card">
          <span class="kpi-label">{{ $t('payments.statusPartial') }}</span>
          <span class="kpi-value font-mono" style="color:var(--accent-2)">{{ stats.partial }}</span>
        </div>
        <div class="kpi-card surface-card">
          <span class="kpi-label">{{ $t('payments.volume') }}</span>
          <span class="kpi-value font-mono text-gradient">{{ formatSomM(stats.volume) }} {{ $t('common.som') }}</span>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tab-bar surface-card">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'schedule' }"
          @click="switchTab('schedule')"
        >
          <i class="pi pi-credit-card" />
          {{ $t('payments.tabSchedule') }}
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'manual' }"
          @click="switchTab('manual')"
        >
          <i class="pi pi-pen-to-square" />
          {{ $t('payments.tabManual') }}
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'plan' }"
          @click="switchTab('plan')"
        >
          <i class="pi pi-calendar" />
          {{ $t('payments.tabPlan') }}
        </button>
      </div>

      <!-- ── Schedule tab ── -->
      <template v-if="activeTab === 'schedule'">
        <div class="surface-card filters-bar">
          <span class="search-wrap">
            <i class="pi pi-search search-icon" />
            <input v-model="search" class="search-input" :placeholder="$t('payments.search')" />
          </span>
          <Select
            v-model="merchantFilter"
            :options="merchantOptions"
            option-label="label"
            option-value="value"
            :placeholder="$t('payments.allMerchants')"
            class="filter-select"
          />
          <Select
            v-model="statusFilter"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            :placeholder="$t('payments.allStatuses')"
            class="filter-select"
          />
        </div>

        <div class="surface-card table-card">
          <DataTable
            :value="filtered"
            data-key="id"
            row-hover
            removable-sort
            :paginator="filtered.length > 15"
            :rows="15"
            :rows-per-page-options="[10, 15, 25, 50]"
            size="small"
            class="grid-table"
          >
            <Column :header="$t('payments.merchant')" field="merchantName" sortable>
              <template #body="{ data }">
                <RouterLink :to="`/merchants/${data.merchantId}`" class="table-link">{{ data.merchantName }}</RouterLink>
              </template>
            </Column>
            <Column :header="$t('payments.client')" field="clientName" sortable>
              <template #body="{ data }">
                <div class="client-cell">
                  <span class="client-name">{{ data.clientName }}</span>
                  <span class="client-phone font-mono muted">{{ data.clientPhone }}</span>
                </div>
              </template>
            </Column>
            <Column :header="$t('payments.contract')" field="dealNumber" style="width:200px">
              <template #body="{ data }">
                <RouterLink :to="`/deals/${data.contractId}`" class="font-mono deal-id">{{ data.dealNumber }}</RouterLink>
              </template>
            </Column>
            <Column :header="$t('payments.amount')" field="amount" sortable style="width:200px">
              <template #body="{ data }">
                <div v-if="data.status === 'partial'" class="partial-amount">
                  <MonoAmount :value="data.paidAmount" size="sm" />
                  <span class="partial-of font-mono">/ {{ (data.amount / 100).toLocaleString('ru') }}</span>
                </div>
                <MonoAmount v-else :value="data.amount" size="sm" />
              </template>
            </Column>
            <Column :header="$t('payments.status')" field="status" sortable style="width:130px">
              <template #body="{ data }">
                <span
                  class="pill"
                  :style="{ color: STATUS_COLORS[data.status as Payment['status']].fg, background: STATUS_COLORS[data.status as Payment['status']].bg }"
                >{{ $t('payments.status' + data.status.charAt(0).toUpperCase() + data.status.slice(1)) }}</span>
              </template>
            </Column>
            <Column :header="$t('payments.date')" field="date" sortable style="width:120px">
              <template #body="{ data }">
                <span class="font-mono muted">{{ formatDate(data.date) }}</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>

      <!-- ── Manual payments tab ── -->
      <template v-else-if="activeTab === 'manual'">
        <div class="surface-card table-card">
          <div class="table-section-header">{{ $t('payments.manualTitle') }}</div>

          <div v-if="manualStore.loading" class="empty-state">
            <i class="pi pi-spin pi-spinner" style="font-size:1.6rem;color:var(--text-secondary)" />
          </div>

          <div v-else-if="manualStore.error" class="empty-state">
            <p class="muted">{{ manualStore.error }}</p>
            <button class="btn-ghost" style="margin-top:.5rem" @click="manualStore.fetch()">{{ $t('common.retry') }}</button>
          </div>

          <div v-else-if="manualStore.payments.length === 0" class="empty-state">
            <i class="pi pi-inbox" style="font-size:2rem;color:var(--text-secondary);opacity:.4" />
            <p class="muted" style="margin:.5rem 0 0">{{ $t('payments.manualEmpty') }}</p>
          </div>

          <DataTable
            v-else
            :value="manualStore.payments"
            data-key="id"
            row-hover
            removable-sort
            :paginator="manualStore.payments.length > 15"
            :rows="15"
            :rows-per-page-options="[10, 15, 25, 50]"
            size="small"
            class="grid-table"
          >
            <Column :header="$t('payments.colId')" field="id" style="width:80px">
              <template #body="{ data }">
                <span class="font-mono muted" style="font-size:.75rem">#{{ data.id }}</span>
              </template>
            </Column>
            <Column :header="$t('payments.colClient')" field="clientName" sortable>
              <template #body="{ data }">
                <div class="client-cell">
                  <span class="client-name">{{ data.clientName }}</span>
                  <span class="client-phone font-mono muted">{{ data.clientPhone }}</span>
                </div>
              </template>
            </Column>
            <Column :header="$t('payments.colDeal')" field="dealNumber" sortable style="width:160px">
              <template #body="{ data }">
                <span class="font-mono deal-id">{{ data.dealNumber }}</span>
              </template>
            </Column>
            <Column :header="$t('payments.colAmount')" field="amount" sortable style="width:160px">
              <template #body="{ data }">
                <MonoAmount :value="data.amount" size="sm" />
              </template>
            </Column>
            <Column :header="$t('payments.colType')" field="paymentType" sortable style="width:110px">
              <template #body="{ data }">
                <span class="pill" style="color:var(--accent-2);background:color-mix(in srgb, var(--accent-2) 12%, transparent)">
                  {{ TYPE_LABEL[data.paymentType] ?? data.paymentType }}
                </span>
              </template>
            </Column>
            <Column :header="$t('payments.colNote')" field="note" style="width:200px">
              <template #body="{ data }">
                <span class="muted" style="font-size:.82rem">{{ data.note ?? '—' }}</span>
              </template>
            </Column>
            <Column :header="$t('payments.colDate')" field="createdAt" sortable style="width:120px">
              <template #body="{ data }">
                <span class="font-mono muted">{{ formatDate(data.createdAt) }}</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>

      <!-- ── Plan tab (placeholder) ── -->
      <template v-else>
        <div class="surface-card empty-state" style="min-height:200px">
          <i class="pi pi-calendar" style="font-size:2rem;color:var(--text-secondary);opacity:.4" />
          <p class="muted" style="margin:.5rem 0 0">{{ $t('payments.tabPlan') }} — coming soon</p>
        </div>
      </template>
    </template>

    <!-- ── Manual payment dialog ─────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="dialogOpen" class="dialog-backdrop" @mousedown.self="closeDialog">
        <div class="dialog surface-card">
          <div class="dialog-header">
            <h3>{{ $t('payments.dialogTitle') }}</h3>
            <button class="close-btn" @click="closeDialog"><i class="pi pi-times" /></button>
          </div>

          <div class="dialog-body">
            <!-- Deal search -->
            <div class="field">
              <label class="field-label">{{ $t('payments.dealLabel') }}</label>
              <div class="deal-search-wrap">
                <i class="pi pi-search deal-search-icon" />
                <input
                  v-model="dealQuery"
                  class="deal-search-input"
                  :placeholder="$t('payments.dealPlaceholder')"
                  autocomplete="off"
                  @input="onDealInput"
                  @focus="showDealDropdown = dealResults.length > 0"
                  @blur="hideDealDropdown"
                />
                <i v-if="dealSearching" class="pi pi-spin pi-spinner deal-search-spinner" />
              </div>
              <div v-if="showDealDropdown" class="deal-dropdown">
                <button
                  v-for="d in dealResults"
                  :key="d.id"
                  class="deal-option"
                  @mousedown.prevent="selectDeal(d)"
                >
                  <span class="deal-option-number font-mono">{{ d.dealNumber }}</span>
                  <span class="deal-option-client">{{ d.clientName }}</span>
                  <span class="deal-option-remaining">
                    {{ $t('payments.dealRemaining', { amount: (d.remainingAmount / 100).toLocaleString('ru') }) }}
                  </span>
                </button>
              </div>
              <p v-if="dealQuery && !dealSearching && dealResults.length === 0 && !selectedDeal" class="field-hint">
                {{ $t('payments.dealNoResults') }}
              </p>
              <p v-if="selectedDeal" class="deal-selected-hint">
                {{ $t('payments.dealRemaining', { amount: (selectedDeal.remainingAmount / 100).toLocaleString('ru') }) }}
              </p>
            </div>

            <!-- Amount -->
            <div class="field">
              <label class="field-label">{{ $t('payments.amountLabel') }}</label>
              <div class="amount-wrap">
                <input
                  v-model="form.amount"
                  type="number"
                  min="1"
                  class="amount-input"
                  placeholder="500 000"
                />
                <span class="amount-suffix">so'm</span>
              </div>
            </div>

            <!-- Payment type -->
            <div class="field">
              <label class="field-label">{{ $t('payments.typeLabel') }}</label>
              <select v-model="form.paymentType" class="native-select">
                <option v-for="opt in paymentTypeOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- Note -->
            <div class="field">
              <label class="field-label">{{ $t('payments.noteLabel') }}</label>
              <textarea
                v-model="form.note"
                class="note-textarea"
                rows="2"
                :placeholder="$t('payments.notePlaceholder')"
              />
            </div>

            <p v-if="saveError" class="field-error">{{ saveError }}</p>
          </div>

          <div class="dialog-footer">
            <button class="btn-ghost" @click="closeDialog">{{ $t('common.cancel') }}</button>
            <button class="btn-primary" :disabled="!formValid || saving" @click="submit">
              <i v-if="saving" class="pi pi-spin pi-spinner" />
              {{ saving ? $t('payments.submitting') : $t('payments.submit') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.4rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.page-title { margin: 0 0 0.2rem; font-size: 1.55rem; font-weight: 800; }
.page-sub { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }

/* KPI */
.kpi-strip { display: grid; grid-template-columns: repeat(5,1fr); gap: 1rem; }
.kpi-card { padding: 1.25rem 1.4rem; display: flex; flex-direction: column; gap: 0.4rem; }
.kpi-label { font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
.kpi-value { font-size: 1.6rem; font-weight: 800; line-height: 1; }

.skeleton-card { height: 92px; opacity: 0.5; animation: pulse 1.4s ease-in-out infinite; }
.skeleton-table { height: 400px; opacity: 0.5; animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity:.5 } 50% { opacity:.25 } }

/* Tabs */
.tab-bar {
  display: flex; gap: 0.25rem; padding: 0.5rem;
  border-radius: 14px; overflow: hidden;
}
.tab-btn {
  display: flex; align-items: center; gap: 0.45rem;
  padding: 0.5rem 1.1rem; border-radius: 10px;
  border: none; background: transparent; cursor: pointer;
  font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);
  font-family: inherit; transition: all 0.15s ease;
}
.tab-btn:hover { background: var(--bg-base); color: var(--text-primary); }
.tab-btn.active { background: var(--accent-2); color: #fff; }
.tab-btn .pi { font-size: 0.82rem; }

/* Buttons */
.btn-primary {
  display: inline-flex; align-items: center; gap: 0.45rem;
  padding: 0.55rem 1.2rem; border-radius: 10px; border: none;
  background: var(--accent-2); color: #fff;
  font-size: 0.88rem; font-weight: 700; font-family: inherit;
  cursor: pointer; transition: opacity 0.15s ease;
}
.btn-primary:hover:not(:disabled) { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost {
  padding: 0.5rem 1rem; border-radius: 10px;
  border: 1px solid var(--border-subtle); background: transparent;
  color: var(--text-secondary); font-size: 0.88rem; font-weight: 600;
  font-family: inherit; cursor: pointer; transition: all 0.12s;
}
.btn-ghost:hover { color: var(--text-primary); border-color: var(--text-secondary); }

/* Filters */
.filters-bar { display: flex; align-items: center; gap: 0.8rem; padding: 0.9rem 1.2rem; flex-wrap: wrap; }
.search-wrap { display: flex; align-items: center; position: relative; flex: 1; min-width: 200px; }
.search-icon { position: absolute; left: 0.75rem; color: var(--text-secondary); font-size: 0.9rem; pointer-events: none; }
.search-input {
  width: 100%; padding: 0.5rem 0.75rem 0.5rem 2.2rem;
  border: 1px solid var(--border-subtle); border-radius: 10px;
  background: var(--bg-base); color: var(--text-primary);
  font-size: 0.88rem; font-family: inherit; outline: none; transition: border-color 0.15s ease;
}
.search-input:focus { border-color: var(--accent-2); }
.filter-select { width: 200px; flex-shrink: 0; }

/* Tables */
.table-card { padding: 0; overflow: hidden; }
.table-section-header {
  padding: 1rem 1.2rem 0.6rem;
  font-size: 0.88rem; font-weight: 800; color: var(--text-primary);
}
:deep(.grid-table .p-datatable-thead > tr > th) {
  background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle);
  font-size: 0.72rem; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.05em; padding: 0.7rem 1rem;
}
:deep(.grid-table .p-datatable-tbody > tr > td) {
  padding: 0.8rem 1rem; border-bottom: 1px solid var(--border-subtle); vertical-align: middle;
}
:deep(.grid-table .p-paginator) {
  padding: 0.8rem 1rem; border-top: 1px solid var(--border-subtle); background: var(--bg-surface);
}

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 3rem 2rem; gap: 0.5rem;
}

.client-cell { display: flex; flex-direction: column; gap: 0.15rem; }
.client-name { font-weight: 700; }
.client-phone { font-size: 0.78rem; }
.deal-id { font-size: 0.78rem; font-weight: 700; color: var(--accent-2); text-decoration: none; }
.deal-id:hover { text-decoration: underline; }
.table-link { color: var(--accent-2); text-decoration: none; font-weight: 600; }
.table-link:hover { text-decoration: underline; }
.muted { color: var(--text-secondary); }
.pill {
  display: inline-flex; align-items: center; padding: 0.18rem 0.55rem; border-radius: 999px;
  font-size: 0.72rem; font-weight: 700; white-space: nowrap;
  border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
}

.partial-amount { display: flex; align-items: baseline; gap: 0.3rem; }
.partial-of { font-size: 0.72rem; color: var(--text-secondary); }

.error-state { padding: 3rem 2rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-align: center; }
.error-state i { font-size: 2.2rem; color: var(--danger); }
.error-state p { margin: 0; font-weight: 600; color: var(--text-secondary); }

/* ── Dialog ───────────────────────────────────────────────────────────────── */
.dialog-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  z-index: 200; display: grid; place-items: center; padding: 1rem;
}
.dialog { width: 100%; max-width: 460px; border-radius: 16px; overflow: visible; }
.dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.2rem; border-bottom: 1px solid var(--border-subtle);
}
.dialog-header h3 { margin: 0; font-size: 1rem; font-weight: 800; }
.close-btn {
  width: 28px; height: 28px; border-radius: 7px;
  border: 1px solid var(--border-subtle); background: var(--bg-surface);
  color: var(--text-secondary); cursor: pointer; display: grid; place-items: center;
  font-size: 0.78rem; transition: all 0.12s;
}
.close-btn:hover { color: var(--text-primary); }
.dialog-body { padding: 1.2rem; display: flex; flex-direction: column; gap: 1rem; }
.dialog-footer {
  display: flex; justify-content: flex-end; gap: 0.6rem;
  padding: 1rem 1.2rem; border-top: 1px solid var(--border-subtle);
}

.field { display: flex; flex-direction: column; gap: 0.4rem; position: relative; }
.field-label {
  font-size: 0.78rem; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.field-error { font-size: 0.8rem; color: var(--danger); margin: 0; }
.field-hint { font-size: 0.8rem; color: var(--text-secondary); margin: 0; }

/* Deal search */
.deal-search-wrap { position: relative; display: flex; align-items: center; }
.deal-search-icon {
  position: absolute; left: 0.75rem; color: var(--text-secondary);
  font-size: 0.88rem; pointer-events: none; z-index: 1;
}
.deal-search-input {
  width: 100%; padding: 0.55rem 2.5rem 0.55rem 2.2rem;
  border: 1px solid var(--border-subtle); border-radius: 10px;
  background: var(--bg-base); color: var(--text-primary);
  font-size: 0.88rem; font-family: inherit; outline: none; transition: border-color 0.15s;
}
.deal-search-input:focus { border-color: var(--accent-2); }
.deal-search-spinner {
  position: absolute; right: 0.75rem; color: var(--text-secondary); font-size: 0.88rem;
}
.deal-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 300;
  background: var(--bg-surface); border: 1px solid var(--border-subtle);
  border-radius: 10px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.deal-option {
  display: flex; align-items: center; gap: 0.75rem; width: 100%;
  padding: 0.65rem 1rem; border: none; background: transparent;
  text-align: left; cursor: pointer; transition: background 0.1s; font-family: inherit;
}
.deal-option:hover { background: var(--bg-base); }
.deal-option-number { font-size: 0.82rem; font-weight: 700; color: var(--accent-2); min-width: 90px; }
.deal-option-client { font-size: 0.85rem; font-weight: 600; flex: 1; color: var(--text-primary); }
.deal-option-remaining { font-size: 0.78rem; color: var(--text-secondary); white-space: nowrap; }
.deal-selected-hint { font-size: 0.8rem; color: var(--success); margin: 0; font-weight: 600; }

/* Amount */
.amount-wrap { display: flex; align-items: stretch; border: 1px solid var(--border-subtle); border-radius: 10px; overflow: hidden; }
.amount-input {
  flex: 1; padding: 0.55rem 0.75rem; border: none; background: var(--bg-base);
  color: var(--text-primary); font-size: 0.88rem; font-family: inherit; outline: none;
}
.amount-suffix {
  display: flex; align-items: center; padding: 0 0.75rem;
  background: var(--bg-surface); border-left: 1px solid var(--border-subtle);
  font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);
}

/* Native select */
.native-select {
  padding: 0.55rem 0.75rem; border: 1px solid var(--border-subtle); border-radius: 10px;
  background: var(--bg-base); color: var(--text-primary);
  font-size: 0.88rem; font-family: inherit; outline: none; appearance: auto; cursor: pointer;
}
.native-select:focus { border-color: var(--accent-2); }

/* Note */
.note-textarea {
  padding: 0.55rem 0.75rem; border: 1px solid var(--border-subtle); border-radius: 10px;
  background: var(--bg-base); color: var(--text-primary);
  font-size: 0.88rem; font-family: inherit; outline: none; resize: vertical;
  transition: border-color 0.15s;
}
.note-textarea:focus { border-color: var(--accent-2); }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 1100px) { .kpi-strip { grid-template-columns: repeat(3,1fr); } }
@media (max-width: 700px) { .kpi-strip { grid-template-columns: repeat(2,1fr); } }
</style>
