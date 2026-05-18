<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useToast } from 'primevue/usetoast'
import { useTenantsStore } from '@/stores/tenants'
import { useDealsStore } from '@/stores/deals'
import { useEmployeesStore } from '@/stores/employees'
import StatusBadge from '@/components/StatusBadge.vue'
import MonoAmount from '@/components/MonoAmount.vue'
import { formatDate, formatDateTime, maskPinfl } from '@/utils/money'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const tenants = useTenantsStore()
const deals = useDealsStore()
const employees = useEmployeesStore()

const tenantId = computed(() => route.params.id as string)
const tenant = computed(() => tenants.byId(tenantId.value))

const tabs = ['Overview', 'Deals', 'Employees', 'Scoring Model', 'Settings'] as const
type Tab = (typeof tabs)[number]
const activeTab = ref<Tab>('Overview')

const tenantDeals = computed(() => deals.forTenant(tenantId.value))
const tenantEmployees = computed(() => employees.forTenant(tenantId.value))
const model = computed(() => tenants.modelFor(tenantId.value))
const tariffs = computed(() => tenants.tariffsFor(tenantId.value))

const modelJson = computed(() => JSON.stringify(model.value, null, 2))

const statusBreakdown = computed(() => {
  const base = { active: 0, overdue: 0, closed: 0, declined: 0, scoring: 0 }
  for (const d of tenantDeals.value) base[d.status]++
  const max = Math.max(1, ...Object.values(base))
  return [
    { label: 'Active', count: base.active, color: 'var(--success)', max },
    { label: 'Overdue', count: base.overdue, color: 'var(--danger)', max },
    { label: 'Closed', count: base.closed, color: 'var(--text-secondary)', max },
    { label: 'Declined', count: base.declined, color: 'var(--warning)', max },
    { label: 'Scoring', count: base.scoring, color: 'var(--accent-1)', max },
  ]
})

const overviewStats = computed(() => {
  const t = tenant.value
  if (!t) return []
  const overdueRate = t.dealCount > 0 ? ((t.overdueCount / t.dealCount) * 100).toFixed(1) : '0.0'
  return [
    { label: 'Total deals', value: String(t.dealCount), suffix: '' },
    { label: 'Active employees', value: String(employees.activeForTenant(t.id)), suffix: '' },
    { label: 'Overdue rate', value: overdueRate, suffix: '%' },
  ]
})

function toggleStatus() {
  if (!tenant.value) return
  const was = tenant.value.status
  tenants.toggleStatus(tenant.value.id)
  toast.add({
    severity: was === 'active' ? 'warn' : 'success',
    summary: was === 'active' ? 'Tenant suspended' : 'Tenant activated',
    detail: tenant.value.name,
    life: 2000,
  })
}
</script>

