<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import { useAuthStore } from '@/stores/auth'
import SessionStatusBadge from '@/components/session-status-badge.vue'
import MonoAmount from '@/components/mono-amount.vue'
import SkeletonTable from '@/components/skeleton-table.vue'
import { formatDate } from '@/utils/money'
import {
  SESSION_STATUSES,
  useDealSessionsQuery,
  type DealSessionListItem,
  type DealSessionStatus,
} from '@/composables/use-deal-sessions-api'

const props = defineProps<{ visible: boolean }>()

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()

// ── Data ─────────────────────────────────────────────────────────────────────
// Defaults to `active`: the board's whole point is who is mid-sale right now.
const statusFilter = ref<DealSessionStatus | null>('active')
const enabled = computed(() => props.visible)

const { data, isLoading, isError, refetch, isFetching } = useDealSessionsQuery(statusFilter, enabled)

const allSessions = computed<DealSessionListItem[]>(() => data.value?.sessions ?? [])
const truncated = computed(() => data.value?.truncated ?? false)

// ── Filters ─────────────────────────────────────────────────────────────────
const search = ref('')

const statusOptions = computed(() => [
  { label: t('dealSessions.allStatuses'), value: null },
  ...SESSION_STATUSES.map((s) => ({ label: t(`dealSessions.status.${s}`), value: s })),
])

const visibleSessions = computed<DealSessionListItem[]>(() =>
  allSessions.value.filter((s) => {
    if (!search.value.trim()) return true
    const q = search.value.toLowerCase()
    return (
      (s.clientName ?? '').toLowerCase().includes(q) ||
      (s.clientPhone ?? '').includes(q) ||
      (s.agentName ?? '').toLowerCase().includes(q)
    )
  }),
)

// ── Step label ───────────────────────────────────────────────────────────────
const STEP_TITLE_KEY: Record<string, string> = {
  client: 'stepClient.title',
  card: 'stepCard.title',
  contacts: 'stepContacts.title',
  tariff: 'stepTariff.title',
  products: 'stepProducts.title',
  payment: 'stepPayment.title',
  verification: 'stepVerification.title',
}

function stepLabel(s: DealSessionListItem): string {
  const key = STEP_TITLE_KEY[s.currentStep]
  return key ? t(key) : s.currentStep
}

// ── Idle time ────────────────────────────────────────────────────────────────
// On the live board the number that matters is how long a run has been sitting
// untouched — a session idle for hours is about to be reaped. History rows get
// an ordinary date, because "3 месяца назад" tells a supervisor nothing.
const now = ref(Date.now())
const ticker = window.setInterval(() => { now.value = Date.now() }, 30_000)
onBeforeUnmount(() => window.clearInterval(ticker))

