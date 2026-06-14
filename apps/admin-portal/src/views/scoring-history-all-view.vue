<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useScoringHistoryStore, type ScoringListItem } from '@/stores/scoring-history'
import MonoAmount from '@/components/mono-amount.vue'
import { formatDate } from '@/utils/money'

const store = useScoringHistoryStore()
const router = useRouter()
const { t } = useI18n()

const search = ref('')
const statusFilter = ref<ScoringListItem['status'] | null>(null)

onMounted(() => store.fetchAllList())

const statusOptions = computed(() => [
  { label: t('scoringHistory.allStatuses'), value: null },
  { label: t('scoringHistory.approved'), value: 'approved' },
  { label: t('scoringHistory.declined'), value: 'declined' },
  { label: t('scoringHistory.pending'), value: 'pending' },
])

const filtered = computed<ScoringListItem[]>(() => {
  let list = store.records
  if (statusFilter.value) list = list.filter((r) => r.status === statusFilter.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (r) => r.clientName.toLowerCase().includes(q) || r.clientPhone.includes(q) || r.pinfl.includes(q),
    )
  }
  return list
})

const stats = computed(() => ({
  total: store.records.length,
  approved: store.records.filter((r) => r.status === 'approved').length,
  declined: store.records.filter((r) => r.status === 'declined').length,
  avg: store.records.length
    ? Math.round(store.records.reduce((s, r) => s + r.score, 0) / store.records.length)
    : 0,
}))

const STATUS_COLORS: Record<ScoringListItem['status'], { fg: string; bg: string }> = {
  approved: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  declined: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  pending: { fg: 'var(--warning)', bg: 'var(--warning-bg)' },
}

function openDetail(row: ScoringListItem) {
  router.push(`/scoring-history/${row.id}`)
}
</script>

<template>
  <div class="page">
    <template v-if="store.loading && store.records.length === 0">
      <div class="kpi-strip">
        <div v-for="i in 4" :key="i" class="kpi-card surface-card skeleton-card" />
      </div>
      <div class="surface-card skeleton-table" />
    </template>

    <div v-else-if="store.error" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ store.error }}</p>
      <button class="btn-ghost" @click="store.fetchAllList()">{{ $t('common.retry') }}</button>
    </div>

    <template v-else>
      <div class="page-header">
        <div>
          <button class="back-link" @click="router.push({ name: 'scoring-history' })">
            <i class="pi pi-arrow-left" /> {{ $t('scoringHistory.backToClients') }}
          </button>
          <h1 class="page-title">{{ $t('scoringHistory.allHistory') }}</h1>
          <p class="page-sub">{{ $t('scoringHistory.count', { count: filtered.length }) }}</p>
        </div>
      </div>

      <div class="kpi-strip">
        <div class="kpi-card surface-card">
          <span class="kpi-label">{{ $t('scoringHistory.totalRequests') }}</span>
          <span class="kpi-value font-mono">{{ stats.total }}</span>
        </div>
        <div class="kpi-card surface-card">
          <span class="kpi-label">{{ $t('scoringHistory.approved') }}</span>
          <span class="kpi-value font-mono" style="color:var(--success)">{{ stats.approved }}</span>
        </div>
        <div class="kpi-card surface-card">
          <span class="kpi-label">{{ $t('scoringHistory.declined') }}</span>
          <span class="kpi-value font-mono" style="color:var(--danger)">{{ stats.declined }}</span>
        </div>
        <div class="kpi-card surface-card">
          <span class="kpi-label">{{ $t('scoringHistory.avgScore') }}</span>
          <span class="kpi-value font-mono text-gradient">{{ stats.avg }}</span>
        </div>
      </div>

      <div class="surface-card filters-bar">
        <span class="search-wrap">
          <i class="pi pi-search search-icon" />
          <input v-model="search" class="search-input" :placeholder="$t('scoringHistory.searchClient')" />
        </span>
        <select v-model="statusFilter" class="filter-select-native">
          <option v-for="opt in statusOptions" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <div class="surface-card table-card">
        <DataTable :value="filtered" data-key="id" row-hover removable-sort
          :paginator="filtered.length > 15" :rows="15" :rows-per-page-options="[10, 15, 25, 50]"
          size="small" class="grid-table"
          @row-click="openDetail($event.data as ScoringListItem)">
          <Column :header="$t('scoringHistory.client')" field="clientName" sortable>
            <template #body="{ data }">
              <div class="client-cell">
                <span class="client-name">{{ data.clientName }}</span>
                <span class="client-phone font-mono muted">{{ data.clientPhone }}</span>
              </div>
            </template>
          </Column>
          <Column :header="$t('scoringHistory.score')" field="score" sortable style="width:90px">
            <template #body="{ data }">
              <span class="font-mono">{{ data.score || '—' }}</span>
            </template>
          </Column>
          <Column :header="$t('scoringHistory.limit')" field="limit" sortable style="width:160px">
            <template #body="{ data }">
              <MonoAmount :value="data.limit" size="sm" />
            </template>
          </Column>
          <Column :header="$t('scoringHistory.status')" field="status" sortable style="width:130px">
            <template #body="{ data }">
              <span class="pill"
                :style="{ color: STATUS_COLORS[data.status as ScoringListItem['status']].fg, background: STATUS_COLORS[data.status as ScoringListItem['status']].bg }">
                {{ $t('scoringHistory.' + data.status) }}
              </span>
            </template>
          </Column>
          <Column :header="$t('scoringHistory.date')" field="scoredAt" sortable style="width:120px">
            <template #body="{ data }">
              <span class="font-mono muted">{{ formatDate(data.scoredAt) }}</span>
            </template>
          </Column>
          <Column style="width:52px">
            <template #body="{ data }">
              <button class="open-btn" @click.stop="openDetail(data)">
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
.page {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.5rem;
}

