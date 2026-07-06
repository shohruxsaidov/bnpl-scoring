<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import { useScoringsStore, type ScoringListItem } from '@/stores/scorings'

const store = useScoringsStore()
const router = useRouter()

function openDetail(row: ScoringListItem) {
  router.push({ name: 'scoring-detail', params: { id: row.id } })
}

const rows = ref(25)
const first = ref(0)

onMounted(fetch)

function fetch() {
  store.fetchList({ limit: rows.value, offset: first.value })
}

function onPage(event: DataTablePageEvent) {
  first.value = event.first
  rows.value = event.rows
  fetch()
}

// passed/scored = cleared & done; in_progress = running; rejected = knocked out; error = system failure.
function statusClass(status: string): string {
  switch (status) {
    case 'passed':
    case 'scored':
      return 'pill-success'
    case 'in_progress':
      return 'pill-progress'
    case 'rejected':
      return 'pill-warn'
    case 'error':
      return 'pill-error'
    default:
      return 'pill-progress'
  }
}

function formatScore(score: number | null): string {
  return score != null ? String(score) : '—'
}

function formatCreditLimit(value: string | null): string {
  // creditLimit is whole som as a string, e.g. '1000000'.
  if (value == null) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(value)) + " so'm"
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ $t('routeTitle.scorings') }}</h1>
        <p class="page-sub">{{ $t('scorings.count', { count: store.total }) }}</p>
      </div>
    </div>

    <div v-if="store.error" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ store.error }}</p>
      <button class="btn-ghost" @click="fetch">{{ $t('common.retry') }}</button>
    </div>

    <div v-else class="surface-card table-card">
      <DataTable :value="store.list" data-key="id" row-hover lazy paginator :rows="rows" :first="first"
        :total-records="store.total" :loading="store.loading" size="small" class="grid-table" @page="onPage"
        @row-click="openDetail($event.data as ScoringListItem)">
        <Column :header="$t('scorings.id')" field="id" style="width:80px">
          <template #body="{ data }">
            <span class="font-mono muted">#{{ data.id }}</span>
          </template>
        </Column>
        <Column :header="$t('scorings.client')" field="fullName">
          <template #body="{ data }">
            <div class="client-cell">
              <span class="client-name">{{ data.fullName ?? '—' }}</span>
              <span v-if="data.phone" class="font-mono muted client-phone">{{ data.phone }}</span>
            </div>
          </template>
        </Column>
        <Column :header="$t('scorings.status')" field="status" style="width:130px">
          <template #body="{ data }">
            <span class="pill" :class="statusClass(data.status)">
              {{ $t(`scorings.statusValue.${data.status}`) }}
            </span>
          </template>
        </Column>
        <Column :header="$t('scorings.score')" field="score" style="width:90px">
          <template #body="{ data }">
            <span class="font-mono">{{ formatScore(data.score) }}</span>
          </template>
        </Column>
        <Column :header="$t('scorings.creditLimit')" field="creditLimit" style="width:160px">
          <template #body="{ data }">
            <span class="font-mono">{{ formatCreditLimit(data.creditLimit) }}</span>
          </template>
        </Column>
        <Column :header="$t('scorings.pipeline')" field="currentPipeline" style="width:120px">
          <template #body="{ data }">
            <span class="font-mono muted">{{ data.currentPipeline ?? '—' }}</span>
          </template>
        </Column>
        <Column :header="$t('scorings.createdAt')" field="createdAt" style="width:160px">
          <template #body="{ data }">
            <span class="font-mono muted">{{ formatTimestamp(data.createdAt) }}</span>
          </template>
        </Column>
        <template #empty>
          <div class="empty-state">{{ $t('scorings.empty') }}</div>
        </template>
      </DataTable>
    </div>
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

.client-name {
  font-weight: 600;
}

.client-phone {
  font-size: 0.76rem;
}

.muted {
  color: var(--text-secondary);
}

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

.pill-success {
  color: var(--success);
  background: var(--success-bg);
}

.pill-error {
  color: var(--danger);
  background: var(--danger-bg);
}

.pill-progress {
  color: var(--primary, #2563eb);
  background: color-mix(in srgb, var(--primary, #2563eb) 12%, transparent);
}

.pill-warn {
  color: #b45309;
  background: color-mix(in srgb, #f59e0b 16%, transparent);
}

.empty-state {
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

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

@media (max-width: 600px) {
  .table-card {
    overflow-x: auto;
  }
}
</style>
