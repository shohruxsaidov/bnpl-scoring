<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Drawer from 'primevue/drawer'
import { useIntegrationLogsStore, type IntegrationLogListItem } from '@/stores/integration-logs'

const store = useIntegrationLogsStore()
const { t } = useI18n()

const dateRange = ref<Date[] | null>(null)
const integrationFilter = ref<string | null>(null)
const resultFilter = ref<'success' | 'error' | null>(null)

const rows = ref(50)
const first = ref(0)

const showDetail = ref(false)

onMounted(() => {
  fetch()
  store.fetchIntegrations()
})

function currentFilters() {
  const [from, to] = dateRange.value ?? []
  // The range picker yields day-start dates; extend `to` to the end of its day
  // so the filter is inclusive.
  const toEnd = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined
  return {
    from: from?.toISOString(),
    to: toEnd?.toISOString(),
    integration: integrationFilter.value,
    result: resultFilter.value,
    limit: rows.value,
    offset: first.value,
  }
}

function fetch() {
  store.fetchList(currentFilters())
}

watch([dateRange, integrationFilter, resultFilter], () => {
  // An in-progress range selection has no end date yet — wait for it.
  if (dateRange.value && dateRange.value[1] == null && dateRange.value[0] != null) return
  first.value = 0
  fetch()
})

function onPage(event: DataTablePageEvent) {
  first.value = event.first
  rows.value = event.rows
  fetch()
}

const integrationOptions = computed(() => [
  { label: t('integrationLogs.allIntegrations'), value: null },
  ...store.integrations.map((name) => ({ label: name.toUpperCase(), value: name })),
])

const resultOptions = computed(() => [
  { label: t('integrationLogs.allResults'), value: null },
  { label: t('integrationLogs.success'), value: 'success' },
  { label: t('integrationLogs.error'), value: 'error' },
])

function openDetail(row: IntegrationLogListItem) {
  showDetail.value = true
  store.fetchDetail(row.id)
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  )
}

