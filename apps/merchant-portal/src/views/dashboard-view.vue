<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import { useAuthStore } from '@/stores/auth'
import { useDealsQuery } from '@/composables/use-deals-api'
import type { DealListItem } from '@/composables/use-deals-api'
import StatusBadge from '@/components/status-badge.vue'
import MonoAmount from '@/components/mono-amount.vue'
import { formatDate } from '@/utils/money'
import SkeletonStatCards from '@/components/skeleton-stat-cards.vue'
import SkeletonTable from '@/components/skeleton-table.vue'
import type { DealStatus } from '@/types'

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()

const { data: dealsData, isLoading, isError } = useDealsQuery()

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

const allDeals = computed<DealListItem[]>(() => dealsData.value ?? [])

const visibleDeals = computed<DealListItem[]>(() => {
  return allDeals.value.filter((d) => {
    if (statusFilter.value && d.status !== statusFilter.value) return false
    if (search.value.trim()) {
      const q = search.value.toLowerCase()
      return (d.clientName ?? '').toLowerCase().includes(q) || d.id.toLowerCase().includes(q)
    }
    return true
  })
})

const stats = computed(() => {
  const scope = allDeals.value
  return {
    total: scope.length,
    active: scope.filter((d) => d.status === 'active').length,
    disbursed: scope
      .filter((d) => ['active', 'closed', 'overdue'].includes(d.status))
      .reduce((s, d) => s + d.amount, 0),
    overdue: scope.filter((d) => d.status === 'overdue').length,
  }
})

function openDeal(id: string) {
  router.push(`/deals/${id}`)
}
</script>

<template>
  <div class="dash">
    <template v-if="isLoading">
      <SkeletonStatCards :count="4" />
      <SkeletonTable :rows="8" :cols="5" :has-actions="false" :has-header="true" />
    </template>

    <template v-else-if="isError">
      <div class="error-state surface-card">
        <i class="pi pi-exclamation-circle" />
        <span>{{ $t('dashboard.loadError') }}</span>
      </div>
    </template>

    <template v-else>
      <div v-if="auth.isAgent" class="page-actions">
        <button class="btn-gradient" @click="router.push('/deals/create')">
          <i class="pi pi-plus" /> {{ $t('dashboard.newDeal') }}
        </button>
      </div>

      <div class="kpi-strip">
        <div class="kpi-card surface-card">
          <div class="kpi-row">
            <div class="kpi-icon-wrap" style="background: var(--gradient-hero)"><i class="pi pi-briefcase" /></div>
            <div class="kpi-delta neutral"><i class="pi pi-minus" /> all time</div>
          </div>
          <span class="kpi-label">{{ $t('dashboard.totalDeals') }}</span>
          <span class="kpi-value font-mono">{{ stats.total }}</span>
        </div>
        <div class="kpi-card surface-card">
          <div class="kpi-row">
            <div class="kpi-icon-wrap" style="background: linear-gradient(135deg,#00c49a,#00d4aa)"><i class="pi pi-bolt" /></div>
            <div class="kpi-delta up"><i class="pi pi-arrow-up" /> live</div>
          </div>
          <span class="kpi-label">{{ $t('dashboard.activeDeals') }}</span>
          <span class="kpi-value font-mono" style="background: linear-gradient(135deg,#00c49a,#00d4aa); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent;">{{ stats.active }}</span>
        </div>
        <div class="kpi-card surface-card">
          <div class="kpi-row">
            <div class="kpi-icon-wrap" style="background: linear-gradient(135deg,#7b68ee,#9d4edd)"><i class="pi pi-wallet" /></div>
            <div class="kpi-delta up"><i class="pi pi-arrow-up" /></div>
          </div>
          <span class="kpi-label">{{ $t('dashboard.disbursed') }}</span>
          <MonoAmount :value="stats.disbursed" size="lg" />
        </div>
        <div class="kpi-card surface-card">
          <div class="kpi-row">
            <div class="kpi-icon-wrap" style="background: linear-gradient(135deg,#ff5c5c,#ff8c42)"><i class="pi pi-exclamation-triangle" /></div>
            <div v-if="stats.overdue > 0" class="kpi-delta down"><i class="pi pi-arrow-up" /> needs attention</div>
            <div v-else class="kpi-delta neutral"><i class="pi pi-check" /> clear</div>
          </div>
          <span class="kpi-label">{{ $t('dashboard.overdue') }}</span>
          <span class="kpi-value font-mono" :style="{ background: stats.overdue > 0 ? 'linear-gradient(135deg,#ff5c5c,#ff8c42)' : 'var(--gradient-hero)', '-webkit-background-clip': 'text', 'background-clip': 'text', color: 'transparent', '-webkit-text-fill-color': 'transparent' }">{{ stats.overdue }}</span>
        </div>
      </div>

      <div class="table-card surface-card">
        <div class="table-toolbar">
          <div class="tt-search">
            <i class="pi pi-search tt-icon" />
            <input v-model="search" class="tt-input" :placeholder="$t('dashboard.searchDeals')" type="text" />
          </div>
          <Select
            v-model="statusFilter"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            :placeholder="$t('dashboard.filterStatus')"
            class="filter-select"
          />
          <span class="tt-count">{{ visibleDeals.length }} {{ $t('dashboard.deals') }}</span>
        </div>

        <DataTable
          :value="visibleDeals"
          paginator
          :rows="8"
          data-key="id"
          class="deals-table"
          :pt="{ table: { style: 'min-width: 60rem' } }"
        >
          <Column field="clientName" :header="$t('dashboard.client')" sortable>
            <template #body="{ data }">
              <div class="client-cell">
                <div class="client-avatar">{{ (data.clientName ?? '?').charAt(0) }}</div>
                <div>
                  <div class="client-name">{{ data.clientName ?? '—' }}</div>
                  <div class="client-pinfl font-mono">{{ data.clientPinfl ?? '—' }}</div>
                </div>
              </div>
            </template>
          </Column>
          <Column :header="$t('dashboard.dealId')">
            <template #body="{ data }">
              <span class="font-mono deal-id">{{ data.id }}</span>
            </template>
          </Column>
          <Column field="status" :header="$t('dashboard.status')" sortable>
            <template #body="{ data }">
              <StatusBadge :status="data.status" />
            </template>
          </Column>
          <Column field="tariffName" :header="$t('dashboard.tariff')" sortable>
            <template #body="{ data }">
              <span class="tariff-pill">{{ data.tariffName ?? '—' }}</span>
            </template>
          </Column>
          <Column field="amount" :header="$t('dashboard.amount')" sortable>
            <template #body="{ data }">
              <MonoAmount :value="data.amount" size="sm" />
            </template>
          </Column>
          <Column field="createdAt" :header="$t('dashboard.date')" sortable>
            <template #body="{ data }">
              <span class="font-mono date-cell">{{ formatDate(data.createdAt) }}</span>
            </template>
          </Column>
          <Column header="" :style="{ width: '6rem' }">
            <template #body="{ data }">
              <button class="open-btn" @click="openDeal(data.id)">{{ $t('dashboard.open') }}</button>
            </template>
          </Column>
          <template #empty>
            <div class="empty">{{ $t('dashboard.noDeals') }}</div>
          </template>
        </DataTable>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dash {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}
