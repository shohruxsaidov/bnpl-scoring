<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useScoringSessionsStore } from '@/stores/scoring-sessions'
import { formatDateTime } from '@/utils/money'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const store = useScoringSessionsStore()

const id = computed(() => route.params.id as string)

onMounted(() => store.fetchDetail(id.value))

const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  active: { fg: 'var(--accent-2)', bg: 'color-mix(in srgb, var(--accent-2) 12%, transparent)' },
  completed: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  abandoned: { fg: 'var(--text-secondary)', bg: 'color-mix(in srgb, var(--text-secondary) 10%, transparent)' },
}

function statusLabel(s: string): string {
  const key = `scoringSessions.status${s.charAt(0).toUpperCase() + s.slice(1)}`
  return t(key)
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
            <h1 class="client-name">
              {{ store.detail.clientName ?? $t('scoringSessions.noClient') }}
            </h1>
            <div v-if="store.detail.clientPhone" class="client-meta">
              <span>{{ store.detail.clientPhone }}</span>
              <span v-if="store.detail.clientPinfl" class="sep">·</span>
              <span v-if="store.detail.clientPinfl">{{ store.detail.clientPinfl }}</span>
            </div>
          </div>
          <span
            class="status-badge lg"
            :style="{
              color: STATUS_COLORS[store.detail.status]?.fg,
              background: STATUS_COLORS[store.detail.status]?.bg,
            }"
          >
            {{ statusLabel(store.detail.status) }}
          </span>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ $t('scoringSessions.merchant') }}</span>
            <span class="info-value">{{ store.detail.merchantName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('scoringSessions.agent') }}</span>
            <span class="info-value">{{ store.detail.agentName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('scoringSessions.currentStep') }}</span>
            <span class="info-value mono">{{ store.detail.currentStep }}</span>
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
            <span class="info-label">{{ $t('scoringSessions.updatedAt') }}</span>
            <span class="info-value">{{ formatDateTime(store.detail.updatedAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Events table -->
      <div class="surface-card events-card">
        <div class="section-title">{{ $t('scoringSessions.events') }}</div>
        <DataTable :value="store.detail.events" striped-rows>
          <Column :header="$t('scoringSessions.eventStep')">
            <template #body="{ data }">
              <span class="step-tag">{{ data.step }}</span>
            </template>
          </Column>
          <Column :header="$t('scoringSessions.eventCreatedAt')">
            <template #body="{ data }">{{ formatDateTime(data.createdAt) }}</template>
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

.events-card {
  padding: 1.25rem 1.5rem 0;
}

.section-title {
  font-size: 1rem;
  font-weight: 800;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.step-tag {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent-2) 10%, transparent);
  color: var(--accent-2);
  font-size: 0.78rem;
  font-weight: 700;
  font-family: var(--font-mono, monospace);
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
