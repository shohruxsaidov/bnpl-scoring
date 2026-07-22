<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import { useAuthStore } from '@/stores/auth'
import StatusBadge from '@/components/status-badge.vue'
import MonoAmount from '@/components/mono-amount.vue'
import SkeletonTable from '@/components/skeleton-table.vue'
import { formatDate } from '@/utils/money'
import { useDealsQuery, type DealListItem, type DealSortField, type DealSortOrder } from '@/composables/use-deals-api'
import type { DealStatus } from '@/types'

// The page header lives in the shell, above the tabs — so the count that
// belongs in its subtitle has to travel up from whichever panel is showing.
const emit = defineEmits<{ count: [number] }>()

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()

// ── Sort ──────────────────────────────────────────────────────────────────────
const sort = ref<{ field: DealSortField; order: DealSortOrder } | null>(null)

function onSort(e: { sortField?: string | ((item: any) => string); sortOrder?: number | null }) {
  if (!e.sortField || typeof e.sortField !== 'string') { sort.value = null; return }
  sort.value = {
    field: e.sortField as DealSortField,
    order: e.sortOrder === 1 ? 'asc' : 'desc',
  }
}

// ── Data ─────────────────────────────────────────────────────────────────────
const { data: dealsData, isLoading, isError, refetch } = useDealsQuery(sort)
const allDeals = computed<DealListItem[]>(() => dealsData.value ?? [])

// ── Filters ─────────────────────────────────────────────────────────────────
const search = ref('')
const statusFilter = ref<DealStatus | null>(null)

const statusOptions = computed<{ label: string; value: DealStatus | null }[]>(() => [
  { label: t('dashboard.allStatuses'), value: null },
  { label: t('status.draft'), value: 'draft' },
  { label: t('status.scoring'), value: 'scoring' },
  { label: t('status.approved'), value: 'approved' },
  { label: t('status.declined'), value: 'declined' },
  { label: t('status.active'), value: 'active' },
  { label: t('status.closed'), value: 'closed' },
  { label: t('status.overdue'), value: 'overdue' },
])

const visibleDeals = computed<DealListItem[]>(() => {
  return allDeals.value.filter((d) => {
    if (statusFilter.value && d.status !== statusFilter.value) return false
    if (search.value.trim()) {
      const q = search.value.toLowerCase()
      return (
        (d.clientName ?? '').toLowerCase().includes(q) ||
        d.dealNumber.toLowerCase().includes(q) ||
        (d.clientPhone ?? '').includes(q)
      )
    }
    return true
  })
})

watch(visibleDeals, (d) => emit('count', d.length), { immediate: true })

// ── Helpers ──────────────────────────────────────────────────────────────────
function openDeal(deal: DealListItem) {
  router.push(`/deals/${deal.id}`)
}
</script>

<template>
  <div class="deals-panel">
    <!-- ── Loading skeleton ─────────────────────────────────────────────── -->
    <template v-if="isLoading">
      <SkeletonTable :rows="8" :cols="6" :has-actions="true" :has-header="true" />
    </template>

    <!-- ── Error state ───────────────────────────────────────────────────── -->
    <div v-else-if="isError" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ t('common.error') }}</p>
      <button class="btn-ghost" @click="() => refetch()">{{ t('common.refresh') }}</button>
    </div>

    <template v-else>
      <!-- ── Filters ────────────────────────────────────────────────────── -->
      <div class="surface-card filters-bar">
        <span class="p-input-icon-left search-wrap">
          <i class="pi pi-search" />
          <input v-model="search" class="p-inputtext search-input" :placeholder="t('dashboard.searchDeals')" />
        </span>

        <Select v-model="statusFilter" :options="statusOptions" option-label="label" option-value="value"
          :placeholder="t('dashboard.filterStatus')" class="status-select" />
      </div>

      <!-- ── Table ──────────────────────────────────────────────────────── -->
      <div class="surface-card table-card">
        <DataTable :value="visibleDeals" row-hover :rows="15" paginator
          :rows-per-page-options="[10, 15, 25, 50]"
          paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
          :empty-message="t('dashboard.noDeals')" class="deals-table"
          @row-click="openDeal($event.data)" @sort="onSort">
          <Column field="dealNumber" :header="t('dashboard.dealId')" style="width: 140px">
            <template #body="{ data }">
              <span class="font-mono deal-id">{{ data.dealNumber }}</span>
            </template>
          </Column>

          <Column field="clientName" :header="t('dashboard.client')">
            <template #body="{ data }">
              <div class="client-cell">
                <span class="client-name">{{ data.clientName }}</span>
                <span class="client-phone font-mono muted">{{ data.clientPhone }}</span>
              </div>
            </template>
          </Column>

          <Column v-if="auth.isAdmin" field="agentName" :header="t('dealsPage.agent')">
            <template #body="{ data }">
              <span class="muted">{{ data.agentName || '—' }}</span>
            </template>
          </Column>

          <Column field="status" :header="t('dashboard.status')" sortable style="width: 130px">
            <template #body="{ data }">
              <StatusBadge :status="data.status" />
            </template>
          </Column>

          <Column field="tariffName" :header="t('dashboard.tariff')" style="width: 130px">
            <template #body="{ data }">
              <span class="tariff-chip">{{ data.tariffName }}</span>
            </template>
          </Column>

          <Column field="amount" :header="t('dashboard.amount')" sortable style="width: 160px">
            <template #body="{ data }">
              <MonoAmount :value="data.totalPayable" />
            </template>
          </Column>

          <Column field="termMonths" :header="t('dealsPage.term')" style="width: 90px">
            <template #body="{ data }">
              <span class="font-mono muted">{{ data.termMonths }} {{ t('common.months') }}</span>
            </template>
          </Column>

          <Column field="createdAt" :header="t('dashboard.date')" sortable style="width: 110px">
            <template #body="{ data }">
              <span class="font-mono muted">{{ formatDate(data.createdAt) }}</span>
            </template>
          </Column>

          <Column style="width: 56px">
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
.deals-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Filters bar ────────────────────────────────────────────────────────────*/
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

.search-wrap i {
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

.status-select {
  width: 180px;
  flex-shrink: 0;
}

/* ── Table card ─────────────────────────────────────────────────────────────*/
.table-card {
  padding: 0;
  overflow: hidden;
}
@media (max-width: 600px) { .table-card { overflow-x: auto; } }

:deep(.deals-table) {
  font-size: 0.875rem;
}

:deep(.deals-table .p-datatable-thead > tr > th) {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.7rem 1rem;
}

:deep(.deals-table .p-datatable-tbody > tr) {
  cursor: pointer;
  transition: background 0.12s ease;
}

:deep(.deals-table .p-datatable-tbody > tr:hover) {
  background: var(--bg-surface) !important;
}

:deep(.deals-table .p-datatable-tbody > tr > td) {
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

:deep(.deals-table .p-paginator) {
  padding: 0.8rem 1rem;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}

/* ── Cell styles ────────────────────────────────────────────────────────────*/
.deal-id {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--accent-2);
}

.client-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.client-name {
  font-weight: 700;
}

.client-phone {
  font-size: 0.78rem;
}

.muted {
  color: var(--text-secondary);
}

.tariff-chip {
  display: inline-block;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 0.2rem 0.55rem;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
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

/* ── Error state ────────────────────────────────────────────────────────────*/
.error-state {
  padding: 3rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

.error-state i {
  font-size: 2.2rem;
  color: var(--danger);
}

.error-state p {
  margin: 0;
  font-weight: 600;
  color: var(--text-secondary);
}
</style>