.page-actions {
  display: flex;
  justify-content: flex-end;
}
.btn-gradient {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.1rem;
}
.kpi-card {
  padding: 1.1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.kpi-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.15rem;
}
.kpi-icon-wrap {
  width: 38px; height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 0.95rem;
  flex-shrink: 0;
}
.kpi-delta {
  font-size: 0.72rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}
.kpi-delta.up { color: var(--success); }
.kpi-delta.down { color: var(--danger); }
.kpi-delta.neutral { color: var(--text-secondary); }
.kpi-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}
.kpi-value {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.1;
  background: var(--gradient-hero);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

@media (max-width: 900px) {
  .kpi-strip { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .kpi-strip { grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .table-toolbar { flex-wrap: wrap; }
  .filter-select { min-width: unset; width: 100%; }
}

.table-card {
  padding: 0;
  overflow: hidden;
}
@media (max-width: 600px) { .table-card { overflow-x: auto; } }
.table-toolbar {
  border-bottom: 1px solid var(--border-subtle);
  padding: 0.75rem 1rem;
}
.filter-select {
  min-width: 200px;
}
.client-cell {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.client-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--gradient-accent);
  color: #fff;
  font-weight: 700;
  display: grid;
  place-items: center;
  font-size: 0.85rem;
}
.client-name {
  font-weight: 700;
  font-size: 0.88rem;
}
.client-pinfl {
  font-size: 0.72rem;
  color: var(--text-secondary);
}
.deal-id {
  font-weight: 700;
  color: var(--accent-2);
  font-size: 0.84rem;
}
.tariff-pill {
  background: var(--bg-surface);
  padding: 0.25rem 0.6rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
}
.date-cell {
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.open-btn {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--accent-2);
  font-weight: 700;
  font-size: 0.8rem;
  padding: 0.35rem 0.9rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.open-btn:hover {
  background: var(--gradient-hero);
  color: #fff;
  border-color: transparent;
}
.empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}
.error-state {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  color: var(--danger);
  font-weight: 600;
  border-radius: 12px;
}
.error-state i {
  font-size: 1.25rem;
}
</style>
