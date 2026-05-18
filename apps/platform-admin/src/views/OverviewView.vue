<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useTenantsStore } from '@/stores/tenants'
import { useDealsStore } from '@/stores/deals'
import StatusBadge from '@/components/StatusBadge.vue'
import MonoAmount from '@/components/MonoAmount.vue'
import { formatDate, formatSomCompact, maskPinfl } from '@/utils/money'
import type { IntegrationStatus } from '@/types'

const tenants = useTenantsStore()
const deals = useDealsStore()
const router = useRouter()

const recentDeals = computed(() => deals.recent(10))

const stats = computed(() => [
  { label: 'Total Tenants', value: String(tenants.total), icon: 'pi pi-building', tone: '' },
  {
    label: 'Active Tenants',
    value: String(tenants.activeCount),
    icon: 'pi pi-check-circle',
    tone: 'var(--success)',
  },
  { label: 'Total Deals', value: '847', icon: 'pi pi-credit-card', tone: '' },
  {
    label: 'Overdue Deals',
    value: '23',
    icon: 'pi pi-exclamation-triangle',
    tone: 'var(--danger)',
  },
  {
    label: 'Platform Volume',
    value: formatSomCompact(8_420_000_000_00),
    icon: 'pi pi-chart-line',
    tone: '',
    suffix: "so'm",
  },
])

const tenantHealth = computed(() =>
  [...tenants.tenants].sort((a, b) => b.dealCount - a.dealCount).slice(0, 12),
)

const integrations: IntegrationStatus[] = [
  { key: 'katm', label: 'KATM', health: 'operational', detail: 'Bureau queries OK' },
  { key: 'myid', label: 'MyID', health: 'operational', detail: 'Identity OK' },
  {
    key: 'plumgate',
    label: 'PlumGate',
    health: 'degraded',
    detail: 'High latency 2.8s',
  },
  { key: 'payme', label: 'Payme', health: 'operational', detail: 'Payments OK' },
  { key: 'click', label: 'Click', health: 'operational', detail: 'Payments OK' },
]

function tenantName(id: string): string {
  return tenants.byId(id)?.name ?? '—'
}

function openTenant(id: string) {
  router.push(`/tenants/${id}`)
}
</script>

<template>
  <div class="overview">
    <div class="stat-row">
      <div v-for="s in stats" :key="s.label" class="stat-card surface-card">
        <div class="stat-top">
          <span class="stat-label">{{ s.label }}</span>
          <i :class="s.icon" class="stat-icon" />
        </div>
        <span class="stat-value font-mono" :style="{ color: s.tone || 'var(--text-primary)' }">
          {{ s.value }}<span v-if="s.suffix" class="stat-suffix"> {{ s.suffix }}</span>
        </span>
      </div>
    </div>

    <div class="grid">
      <section class="surface-card panel">
        <header class="panel-head">
          <h3 class="section-title">Recent Deals</h3>
          <button class="btn-ghost sm" @click="router.push('/deals')">
            View all <i class="pi pi-arrow-right" />
          </button>
        </header>
        <DataTable :value="recentDeals" data-key="id" :rows="10" size="small">
          <Column header="Deal ID">
            <template #body="{ data }">
              <span class="font-mono accent">{{ data.id }}</span>
            </template>
          </Column>
          <Column header="Tenant">
            <template #body="{ data }">{{ tenantName(data.tenantId) }}</template>
          </Column>
          <Column header="Client PINFL">
            <template #body="{ data }">
              <span class="font-mono muted">{{ maskPinfl(data.clientPinfl) }}</span>
            </template>
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
          <Column header="Date">
            <template #body="{ data }">
              <span class="font-mono muted">{{ formatDate(data.createdAt) }}</span>
            </template>
          </Column>
        </DataTable>
      </section>

      <section class="surface-card panel">
        <header class="panel-head">
          <h3 class="section-title">Tenant Health</h3>
        </header>
        <ul class="health-list">
          <li
            v-for="t in tenantHealth"
            :key="t.id"
            class="health-row"
            @click="openTenant(t.id)"
          >
            <span
              class="status-dot"
              :style="{
                background: t.status === 'active' ? 'var(--success)' : 'var(--danger)',
              }"
            />
            <span class="health-name">{{ t.name }}</span>
            <span class="health-meta font-mono">{{ t.dealCount }} deals</span>
            <span
              class="health-overdue font-mono"
              :class="{ zero: t.overdueCount === 0 }"
            >
              {{ t.overdueCount }} overdue
            </span>
          </li>
        </ul>
      </section>
    </div>

    <section class="surface-card integ">
      <header class="panel-head">
        <h3 class="section-title">Integration Status</h3>
      </header>
      <div class="integ-row">
        <div v-for="i in integrations" :key="i.key" class="integ-item">
          <span
            class="status-dot"
            :style="{
              background:
                i.health === 'operational' ? 'var(--success)' : 'var(--warning)',
            }"
          />
          <div class="integ-text">
            <span class="integ-label">{{ i.label }}</span>
            <span class="integ-state">
              {{ i.health === 'operational' ? 'Operational' : 'Degraded' }}
            </span>
          </div>
          <span class="integ-detail">{{ i.detail }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.85rem;
}
.stat-card {
  padding: 0.95rem 1.05rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.stat-label {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}
.stat-icon {
  font-size: 0.95rem;
  color: var(--accent-2);
  opacity: 0.7;
}
.stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
}
.stat-suffix {
  font-size: 0.6em;
  font-weight: 600;
  opacity: 0.65;
}

.grid {
  display: grid;
  grid-template-columns: 60fr 40fr;
  gap: 1rem;
  align-items: start;
}
.panel {
  padding: 0;
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid var(--border-subtle);
}
.btn-ghost.sm {
  padding: 0.35rem 0.65rem;
  font-size: 0.76rem;
}
.accent {
  color: var(--accent-2);
  font-weight: 700;
}

.health-list {
  list-style: none;
  margin: 0;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
}
.health-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.7rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s ease;
}
.health-row:hover {
  background: color-mix(in srgb, var(--accent-1) 6%, transparent);
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.health-name {
  flex: 1;
  font-size: 0.84rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.health-meta {
  font-size: 0.76rem;
  color: var(--text-secondary);
}
.health-overdue {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--danger);
  min-width: 84px;
  text-align: right;
}
.health-overdue.zero {
  color: var(--text-secondary);
}

.integ {
  padding: 0;
}
.integ-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
}
.integ-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem 1.1rem;
  border-right: 1px solid var(--border-subtle);
}
.integ-item:last-child {
  border-right: none;
}
.integ-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.integ-label {
  font-size: 0.85rem;
  font-weight: 700;
}
.integ-state {
  font-size: 0.7rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.integ-detail {
  margin-left: auto;
  font-size: 0.68rem;
  color: var(--text-secondary);
  text-align: right;
}
</style>
