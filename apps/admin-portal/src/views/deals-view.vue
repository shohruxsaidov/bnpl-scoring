<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import { useDealsStore } from '@/stores/deals'
import StatusBadge from '@/components/status-badge.vue'
import MonoAmount from '@/components/mono-amount.vue'
import { formatDate } from '@/utils/money'
import type { Deal, DealStatus } from '@/types'

const deals = useDealsStore()
const router = useRouter()
const { t } = useI18n()

onMounted(() => deals.fetchDeals())

// ── Filters ───────────────────────────────────────────────────────────────

const statusFilter = ref<DealStatus | null>(null)
const search = ref('')

const statusOptions = computed<{ label: string; value: DealStatus | null }[]>(() => [
  { label: t('deals.allStatuses'), value: null },
  { label: t('deals.statusActive'), value: 'active' },
  { label: t('deals.statusOverdue'), value: 'overdue' },
  { label: t('deals.statusClosed'), value: 'closed' },
  { label: t('deals.statusDeclined'), value: 'declined' },
  { label: t('deals.statusScoring'), value: 'scoring' },
])

const filtered = computed<Deal[]>(() => {
  let list = deals.deals
  if (statusFilter.value) list = list.filter((d) => d.status === statusFilter.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (d) =>
        d.clientName.toLowerCase().includes(q) ||
        d.dealNumber.toLowerCase().includes(q) ||
        d.clientPhone.includes(q),
    )
  }
  return list
})

// ── KPI ───────────────────────────────────────────────────────────────────

const stats = computed(() => ({
  total: deals.deals.length,
  active: deals.deals.filter((d) => d.status === 'active').length,
  overdue: deals.deals.filter((d) => d.status === 'overdue').length,
  volume: deals.platformVolume,
}))

function formatSomM(som: number): string {
  if (som >= 1_000_000_000) return `${(som / 1_000_000_000).toFixed(1)}B`
  if (som >= 1_000_000) return `${(som / 1_000_000).toFixed(1)}M`
  if (som >= 1_000) return `${(som / 1_000).toFixed(0)}K`
  return som.toFixed(0)
}

function openDeal(deal: Deal) {
  router.push(`/deals/${deal.id}`)
}
</script>