function formatJson(value: unknown): string {
  if (value == null) return '—'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ $t('routeTitle.integrationLogs') }}</h1>
        <p class="page-sub">{{ $t('integrationLogs.count', { count: store.total }) }}</p>
      </div>
    </div>

    <div class="surface-card filters-bar">
      <DatePicker v-model="dateRange" selection-mode="range" :manual-input="false" show-icon
        show-button-bar date-format="dd.mm.yy" :placeholder="$t('integrationLogs.dateRange')" class="filter-date" />
      <Select v-model="integrationFilter" :options="integrationOptions" option-label="label" option-value="value"
        :placeholder="$t('integrationLogs.allIntegrations')" class="filter-select" />
      <Select v-model="resultFilter" :options="resultOptions" option-label="label" option-value="value"
        :placeholder="$t('integrationLogs.allResults')" class="filter-select" />
    </div>

    <div v-if="store.error" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ store.error }}</p>
      <button class="btn-ghost" @click="fetch">{{ $t('common.retry') }}</button>
    </div>

    <div v-else class="surface-card table-card">
      <DataTable :value="store.logs" data-key="id" row-hover lazy paginator :rows="rows" :first="first"
        :total-records="store.total" :rows-per-page-options="[25, 50, 100]" :loading="store.loading" size="small"
        class="grid-table" @page="onPage" @row-click="openDetail($event.data as IntegrationLogListItem)">
        <Column :header="$t('integrationLogs.integration')" field="integration" style="width:120px">
          <template #body="{ data }">
            <span class="integration-chip">{{ data.integration }}</span>
          </template>
        </Column>
        <Column :header="$t('integrationLogs.methodType')" field="methodType" style="width:100px">
          <template #body="{ data }">
            <span class="font-mono method-type">{{ data.methodType }}</span>
          </template>
        </Column>
        <Column :header="$t('integrationLogs.methodName')" field="methodName">
          <template #body="{ data }">
            <span class="font-mono">{{ data.methodName }}</span>
          </template>
        </Column>
        <Column :header="$t('integrationLogs.status')" field="status" style="width:110px">
          <template #body="{ data }">
            <span class="pill" :class="data.hasError ? 'pill-error' : 'pill-success'">
              {{ data.status ?? (data.hasError ? 'ERR' : '—') }}
            </span>
          </template>
        </Column>
        <Column :header="$t('integrationLogs.duration')" field="responseTimeInMs" style="width:110px">
          <template #body="{ data }">
            <span class="font-mono muted">{{ data.responseTimeInMs != null ? data.responseTimeInMs + ' ms' : '—'
            }}</span>
          </template>
        </Column>
        <Column :header="$t('integrationLogs.requestAt')" field="requestTimestamp" style="width:170px">
          <template #body="{ data }">
            <span class="font-mono muted">{{ formatTimestamp(data.requestTimestamp) }}</span>
          </template>
        </Column>
        <Column :header="$t('integrationLogs.responseAt')" field="responseTimestamp" style="width:170px">
          <template #body="{ data }">
            <span class="font-mono muted">{{ formatTimestamp(data.responseTimestamp) }}</span>
          </template>
        </Column>
        <template #empty>
          <div class="empty-state">{{ $t('integrationLogs.empty') }}</div>
        </template>
      </DataTable>
    </div>

    <Drawer v-model:visible="showDetail" position="right" :header="$t('integrationLogs.detailTitle')"
      :style="{ width: '560px' }">
      <div v-if="store.detailLoading" class="drawer-loading">
        <i class="pi pi-spin pi-spinner" />
      </div>
      <div v-else-if="store.detail" class="drawer-content">
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">{{ $t('integrationLogs.integration') }}</span>
            <span class="integration-chip">{{ store.detail.integration }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">{{ $t('integrationLogs.status') }}</span>
            <span class="pill" :class="store.detail.hasError ? 'pill-error' : 'pill-success'">
              {{ store.detail.status ?? (store.detail.hasError ? 'ERR' : '—') }}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">{{ $t('integrationLogs.methodType') }}</span>
            <span class="font-mono method-type">{{ store.detail.methodType }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">{{ $t('integrationLogs.duration') }}</span>
            <span class="font-mono">{{ store.detail.responseTimeInMs != null ? store.detail.responseTimeInMs + ' ms' :
              '—' }}</span>
          </div>
          <div class="meta-item meta-wide">
            <span class="meta-label">{{ $t('integrationLogs.methodName') }}</span>
            <span class="font-mono">{{ store.detail.methodName }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">{{ $t('integrationLogs.requestAt') }}</span>
            <span class="font-mono">{{ formatTimestamp(store.detail.requestTimestamp) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">{{ $t('integrationLogs.responseAt') }}</span>
            <span class="font-mono">{{ formatTimestamp(store.detail.responseTimestamp) }}</span>
          </div>
        </div>

        <div v-if="store.detail.errorMessage" class="error-box">
          <span class="meta-label">{{ $t('integrationLogs.errorMessage') }}</span>
          <p class="error-text font-mono">{{ store.detail.errorMessage }}</p>
        </div>

        <div class="payload-block">
          <span class="meta-label">{{ $t('integrationLogs.request') }}</span>
          <pre class="payload font-mono">{{ formatJson(store.detail.request) }}</pre>
        </div>
        <div class="payload-block">
          <span class="meta-label">{{ $t('integrationLogs.response') }}</span>
          <pre class="payload font-mono">{{ formatJson(store.detail.response) }}</pre>
        </div>
      </div>
    </Drawer>
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

.filters-bar {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.9rem 1.2rem;
  flex-wrap: wrap;
}

.filter-date {
  width: 260px;
}

.filter-select {
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

.integration-chip {
  display: inline-flex;
  padding: 0.18rem 0.55rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
}

.method-type {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
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

.drawer-loading {
  display: grid;
  place-items: center;
  padding: 3rem;
  font-size: 1.4rem;
  color: var(--text-secondary);
}

.drawer-content {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.meta-wide {
  grid-column: 1 / -1;
}

.meta-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.error-box {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.8rem 1rem;
  border-radius: 10px;
  background: var(--danger-bg);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
}

.error-text {
  margin: 0;
  font-size: 0.82rem;
  color: var(--danger);
  word-break: break-word;
}

.payload-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.payload {
  margin: 0;
  padding: 0.8rem 1rem;
  border-radius: 10px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  font-size: 0.76rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 320px;
  overflow: auto;
}

@media (max-width: 600px) {
  .table-card {
    overflow-x: auto;
  }

  .filters-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-date,
  .filter-select {
    width: 100%;
  }
}
</style>
