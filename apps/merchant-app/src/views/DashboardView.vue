<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import { useAuthStore } from '@/stores/auth'
import { useDealsStore } from '@/stores/deals'
import StatusBadge from '@/components/StatusBadge.vue'
import MonoAmount from '@/components/MonoAmount.vue'
import { formatDate } from '@/utils/money'
import type { Deal, DealStatus } from '@/types'

const auth = useAuthStore()
const deals = useDealsStore()
const router = useRouter()

const statusFilter = ref<DealStatus | null>(null)
const statusOptions: { label: string; value: DealStatus | null }[] = [
  { label: 'All statuses', value: null },
  { label: 'Draft', value: 'draft' },
  { label: 'Scoring', value: 'scoring' },
  { label: 'Approved', value: 'approved' },
  { label: 'Declined', value: 'declined' },
  { label: 'Active', value: 'active' },
  { label: 'Closed', value: 'closed' },
  { label: 'Overdue', value: 'overdue' },
]

const visibleDeals = computed<Deal[]>(() => {
  const base = auth.isAdmin
    ? deals.deals
    : deals.forAgent(auth.employee?.id ?? '')
  return statusFilter.value
    ? base.filter((d) => d.status === statusFilter.value)
    : base
})

const stats = computed(() => {
  const scope = auth.isAdmin
    ? deals.deals
    : deals.forAgent(auth.employee?.id ?? '')
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
    <div class="dash-head">
      <div>
        <h2 class="hello">Hello, {{ auth.employee?.fullName.split(' ')[0] }} 👋</h2>
        <p class="hello-sub">
          {{ auth.isAdmin ? 'Full tenant overview' : 'Your deals overview' }}
        </p>
      </div>
      <button v-if="auth.isAgent" class="btn-gradient" @click="router.push('/wizard')">
        <i class="pi pi-plus" /> New Deal
      </button>
    </div>

    <div class="stats">
      <div class="stat-card surface-card">
        <span class="stat-label">Total deals</span>
        <span class="stat-value font-mono">{{ stats.total }}</span>
        <i class="pi pi-briefcase stat-icon" />
      </div>
      <div class="stat-card surface-card">
        <span class="stat-label">Active deals</span>
        <span class="stat-value font-mono" style="color: var(--success)">{{ stats.active }}</span>
        <i class="pi pi-bolt stat-icon" />
      </div>
      <div class="stat-card surface-card">
        <span class="stat-label">Disbursed</span>
        <MonoAmount :value="stats.disbursed" size="lg" />
        <i class="pi pi-wallet stat-icon" />
      </div>
      <div class="stat-card surface-card">
        <span class="stat-label">Overdue</span>
        <span class="stat-value font-mono" style="color: var(--danger)">{{ stats.overdue }}</span>
        <i class="pi pi-exclamation-triangle stat-icon" />
      </div>
    </div>

    <div class="table-card surface-card">
      <div class="table-head">
        <h3>Deals</h3>
        <Select
          v-model="statusFilter"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          placeholder="Filter status"
          class="filter-select"
        />
      </div>

      <DataTable
        :value="visibleDeals"
        paginator
        :rows="8"
        data-key="id"
        class="deals-table"
        :pt="{ table: { style: 'min-width: 60rem' } }"
      >
        <Column field="clientName" header="Client" sortable>
          <template #body="{ data }">
            <div class="client-cell">
              <div class="client-avatar">{{ data.clientName.charAt(0) }}</div>
              <div>
                <div class="client-name">{{ data.clientName }}</div>
                <div class="client-pinfl font-mono">{{ data.clientPinfl }}</div>
              </div>
            </div>
          </template>
        </Column>
        <Column header="Deal ID">
          <template #body="{ data }">
            <span class="font-mono deal-id">{{ data.id }}</span>
          </template>
        </Column>
        <Column field="status" header="Status" sortable>
          <template #body="{ data }">
            <StatusBadge :status="data.status" />
          </template>
        </Column>
        <Column field="tariffName" header="Tariff" sortable>
          <template #body="{ data }">
            <span class="tariff-pill">{{ data.tariffName }}</span>
          </template>
        </Column>
        <Column header="Amount">
          <template #body="{ data }">
            <MonoAmount :value="data.amount" size="sm" />
          </template>
        </Column>
        <Column header="Date">
          <template #body="{ data }">
            <span class="font-mono date-cell">{{ formatDate(data.createdAt) }}</span>
          </template>
        </Column>
        <Column header="" :style="{ width: '6rem' }">
          <template #body="{ data }">
            <button class="open-btn" @click="openDeal(data.id)">Open</button>
          </template>
        </Column>
        <template #empty>
          <div class="empty">No deals match this filter.</div>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.dash {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}
.dash-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.hello {
  font-size: 1.4rem;
  font-weight: 800;
  margin: 0;
}
.hello-sub {
  color: var(--text-secondary);
  margin: 0.2rem 0 0;
  font-size: 0.88rem;
}
.btn-gradient {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.1rem;
}
.stat-card {
  padding: 1.3rem;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.stat-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.stat-value {
  font-size: 1.8rem;
  font-weight: 800;
}
.stat-icon {
  position: absolute;
  right: 1rem;
  top: 1rem;
  font-size: 1.4rem;
  color: var(--accent-2);
  opacity: 0.25;
}
.table-card {
  padding: 1.4rem;
}
.table-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.1rem;
}
.table-head h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
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
</style>
