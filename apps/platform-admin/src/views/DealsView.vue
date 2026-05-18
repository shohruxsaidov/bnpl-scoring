<script setup lang="ts">
import { computed, ref } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import { useDealsStore } from '@/stores/deals'
import { useTenantsStore } from '@/stores/tenants'
import StatusBadge from '@/components/StatusBadge.vue'
import MonoAmount from '@/components/MonoAmount.vue'
import { formatDate, formatSom } from '@/utils/money'
import type { Deal, DealStatus } from '@/types'

const deals = useDealsStore()
const tenants = useTenantsStore()

const statusFilter = ref<DealStatus | null>(null)
const tenantFilter = ref<string | null>(null)

const statusOptions: { label: string; value: DealStatus | null }[] = [
  { label: 'All statuses', value: null },
  { label: 'Active', value: 'active' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Closed', value: 'closed' },
  { label: 'Declined', value: 'declined' },
  { label: 'Scoring', value: 'scoring' },
]

const tenantOptions = computed(() => [
  { label: 'All tenants', value: null },
  ...tenants.options,
])

const filtered = computed<Deal[]>(() =>
  deals.deals.filter(
    (d) =>
      (!statusFilter.value || d.status === statusFilter.value) &&
      (!tenantFilter.value || d.tenantId === tenantFilter.value),
  ),
)

function tenantName(id: string): string {
  return tenants.byId(id)?.name ?? '—'
}

const selected = ref<Deal | null>(null)
const decisionLabel: Record<string, string> = {
  approved: 'Approved',
  declined: 'Declined',
  partial: 'Partial limit',
  manual_review: 'Manual review',
}

function openDeal(d: Deal) {
  selected.value = d
}
function closePanel() {
  selected.value = null
}
</script>

<template>
  <div class="deals">
    <div class="filters surface-card">
      <div class="filter">
        <span class="filter-label">Status</span>
        <Select
          v-model="statusFilter"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          placeholder="All statuses"
        />
      </div>
      <div class="filter">
        <span class="filter-label">Tenant</span>
        <Select
          v-model="tenantFilter"
          :options="tenantOptions"
          option-label="label"
          option-value="value"
          placeholder="All tenants"
        />
      </div>
      <span class="result-count muted">{{ filtered.length }} deals</span>
    </div>

    <div class="surface-card table-wrap">
      <DataTable
        :value="filtered"
        data-key="id"
        paginator
        :rows="10"
        size="small"
        selection-mode="single"
        :selection="selected"
        @row-click="openDeal($event.data as Deal)"
      >
        <Column header="Deal ID">
          <template #body="{ data }">
            <span class="font-mono accent">{{ data.id }}</span>
          </template>
        </Column>
        <Column header="Tenant">
          <template #body="{ data }">{{ tenantName(data.tenantId) }}</template>
        </Column>
        <Column header="Client">
          <template #body="{ data }">{{ data.clientName }}</template>
        </Column>
        <Column header="Amount">
          <template #body="{ data }">
            <MonoAmount :value="data.amount" size="sm" />
          </template>
        </Column>
        <Column header="Status">
          <template #body="{ data }">
            <StatusBadge :status="data.status" />
          </template>
        </Column>
        <Column header="Score">
          <template #body="{ data }">
            <span class="font-mono">{{ data.score || '—' }}</span>
          </template>
        </Column>
        <Column header="Decision">
          <template #body="{ data }">
            <span class="muted">{{ decisionLabel[data.decision] }}</span>
          </template>
        </Column>
        <Column header="Agent">
          <template #body="{ data }">{{ data.agentName }}</template>
        </Column>
        <Column header="Date">
          <template #body="{ data }">
            <span class="font-mono muted">{{ formatDate(data.createdAt) }}</span>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Slide-over panel -->
    <transition name="slide">
      <div v-if="selected" class="slideover">
        <header class="so-head">
          <div>
            <span class="font-mono accent so-id">{{ selected.id }}</span>
            <StatusBadge :status="selected.status" />
          </div>
          <button class="so-close" @click="closePanel">
            <i class="pi pi-times" />
          </button>
        </header>

        <div class="so-body">
          <div class="so-section">
            <h4>Client</h4>
            <div class="kv">
              <span>Name</span><span>{{ selected.clientName }}</span>
            </div>
            <div class="kv">
              <span>PINFL</span><span class="font-mono">{{ selected.clientPinfl }}</span>
            </div>
            <div class="kv">
              <span>Phone</span><span class="font-mono">{{ selected.clientPhone }}</span>
            </div>
            <div class="kv">
              <span>Tenant</span><span>{{ tenantName(selected.tenantId) }}</span>
            </div>
            <div class="kv">
              <span>Agent</span><span>{{ selected.agentName }}</span>
            </div>
          </div>

          <div class="so-section">
            <h4>Tariff</h4>
            <div class="kv">
              <span>Plan</span><span>{{ selected.tariffName }}</span>
            </div>
            <div class="kv">
              <span>Principal</span>
              <span><MonoAmount :value="selected.amount" size="sm" /></span>
            </div>
            <div class="kv">
              <span>Total payable</span>
              <span><MonoAmount :value="selected.totalPayable" size="sm" /></span>
            </div>
          </div>

          <div class="so-section">
            <h4>Basket</h4>
            <div v-for="(b, i) in selected.basket" :key="i" class="basket-row">
              <span class="b-name">{{ b.name }}</span>
              <span class="b-qty font-mono">×{{ b.quantity }}</span>
              <span class="b-price font-mono">{{ formatSom(b.price) }}</span>
            </div>
          </div>

          <div v-if="selected.factors.length" class="so-section">
            <h4>Score breakdown · {{ selected.score }}</h4>
            <div v-for="(f, i) in selected.factors" :key="i" class="factor-row">
              <span class="f-label">{{ f.label }}</span>
              <span
                class="f-weight font-mono"
                :style="{ color: f.weight >= 0 ? 'var(--success)' : 'var(--danger)' }"
              >
                {{ f.weight >= 0 ? '+' : '' }}{{ f.weight.toFixed(2) }}
              </span>
              <span class="f-value font-mono">{{ f.value }}</span>
            </div>
          </div>

          <div class="so-section">
            <h4>Schedule preview</h4>
            <div v-for="row in selected.schedule.slice(0, 3)" :key="row.index" class="sch-row">
              <span class="font-mono muted">#{{ row.index }}</span>
              <span class="font-mono">{{ formatDate(row.date) }}</span>
              <span class="font-mono sch-amt">{{ formatSom(row.amount) }}</span>
            </div>
            <span class="muted sch-more">
              + {{ Math.max(0, selected.schedule.length - 3) }} more payments
            </span>
          </div>

          <button class="btn-ghost full">
            Open full detail <i class="pi pi-external-link" />
          </button>
        </div>
      </div>
    </transition>
    <transition name="fade">
      <div v-if="selected" class="so-backdrop" @click="closePanel" />
    </transition>
  </div>
</template>

<style scoped>
.deals {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.filters {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  padding: 0.9rem 1.1rem;
}
.filter {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 220px;
}
.filter-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}
.result-count {
  margin-left: auto;
  font-size: 0.82rem;
  font-weight: 600;
  padding-bottom: 0.5rem;
}
.table-wrap {
  padding: 0;
  overflow: hidden;
}
.accent {
  color: var(--accent-2);
  font-weight: 700;
}

.slideover {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: var(--bg-base);
  border-left: 1px solid var(--border-subtle);
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.25);
  z-index: 60;
  display: flex;
  flex-direction: column;
}
.so-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem;
  border-bottom: 1px solid var(--border-subtle);
}
.so-head > div {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.so-id {
  font-size: 0.95rem;
}
.so-close {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
}
.so-close:hover {
  color: var(--danger);
  border-color: var(--danger);
}
.so-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}
.so-section h4 {
  margin: 0 0 0.6rem;
  font-size: 0.74rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}
.kv {
  display: flex;
  justify-content: space-between;
  padding: 0.32rem 0;
  font-size: 0.84rem;
}
.kv > span:first-child {
  color: var(--text-secondary);
}
.kv > span:last-child {
  font-weight: 600;
}
.basket-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0;
  font-size: 0.82rem;
  border-bottom: 1px solid var(--border-subtle);
}
.basket-row:last-child {
  border-bottom: none;
}
.b-name {
  flex: 1;
  font-weight: 600;
}
.b-qty {
  color: var(--text-secondary);
}
.b-price {
  font-size: 0.78rem;
}
.factor-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.32rem 0;
  font-size: 0.82rem;
}
.f-label {
  flex: 1;
  color: var(--text-secondary);
}
.f-weight {
  width: 52px;
  text-align: right;
  font-weight: 700;
}
.f-value {
  width: 70px;
  text-align: right;
  font-weight: 600;
}
.sch-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.32rem 0;
  font-size: 0.82rem;
}
.sch-amt {
  margin-left: auto;
  font-weight: 600;
}
.sch-more {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.76rem;
}
.btn-ghost.full {
  width: 100%;
  justify-content: center;
  margin-top: 0.4rem;
}
.so-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 20, 0.4);
  z-index: 55;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
