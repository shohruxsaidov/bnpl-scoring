<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useScoringSessionsStore } from '@/stores/scoring-sessions'
import MonoAmount from '@/components/mono-amount.vue'
import { formatDateTime } from '@/utils/money'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const store = useScoringSessionsStore()

const id = computed(() => route.params.id as string)

onMounted(() => store.fetchDetail(id.value))

const SESSION_STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  pending: { fg: 'var(--warning)', bg: 'var(--warning-bg)' },
  running: { fg: 'var(--accent-2)', bg: 'color-mix(in srgb, var(--accent-2) 12%, transparent)' },
  completed: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  failed: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
}

function statusLabel(s: string): string {
  const key = `scoringSessions.status${s.charAt(0).toUpperCase() + s.slice(1)}`
  return t(key)
}

function pipelineTypeLabel(type: string): string {
  if (type === 'katm') return 'KATM'
  if (type === 'card_scoring') return t('scoringSessions.cardScoring')
  return type
}
</script>

<template>
  <div class="page">
    <button class="back-btn" @click="router.push('/scoring-sessions')">
      <i class="pi pi-arrow-left" /> {{ $t('common.back') }}
    </button>

    <template v-if="store.loading && !store.detail">
      <div class="surface-card skeleton-block" />
      <div class="surface-card skeleton-block" />
    </template>

    <div v-else-if="store.error" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ store.error }}</p>
      <button class="btn-ghost" @click="store.fetchDetail(id)">{{ $t('common.retry') }}</button>
    </div>

    <template v-else-if="store.detail">
      <!-- Header card -->
      <div class="surface-card header-card">
        <div class="header-top">
          <div>
            <h1 class="client-name">{{ store.detail.clientName }}</h1>
            <div class="client-meta">
              <span>{{ store.detail.clientPhone }}</span>
              <span class="sep">·</span>
              <span>{{ store.detail.clientPinfl }}</span>
            </div>
          </div>
          <span
            class="status-badge lg"
            :style="{
              color: SESSION_STATUS_COLORS[store.detail.status]?.fg,
              background: SESSION_STATUS_COLORS[store.detail.status]?.bg,
            }"
          >
            {{ statusLabel(store.detail.status) }}
          </span>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ $t('scoringSessions.consentId') }}</span>
            <span class="info-value mono">{{ store.detail.consentId }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('scoringSessions.consentDate') }}</span>
            <span class="info-value">{{ store.detail.consentDate }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('scoringSessions.katmClaimId') }}</span>
            <span class="info-value mono">{{ store.detail.katmClaimId ?? '—' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('scoringSessions.createdAt') }}</span>
            <span class="info-value">{{ formatDateTime(store.detail.createdAt) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('scoringSessions.scoredAt') }}</span>
            <span class="info-value">{{ formatDateTime(store.detail.scoredAt) }}</span>
          </div>
        </div>
      </div>

      <!-- User limit card -->
      <div v-if="store.detail.userLimit" class="surface-card limit-card">
        <div class="section-title">{{ $t('scoringSessions.userLimit') }}</div>
        <div class="limit-amount-row">
          <MonoAmount :value="store.detail.userLimit.limitAmount" size="lg" />
          <span class="limit-label">{{ $t('scoringSessions.approvedLimit') }}</span>
        </div>
        <div class="info-grid mt">
          <div class="info-item">
            <span class="info-label">{{ $t('scoringSessions.limitScoredAt') }}</span>
            <span class="info-value">{{ formatDateTime(store.detail.userLimit.scoredAt) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('scoringSessions.limitUpdatedAt') }}</span>
            <span class="info-value">{{ formatDateTime(store.detail.userLimit.updatedAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Pipelines table -->
      <div class="surface-card pipelines-card">
        <div class="section-title">{{ $t('scoringSessions.pipelines') }}</div>
        <DataTable :value="store.detail.pipelines" striped-rows>
          <Column :header="$t('scoringSessions.pipelineType')">
            <template #body="{ data }">
              <span class="pipeline-type">{{ pipelineTypeLabel(data.type) }}</span>
            </template>
          </Column>
          <Column :header="$t('scoringSessions.status')">
            <template #body="{ data }">
              <span
                class="status-badge"
                :style="{
                  color: SESSION_STATUS_COLORS[data.status]?.fg,
                  background: SESSION_STATUS_COLORS[data.status]?.bg,
                }"
              >
                {{ statusLabel(data.status) }}
              </span>
            </template>
          </Column>
          <Column :header="$t('scoringSessions.startedAt')">
            <template #body="{ data }">{{ formatDateTime(data.startedAt) }}</template>
          </Column>
          <Column :header="$t('scoringSessions.completedAt')">
            <template #body="{ data }">{{ formatDateTime(data.completedAt) }}</template>
          </Column>
          <Column :header="$t('scoringSessions.pipelineError')">
            <template #body="{ data }">
              <span v-if="data.error" class="pipeline-error">{{ data.error }}</span>
              <span v-else class="no-error">—</span>
            </template>
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

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: fit-content;
  padding: 0.4rem 0.9rem;
  border-radius: 9px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.back-btn:hover {
  color: var(--text-primary);
  border-color: var(--accent-2);
}

.header-card {
  padding: 1.5rem;
}

.header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.client-name {
  font-size: 1.4rem;
  font-weight: 800;
  margin: 0 0 0.3rem;
}

.client-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.sep {
  color: var(--border-subtle);
}

.status-badge {
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 700;
}

.status-badge.lg {
  font-size: 0.88rem;
  padding: 0.4rem 1rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem 1.5rem;
}

.info-grid.mt {
  margin-top: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.info-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.info-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.info-value.mono {
  font-family: var(--font-mono, monospace);
  font-size: 0.84rem;
}

.limit-card {
  padding: 1.25rem 1.5rem;
}

.pipelines-card {
  padding: 1.25rem 1.5rem 0;
}

.section-title {
  font-size: 1rem;
  font-weight: 800;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.limit-amount-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.limit-label {
  font-size: 0.84rem;
  color: var(--text-secondary);
}

.pipeline-type {
  font-weight: 700;
  font-size: 0.88rem;
}

.pipeline-error {
  font-size: 0.8rem;
  color: var(--danger);
  max-width: 280px;
  display: block;
  word-break: break-word;
}

.no-error {
  color: var(--text-secondary);
}

.skeleton-block {
  height: 200px;
  border-radius: 14px;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-secondary);
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
