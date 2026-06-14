<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useScoringSessionsStore, type ScoringSessionListItem } from '@/stores/scoring-sessions'
import { formatDateTime } from '@/utils/money'

const store = useScoringSessionsStore()
const router = useRouter()
const { t } = useI18n()

const search = ref('')
const statusFilter = ref<string | null>(null)

onMounted(() => store.fetchList())

const statusOptions = computed(() => [
  { label: t('scoringSessions.allStatuses'), value: null },
  { label: t('scoringSessions.statusPending'), value: 'pending' },
  { label: t('scoringSessions.statusRunning'), value: 'running' },
  { label: t('scoringSessions.statusCompleted'), value: 'completed' },
  { label: t('scoringSessions.statusFailed'), value: 'failed' },
])

const filtered = computed<ScoringSessionListItem[]>(() => {
  let list = store.sessions
  if (statusFilter.value) list = list.filter((r) => r.status === statusFilter.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (r) =>
        r.clientName.toLowerCase().includes(q) ||
        r.clientPhone.includes(q) ||
        r.clientPinfl.includes(q),
    )
  }
  return list
})

const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  pending: { fg: 'var(--warning)', bg: 'var(--warning-bg)' },
  running: { fg: 'var(--accent-2)', bg: 'color-mix(in srgb, var(--accent-2) 12%, transparent)' },
  completed: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  failed: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
}

function statusLabel(s: string): string {
  const key = `scoringSessions.status${s.charAt(0).toUpperCase() + s.slice(1)}`
  return t(key)
}

function openDetail(row: ScoringSessionListItem) {
  router.push(`/scoring-sessions/${row.id}`)
}
</script>

<template>
  <div class="page">
    <template v-if="store.loading && store.sessions.length === 0">
      <div class="surface-card skeleton-table" />
    </template>

    <div v-else-if="store.error" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ store.error }}</p>
      <button class="btn-ghost" @click="store.fetchList()">{{ $t('common.retry') }}</button>
    </div>

    <template v-else>
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ $t('routeTitle.scoringSessions') }}</h1>
          <p class="page-sub">{{ $t('scoringSessions.count', { count: filtered.length }) }}</p>
        </div>
      </div>

      <div class="toolbar surface-card">
        <input
          v-model="search"
          class="search-input"
          :placeholder="$t('scoringSessions.searchPlaceholder')"
        />
        <div class="filter-chips">
          <button
            v-for="opt in statusOptions"
            :key="String(opt.value)"
            class="chip"
            :class="{ active: statusFilter === opt.value }"
            @click="statusFilter = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="surface-card table-card">
        <DataTable
          :value="filtered"
          :loading="store.loading"
          row-hover
          striped-rows
          @row-click="openDetail($event.data)"
        >
          <Column :header="$t('scoringSessions.client')">
            <template #body="{ data }">
              <div class="client-cell">
                <span class="client-name">{{ data.clientName }}</span>
                <span class="client-sub">{{ data.clientPhone }} · {{ data.clientPinfl }}</span>
              </div>
            </template>
          </Column>
          <Column :header="$t('scoringSessions.status')">
            <template #body="{ data }">
              <span
                class="status-badge"
                :style="{
                  color: STATUS_COLORS[data.status]?.fg,
                  background: STATUS_COLORS[data.status]?.bg,
                }"
              >
                {{ statusLabel(data.status) }}
              </span>
            </template>
          </Column>
          <Column :header="$t('scoringSessions.consentDate')" field="consentDate" />
          <Column :header="$t('scoringSessions.createdAt')">
            <template #body="{ data }">{{ formatDateTime(data.createdAt) }}</template>
          </Column>
          <Column :header="$t('scoringSessions.scoredAt')">
            <template #body="{ data }">{{ formatDateTime(data.scoredAt) }}</template>
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
  gap: 1.25rem;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.page-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.page-sub {
  font-size: 0.84rem;
  color: var(--text-secondary);
  margin: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1rem;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 200px;
  height: 36px;
  padding: 0 0.85rem;
  border: 1px solid var(--border-subtle);
  border-radius: 9px;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 0.88rem;
  outline: none;
}

.search-input:focus {
  border-color: var(--accent-2);
}

.filter-chips {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.chip {
  padding: 0.3rem 0.75rem;
  border-radius: 20px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chip.active,
.chip:hover {
  border-color: var(--accent-2);
  color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 10%, transparent);
}

.table-card {
  padding: 0;
  overflow: hidden;
}

.client-cell {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.client-name {
  font-weight: 700;
  font-size: 0.9rem;
}

.client-sub {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.status-badge {
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 700;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-secondary);
}

.skeleton-table {
  height: 360px;
  border-radius: 14px;
}

.btn-ghost {
  padding: 0.4rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
}
</style>