.back-link:hover { color: var(--accent-2); }

.page-title {
  margin: 0 0 0.2rem;
  font-size: 1.55rem;
  font-weight: 800;
}

.page-sub {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.kpi-card {
  padding: 1.25rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.kpi-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.kpi-value {
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1;
}

.skeleton-card {
  height: 92px;
  opacity: 0.5;
  animation: pulse 1.4s ease-in-out infinite;
}

.skeleton-table {
  height: 400px;
  opacity: 0.5;
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: .5 }
  50% { opacity: .25 }
}

.filters-bar {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.9rem 1.2rem;
  flex-wrap: wrap;
}

.search-wrap {
  display: flex;
  align-items: center;
  position: relative;
  flex: 1;
  min-width: 200px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.2rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 0.88rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease;
}

.search-input:focus {
  border-color: var(--accent-2);
}

.filter-select-native {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 0.88rem;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  width: 200px;
  flex-shrink: 0;
}

.table-card {
  padding: 0;
  overflow: hidden;
}

:deep(.grid-table .p-datatable-thead > tr > th) {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.7rem 1rem;
}

:deep(.grid-table .p-datatable-tbody > tr) {
  cursor: pointer;
  transition: background 0.12s ease;
}

:deep(.grid-table .p-datatable-tbody > tr:hover) {
  background: var(--bg-surface) !important;
}

:deep(.grid-table .p-datatable-tbody > tr > td) {
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

:deep(.grid-table .p-paginator) {
  padding: 0.8rem 1rem;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}

.client-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.client-name { font-weight: 700; }

.client-phone { font-size: 0.78rem; }

.muted { color: var(--text-secondary); }

.pill {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
}

.open-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  transition: all 0.15s ease;
}

.open-btn:hover {
  background: var(--gradient-accent);
  border-color: transparent;
  color: #fff;
}

.error-state {
  padding: 3rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

.error-state i { font-size: 2.2rem; color: var(--danger); }
.error-state p { margin: 0; font-weight: 600; color: var(--text-secondary); }

@media (max-width: 900px) {
  .kpi-strip { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 600px) {
  .table-card { overflow-x: auto; }
}

@media (max-width: 450px) {
  .filters-bar { flex-direction: column; align-items: stretch; }
  .search-wrap { min-width: 0; }
  .filter-select-native { width: 100%; }
}
</style>