function idleLabel(iso: string): string {
  const mins = Math.max(0, Math.round((now.value - Date.parse(iso)) / 60_000))
  if (mins < 1) return t('dealSessions.justNow')
  if (mins < 60) return t('dealSessions.minutesAgo', { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('dealSessions.hoursAgo', { n: hours })
  return t('dealSessions.daysAgo', { n: Math.floor(hours / 24) })
}

// ── Row click ────────────────────────────────────────────────────────────────
// Only two rows lead anywhere: your own live run (resume it) and a completed one
// (its deal). Everyone else's session is deliberately inert — you must not be
// able to walk into a wizard someone else is standing in front of.
function targetOf(s: DealSessionListItem): string | null {
  if (s.status === 'completed' && s.dealId) return `/deals/${s.dealId}`
  if (s.status === 'active' && s.agentId === auth.employee?.id) return '/deals/create'
  return null
}

function openSession(s: DealSessionListItem) {
  const to = targetOf(s)
  if (to) router.push(to)
}
</script>

<template>
  <div class="sessions-panel">
    <template v-if="isLoading">
      <SkeletonTable :rows="6" :cols="6" :has-actions="true" :has-header="true" />
    </template>

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
          <input v-model="search" class="p-inputtext search-input"
            :placeholder="t('dealSessions.search')" />
        </span>

        <Select v-model="statusFilter" :options="statusOptions" option-label="label"
          option-value="value" :placeholder="t('dashboard.filterStatus')" class="status-select" />

        <button class="btn-ghost refresh-btn" :disabled="isFetching" @click="() => refetch()">
          <i class="pi pi-refresh" :class="{ spin: isFetching }" />
          {{ t('common.refresh') }}
        </button>
      </div>

      <!-- The cap is a guard against unbounded history, but a silently short
           list reads as "that's all there is" — so say it out loud. -->
      <div v-if="truncated" class="truncated-note">
        <i class="pi pi-info-circle" />
        {{ t('dealSessions.truncated', { n: allSessions.length }) }}
      </div>

      <!-- ── Table ──────────────────────────────────────────────────────── -->
      <div class="surface-card table-card">
        <DataTable :value="visibleSessions" row-hover :rows="15" paginator
          :rows-per-page-options="[10, 15, 25, 50]"
          paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
          :empty-message="t('dealSessions.empty')" class="sessions-table"
          :row-class="(d: DealSessionListItem) => (targetOf(d) ? 'is-clickable' : '')"
          @row-click="openSession($event.data)">
          <Column field="clientName" :header="t('dashboard.client')">
            <template #body="{ data }">
              <div v-if="data.clientName" class="client-cell">
                <span class="client-name">{{ data.clientName }}</span>
                <span class="client-phone font-mono muted">{{ data.clientPhone }}</span>
              </div>
              <span v-else class="muted">{{ t('dealSessions.noClientYet') }}</span>
            </template>
          </Column>

          <Column v-if="auth.isAdmin" field="agentName" :header="t('dealsPage.agent')">
            <template #body="{ data }">
              <span class="muted">{{ data.agentName || '—' }}</span>
            </template>
          </Column>

          <Column v-if="auth.isAdmin" field="branchName" :header="t('dealSessions.branch')"
            style="width: 150px">
            <template #body="{ data }">
              <span class="muted">{{ data.branchName || '—' }}</span>
            </template>
          </Column>

          <Column field="currentStep" :header="t('dealSessions.step')" style="width: 170px">
            <template #body="{ data }">
              <span class="step-chip">
                <span class="font-mono step-ord">{{ data.stepIndex }}/{{ data.stepCount }}</span>
                {{ stepLabel(data) }}
              </span>
            </template>
          </Column>

          <Column field="status" :header="t('dashboard.status')" style="width: 200px">
            <template #body="{ data }">
              <SessionStatusBadge :status="data.status" :reject-reason="data.rejectReason" />
            </template>
          </Column>

          <Column field="amount" :header="t('dashboard.amount')" style="width: 150px">
            <template #body="{ data }">
              <MonoAmount v-if="data.amount !== null" :value="data.amount" />
              <span v-else class="muted">—</span>
            </template>
          </Column>

          <Column field="updatedAt" :header="t('dealSessions.updated')" style="width: 130px">
            <template #body="{ data }">
              <span class="font-mono muted" :title="formatDate(data.updatedAt)">
                {{ statusFilter === 'active' ? idleLabel(data.updatedAt) : formatDate(data.updatedAt) }}
              </span>
            </template>
          </Column>

          <Column style="width: 56px">
            <template #body="{ data }">
              <button v-if="targetOf(data)" class="open-btn" @click.stop="openSession(data)">
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
.sessions-panel {
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

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Truncation notice ──────────────────────────────────────────────────────*/
.truncated-note {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
  padding: 0 0.2rem;
}

/* ── Table card ─────────────────────────────────────────────────────────────*/
.table-card {
  padding: 0;
  overflow: hidden;
}

@media (max-width: 600px) { .table-card { overflow-x: auto; } }

:deep(.sessions-table) {
  font-size: 0.875rem;
}

:deep(.sessions-table .p-datatable-thead > tr > th) {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.7rem 1rem;
}

:deep(.sessions-table .p-datatable-tbody > tr) {
  transition: background 0.12s ease;
}

:deep(.sessions-table .p-datatable-tbody > tr.is-clickable) {
  cursor: pointer;
}

:deep(.sessions-table .p-datatable-tbody > tr:hover) {
  background: var(--bg-surface) !important;
}

:deep(.sessions-table .p-datatable-tbody > tr > td) {
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

:deep(.sessions-table .p-paginator) {
  padding: 0.8rem 1rem;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}

/* ── Cell styles ────────────────────────────────────────────────────────────*/
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

.step-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 0.2rem 0.55rem;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.step-ord {
  font-size: 0.72rem;
  color: var(--text-secondary);
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
