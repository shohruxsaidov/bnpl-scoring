<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import { usePaymentsStore, type Payment } from '@/stores/payments'
import { useMerchantsStore } from '@/stores/merchants'
import MonoAmount from '@/components/MonoAmount.vue'
import { formatDate } from '@/utils/money'

const store = usePaymentsStore()
const merchantsStore = useMerchantsStore()
const { t } = useI18n()

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
        p.contractId.toLowerCase().includes(q),
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
    volume: confirmed.reduce((s, p) => s + p.amount, 0),
  }
})

const STATUS_COLORS: Record<Payment['status'], { fg: string; bg: string }> = {
  confirmed: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  pending: { fg: 'var(--warning)', bg: 'var(--warning-bg)' },
  cancelled: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
}

function formatSomM(tiyin: number): string {
  const som = tiyin / 100
  if (som >= 1_000_000_000) return `${(som / 1_000_000_000).toFixed(1)}B`
  if (som >= 1_000_000) return `${(som / 1_000_000).toFixed(1)}M`
  if (som >= 1_000) return `${(som / 1_000).toFixed(0)}K`
  return som.toFixed(0)
}
</script>

<template>
  <div class="page">
    <template v-if="store.loading && store.payments.length === 0">
      <div class="kpi-strip">
        <div v-for="i in 4" :key="i" class="kpi-card surface-card skeleton-card" />
      </div>
      <div class="surface-card skeleton-table" />
    </template>

    <div v-else-if="store.error" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ store.error }}</p>
      <button class="btn-ghost" @click="store.fetchPayments(merchantFilter ?? undefined)">{{ $t('common.retry') }}</button>
    </div>

    <template v-else>
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ $t('routeTitle.payments') }}</h1>
          <p class="page-sub">{{ $t('payments.count', { count: filtered.length }) }}</p>
        </div>
      </div>

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
          <span class="kpi-label">{{ $t('payments.volume') }}</span>
          <span class="kpi-value font-mono text-gradient">{{ formatSomM(stats.volume) }} {{ $t('common.som') }}</span>
        </div>
      </div>

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
          paginator
          :rows="15"
          :rows-per-page-options="[10, 15, 25, 50]"
          size="small"
          class="grid-table"
        >
          <Column :header="$t('payments.merchant')" field="merchantName" sortable>
            <template #body="{ data }">
              <span class="muted">{{ data.merchantName }}</span>
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
          <Column :header="$t('payments.contract')" field="contractId" style="width:280px">
            <template #body="{ data }">
              <span class="font-mono deal-id">{{ data.contractId }}</span>
            </template>
          </Column>
          <Column :header="$t('payments.amount')" field="amount" sortable style="width:160px">
            <template #body="{ data }">
              <MonoAmount :value="data.amount" size="sm" />
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
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.4rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.page-title { margin: 0 0 0.2rem; font-size: 1.55rem; font-weight: 800; }
.page-sub { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }

.kpi-strip { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; }
.kpi-card { padding: 1.25rem 1.4rem; display: flex; flex-direction: column; gap: 0.4rem; }
.kpi-label { font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
.kpi-value { font-size: 1.6rem; font-weight: 800; line-height: 1; }

.skeleton-card { height: 92px; opacity: 0.5; animation: pulse 1.4s ease-in-out infinite; }
.skeleton-table { height: 400px; opacity: 0.5; animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity:.5 } 50% { opacity:.25 } }

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

.table-card { padding: 0; overflow: hidden; }
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

.client-cell { display: flex; flex-direction: column; gap: 0.15rem; }
.client-name { font-weight: 700; }
.client-phone { font-size: 0.78rem; }
.deal-id { font-size: 0.78rem; font-weight: 700; color: var(--accent-2); }
.muted { color: var(--text-secondary); }
.pill {
  display: inline-flex; align-items: center; padding: 0.18rem 0.55rem; border-radius: 999px;
  font-size: 0.72rem; font-weight: 700; white-space: nowrap;
  border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
}

.error-state { padding: 3rem 2rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-align: center; }
.error-state i { font-size: 2.2rem; color: var(--danger); }
.error-state p { margin: 0; font-weight: 600; color: var(--text-secondary); }

@media (max-width: 900px) { .kpi-strip { grid-template-columns: repeat(2,1fr); } }
</style>