<template>
  <div v-if="tenant" class="detail">
    <button class="back" @click="router.push('/tenants')">
      <i class="pi pi-arrow-left" /> Back to tenants
    </button>

    <header class="t-header surface-card">
      <div class="t-id">
        <div class="t-avatar">{{ tenant.name.charAt(0) }}</div>
        <div>
          <h2 class="t-name">{{ tenant.name }}</h2>
          <span class="t-slug font-mono">{{ tenant.slug }} · {{ tenant.contactEmail }}</span>
        </div>
        <span
          class="t-status"
          :style="{
            color: tenant.status === 'active' ? 'var(--success)' : 'var(--danger)',
            background:
              tenant.status === 'active' ? 'var(--success-bg)' : 'var(--danger-bg)',
          }"
        >
          {{ tenant.status === 'active' ? 'Active' : 'Suspended' }}
        </span>
      </div>
      <button
        :class="tenant.status === 'active' ? 'btn-ghost' : 'btn-gradient'"
        @click="toggleStatus"
      >
        <i :class="tenant.status === 'active' ? 'pi pi-ban' : 'pi pi-check'" />
        {{ tenant.status === 'active' ? 'Suspend' : 'Activate' }}
      </button>
    </header>

    <nav class="tabs">
      <button
        v-for="t in tabs"
        :key="t"
        class="tab"
        :class="{ active: activeTab === t }"
        @click="activeTab = t"
      >
        {{ t }}
      </button>
    </nav>

    <!-- Overview -->
    <section v-if="activeTab === 'Overview'" class="tab-body">
      <div class="ov-stats">
        <div class="ov-card surface-card">
          <span class="ov-label">Volume</span>
          <MonoAmount :value="tenant.volume" size="lg" gradient />
        </div>
        <div v-for="s in overviewStats" :key="s.label" class="ov-card surface-card">
          <span class="ov-label">{{ s.label }}</span>
          <span class="ov-value font-mono">{{ s.value }}{{ s.suffix }}</span>
        </div>
      </div>

      <div class="surface-card chart-card">
        <h3 class="section-title">Deals by status</h3>
        <div class="bars">
          <div v-for="b in statusBreakdown" :key="b.label" class="bar-row">
            <span class="bar-label">{{ b.label }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{
                  width: (b.count / b.max) * 100 + '%',
                  background: b.color,
                }"
              />
            </div>
            <span class="bar-count font-mono">{{ b.count }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Deals -->
    <section v-else-if="activeTab === 'Deals'" class="tab-body">
      <div class="surface-card table-wrap">
        <DataTable :value="tenantDeals" data-key="id" paginator :rows="10" size="small">
          <Column header="Deal ID">
            <template #body="{ data }">
              <span class="font-mono accent">{{ data.id }}</span>
            </template>
          </Column>
          <Column header="Client">
            <template #body="{ data }">{{ data.clientName }}</template>
          </Column>
          <Column header="PINFL">
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
          <Column header="Score">
            <template #body="{ data }">
              <span class="font-mono">{{ data.score || '—' }}</span>
            </template>
          </Column>
          <Column header="Date">
            <template #body="{ data }">
              <span class="font-mono muted">{{ formatDate(data.createdAt) }}</span>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Employees -->
    <section v-else-if="activeTab === 'Employees'" class="tab-body">
      <div class="surface-card table-wrap">
        <DataTable :value="tenantEmployees" data-key="id" size="small">
          <Column header="Name">
            <template #body="{ data }">
              <span class="t-name-sm">{{ data.fullName }}</span>
            </template>
          </Column>
          <Column header="Phone">
            <template #body="{ data }">
              <span class="font-mono muted">{{ data.phone }}</span>
            </template>
          </Column>
          <Column header="Roles">
            <template #body="{ data }">
              <span v-for="r in data.roles" :key="r" class="chip">
                {{ r === 'merchant_admin' ? 'Admin' : 'Agent' }}
              </span>
            </template>
          </Column>
          <Column header="Active">
            <template #body="{ data }">
              <span class="dot-state" :class="{ on: data.active }">
                {{ data.active ? 'Yes' : 'No' }}
              </span>
            </template>
          </Column>
          <Column header="Last login">
            <template #body="{ data }">
              <span class="font-mono muted">{{ formatDateTime(data.lastLogin) }}</span>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Scoring Model -->
    <section v-else-if="activeTab === 'Scoring Model'" class="tab-body">
      <div class="surface-card json-card">
        <div class="json-head">
          <h3 class="section-title">Scoring model · {{ model.version }}</h3>
          <span class="muted json-meta font-mono">
            updated {{ formatDate(model.updatedAt) }}
          </span>
        </div>
        <pre class="json-block">{{ modelJson }}</pre>
      </div>
    </section>

    <!-- Settings -->
    <section v-else class="tab-body">
      <div class="surface-card table-wrap">
        <div class="settings-head">
          <h3 class="section-title">Tariffs</h3>
          <span class="muted">Read-only in platform admin</span>
        </div>
        <DataTable :value="tariffs" data-key="id" size="small">
          <Column header="Name">
            <template #body="{ data }">
              <span class="t-name-sm">{{ data.name }}</span>
            </template>
          </Column>
          <Column header="Term">
            <template #body="{ data }">
              <span class="font-mono">{{ data.termMonths }} mo</span>
            </template>
          </Column>
          <Column header="Markup">
            <template #body="{ data }">
              <span class="font-mono">{{ data.markupPercent }}%</span>
            </template>
          </Column>
          <Column header="Credit min">
            <template #body="{ data }">
              <MonoAmount :value="data.creditMin" size="sm" />
            </template>
          </Column>
          <Column header="Credit max">
            <template #body="{ data }">
              <MonoAmount :value="data.creditMax" size="sm" />
            </template>
          </Column>
          <Column header="Active">
            <template #body="{ data }">
              <span class="dot-state" :class="{ on: data.active }">
                {{ data.active ? 'Yes' : 'No' }}
              </span>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>
  </div>

  <div v-else class="not-found surface-card">
    <i class="pi pi-exclamation-circle" />
    <p>Tenant not found.</p>
    <button class="btn-ghost" @click="router.push('/tenants')">Back to tenants</button>
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.back {
  align-self: flex-start;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: inherit;
}
.back:hover {
  color: var(--accent-2);
}
.t-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem;
}
.t-id {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}
.t-avatar {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  background: var(--gradient-hero);
  color: #fff;
  font-weight: 800;
  display: grid;
  place-items: center;
  font-size: 1.05rem;
}
.t-name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
}
.t-slug {
  font-size: 0.76rem;
  color: var(--text-secondary);
}
.t-status {
  margin-left: 0.5rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
}

.tabs {
  display: flex;
  gap: 0.3rem;
  border-bottom: 1px solid var(--border-subtle);
}
.tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.6rem 0.9rem;
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.12s ease;
}
.tab:hover {
  color: var(--text-primary);
}
.tab.active {
  color: var(--accent-2);
  border-bottom-color: var(--accent-2);
}

.tab-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.ov-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.85rem;
}
.ov-card {
  padding: 0.95rem 1.05rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.ov-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}
.ov-value {
  font-size: 1.5rem;
  font-weight: 800;
}

.chart-card {
  padding: 1.1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.bars {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}
.bar-label {
  width: 70px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}
.bar-track {
  flex: 1;
  height: 12px;
  background: var(--bg-surface);
  border-radius: 6px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.3s ease;
  min-width: 2px;
}
.bar-count {
  width: 36px;
  text-align: right;
  font-size: 0.82rem;
  font-weight: 700;
}

.table-wrap {
  padding: 0;
  overflow: hidden;
}
.accent {
  color: var(--accent-2);
  font-weight: 700;
}
.t-name-sm {
  font-weight: 700;
  font-size: 0.85rem;
}
.chip {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 12%, transparent);
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  margin-right: 0.3rem;
}
.dot-state {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-secondary);
}
.dot-state.on {
  color: var(--success);
}

.json-card {
  padding: 1.1rem 1.2rem;
}
.json-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.8rem;
}
.json-meta {
  font-size: 0.74rem;
}
.json-block {
  margin: 0;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 1rem 1.2rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--text-primary);
  overflow-x: auto;
}

.settings-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  padding: 3rem;
  text-align: center;
}
.not-found i {
  font-size: 2rem;
  color: var(--danger);
}
</style>