<template>
  <div class="deals-page">

    <!-- ── Loading skeleton ────────────────────────────────────────────── -->
    <template v-if="deals.loading">
      <div class="kpi-strip">
        <div v-for="i in 4" :key="i" class="kpi-card surface-card skeleton-card" />
      </div>
      <div class="surface-card skeleton-table" />
    </template>

    <!-- ── Error ──────────────────────────────────────────────────────── -->
    <div v-else-if="deals.error" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ deals.error }}</p>
      <button class="btn-ghost" @click="deals.fetchDeals()">{{ $t('common.retry') }}</button>
    </div>

    <template v-else>
      <!-- ── Page header ──────────────────────────────────────────────── -->
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ $t('routeTitle.deals') }}</h1>
          <p class="page-sub">{{ $t('deals.dealsCount', { count: filtered.length }) }}</p>
        </div>
      </div>

      <!-- ── KPI strip ────────────────────────────────────────────────── -->
      <div class="kpi-strip">
        <div class="kpi-card surface-card">
          <div class="kpi-icon-row">
            <div class="kpi-icon" style="background:var(--gradient-hero)"><i class="pi pi-briefcase" /></div>
          </div>
          <span class="kpi-label">{{ $t('overview.totalDeals') }}</span>
          <span class="kpi-value font-mono">{{ stats.total }}</span>
        </div>
        <div class="kpi-card surface-card">
          <div class="kpi-icon-row">
            <div class="kpi-icon" style="background:linear-gradient(135deg,#00c49a,#00d4aa)"><i class="pi pi-bolt" /></div>
          </div>
          <span class="kpi-label">{{ $t('tenantDetail.statusActive') }}</span>
          <span class="kpi-value font-mono" style="color:var(--success)">{{ stats.active }}</span>
        </div>
        <div class="kpi-card surface-card">
          <div class="kpi-icon-row">
            <div class="kpi-icon" style="background:linear-gradient(135deg,#6C63FF,#8B5CF6)"><i class="pi pi-wallet" /></div>
          </div>
          <span class="kpi-label">{{ $t('overview.platformVolume') }}</span>
          <span class="kpi-value font-mono text-gradient">{{ formatSomM(stats.volume) }} {{ $t('common.som') }}</span>
        </div>
        <div class="kpi-card surface-card">
          <div class="kpi-icon-row">
            <div class="kpi-icon" style="background:linear-gradient(135deg,#FF4C4C,#FF7070)"><i class="pi pi-exclamation-triangle" /></div>
          </div>
          <span class="kpi-label">{{ $t('overview.overdueDeals') }}</span>
          <span class="kpi-value font-mono" :style="stats.overdue > 0 ? 'color:var(--danger)' : ''">{{ stats.overdue }}</span>
        </div>
      </div>

      <!-- ── Filters ──────────────────────────────────────────────────── -->
      <div class="surface-card filters-bar">
        <span class="search-wrap">
          <i class="pi pi-search search-icon" />
          <input
            v-model="search"
            class="search-input"
            :placeholder="$t('topbar.searchPlaceholder')"
          />
        </span>
        <Select
          v-model="statusFilter"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="$t('deals.allStatuses')"
          class="status-select"
        />
      </div>

      <!-- ── Table ────────────────────────────────────────────────────── -->
      <div class="surface-card table-card">
        <DataTable
          :value="filtered"
          data-key="id"
          row-hover
          removable-sort
          :paginator="filtered.length > 15"
          :rows="15"
          :rows-per-page-options="[10, 15, 25, 50]"
          paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
          size="small"
          class="deals-table"
          @row-click="openDeal($event.data as Deal)"
        >
          <Column :header="$t('deals.dealNumber')" field="dealNumber" sortable style="width:140px">
            <template #body="{ data }">
              <span class="font-mono deal-id">{{ data.dealNumber }}</span>
            </template>
          </Column>

          <Column :header="$t('deals.client')" field="clientName" sortable>
            <template #body="{ data }">
              <div class="client-cell">
                <span class="client-name">{{ data.clientName }}</span>
                <span class="client-phone font-mono muted">{{ data.clientPhone }}</span>
              </div>
            </template>
          </Column>

          <Column :header="$t('deals.status')" field="status" sortable style="width:130px">
            <template #body="{ data }">
              <StatusBadge :status="data.status" />
            </template>
          </Column>

          <Column :header="$t('deals.amount')" field="amount" sortable style="width:160px">
            <template #body="{ data }">
              <MonoAmount :value="data.amount" size="sm" />
            </template>
          </Column>

          <Column :header="$t('deals.score')" field="score" sortable style="width:90px">
            <template #body="{ data }">
              <span class="font-mono muted">{{ data.score || '—' }}</span>
            </template>
          </Column>

          <Column :header="$t('deals.agent')" field="agentName" sortable>
            <template #body="{ data }">
              <span class="muted">{{ data.agentName }}</span>
            </template>
          </Column>

          <Column :header="$t('deals.date')" field="createdAt" sortable style="width:110px">
            <template #body="{ data }">
              <span class="font-mono muted">{{ formatDate(data.createdAt) }}</span>
            </template>
          </Column>

          <Column style="width:52px">
            <template #body="{ data }">
              <button class="open-btn" @click.stop="openDeal(data)">
                <i class="pi pi-arrow-right" />
              </button>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </div>
</template>

<style scoped>
.deals-page { display: flex; flex-direction: column; gap: 1.4rem; }

/* ── Page header ────────────────────────────────────────────────────────── */
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.page-title { margin: 0 0 0.2rem; font-size: 1.55rem; font-weight: 800; }
.page-sub { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }

/* ── KPI strip ──────────────────────────────────────────────────────────── */
.kpi-strip { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; }
.kpi-card { padding: 1.25rem 1.4rem; display: flex; flex-direction: column; gap: 0.4rem; }
.kpi-icon-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem; }
.kpi-icon { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; color: #fff; font-size: 1rem; }
.kpi-label { font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
.kpi-value { font-size: 1.6rem; font-weight: 800; line-height: 1; }

/* ── Skeleton ───────────────────────────────────────────────────────────── */
.skeleton-card { height: 110px; opacity: 0.5; animation: pulse 1.4s ease-in-out infinite; }
.skeleton-table { height: 400px; opacity: 0.5; animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity:.5 } 50% { opacity:.25 } }

/* ── Filters ────────────────────────────────────────────────────────────── */
.filters-bar { display: flex; align-items: center; gap: 0.8rem; padding: 0.9rem 1.2rem; flex-wrap: wrap; }
.search-wrap { display: flex; align-items: center; position: relative; flex: 1; min-width: 200px; }
.search-icon { position: absolute; left: 0.75rem; color: var(--text-secondary); font-size: 0.9rem; pointer-events: none; }
.search-input {
  width: 100%; padding: 0.5rem 0.75rem 0.5rem 2.2rem;
  border: 1px solid var(--border-subtle); border-radius: 10px;
  background: var(--bg-base); color: var(--text-primary);
  font-size: 0.88rem; font-family: inherit; outline: none;
  transition: border-color 0.15s ease;
}
.search-input:focus { border-color: var(--accent-2); }
.status-select { width: 180px; flex-shrink: 0; }

/* ── Table ──────────────────────────────────────────────────────────────── */
.table-card { padding: 0; overflow: hidden; }
@media (max-width: 600px) { .table-card { overflow-x: auto; } }
:deep(.deals-table .p-datatable-thead > tr > th) {
  background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle);
  font-size: 0.72rem; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.05em; padding: 0.7rem 1rem;
}
:deep(.deals-table .p-datatable-tbody > tr) { cursor: pointer; transition: background 0.12s ease; }
:deep(.deals-table .p-datatable-tbody > tr:hover) { background: var(--bg-surface) !important; }
:deep(.deals-table .p-datatable-tbody > tr > td) {
  padding: 0.8rem 1rem; border-bottom: 1px solid var(--border-subtle); vertical-align: middle;
}
:deep(.deals-table .p-paginator) {
  padding: 0.8rem 1rem; border-top: 1px solid var(--border-subtle); background: var(--bg-surface);
}

/* ── Cells ──────────────────────────────────────────────────────────────── */
.deal-id { font-size: 0.78rem; font-weight: 700; color: var(--accent-2); }
.client-cell { display: flex; flex-direction: column; gap: 0.15rem; }
.client-name { font-weight: 700; }
.client-phone { font-size: 0.78rem; }
.muted { color: var(--text-secondary); }
.open-btn {
  width: 32px; height: 32px; border-radius: 8px;
  border: 1px solid var(--border-subtle); background: var(--bg-base);
  color: var(--text-secondary); cursor: pointer;
  display: grid; place-items: center; font-size: 0.8rem; transition: all 0.15s ease;
}
.open-btn:hover { background: var(--gradient-accent); border-color: transparent; color: #fff; }

/* ── Error state ────────────────────────────────────────────────────────── */
.error-state { padding: 3rem 2rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-align: center; }
.error-state i { font-size: 2.2rem; color: var(--danger); }
.error-state p { margin: 0; font-weight: 600; color: var(--text-secondary); }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 900px) { .kpi-strip { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 600px) { .kpi-strip { grid-template-columns: 1fr 1fr; } }
@media (max-width: 450px) {
  .filters-bar { flex-direction: column; align-items: stretch; }
  .search-wrap { min-width: 0; }
  .status-select { width: 100%; }
}
</style>
