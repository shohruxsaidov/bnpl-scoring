<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { useScoringModelStore } from '@/stores/scoring-model'

const store = useScoringModelStore()
const toast = useToast()
const { t } = useI18n()
const router = useRouter()

onMounted(async () => {
  try {
    await store.fetchHistory()
  } catch {
    toast.add({ severity: 'error', summary: t('scoringModel.loadFailed'), life: 3000 })
  }
})
</script>

<template>
  <div class="list-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('scoringModel.title') }}</h1>
        <p class="page-subtitle">{{ t('scoringModel.subtitle') }}</p>
      </div>
    </div>

    <div class="surface-card table-card">
      <div v-if="store.loading" class="state-row">
        <i class="pi pi-spin pi-spinner" /> {{ t('common.loading') }}
      </div>

      <table v-else class="rev-table">
        <thead>
          <tr>
            <th class="col-id">#</th>
            <th class="col-name">{{ t('scoringModel.modelName') }}</th>
            <th class="col-ver">{{ t('scoringModel.modelVersion') }}</th>
            <th class="col-date">{{ t('scoringModel.createdAt') }}</th>
            <th class="col-status">{{ t('scoringModel.status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(rev, i) in store.history"
            :key="rev.id"
            class="rev-row"
            @click="router.push(`/scoring-model/${rev.id}`)"
          >
            <td class="col-id mono">{{ rev.id }}</td>
            <td class="col-name">{{ rev.name }}</td>
            <td class="col-ver">
              <span class="ver-chip">v{{ rev.version }}</span>
            </td>
            <td class="col-date">{{ new Date(rev.createdAt).toLocaleDateString() }}</td>
            <td class="col-status">
              <span v-if="i === 0" class="active-badge">{{ t('scoringModel.active') }}</span>
            </td>
          </tr>
          <tr v-if="!store.history.length">
            <td colspan="5" class="state-row">{{ t('common.noData') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.list-page {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.page-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.page-subtitle {
  font-size: 0.86rem;
  color: var(--text-secondary);
  margin: 0;
}

.table-card {
  overflow: hidden;
}

.rev-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.rev-table thead tr {
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-base);
}

.rev-table th {
  padding: 0.65rem 1.25rem;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  white-space: nowrap;
}

.rev-row {
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background 0.12s;
}

.rev-row:last-child {
  border-bottom: none;
}

.rev-row:hover {
  background: var(--bg-base);
}

.rev-table td {
  padding: 0.85rem 1.25rem;
  vertical-align: middle;
}

.col-id {
  width: 56px;
  color: var(--text-secondary);
}

.col-name {
  font-weight: 600;
}

.col-ver {
  width: 100px;
}

.col-date {
  width: 140px;
  color: var(--text-secondary);
  font-size: 0.84rem;
}

.col-status {
  width: 100px;
}

.mono {
  font-family: monospace;
  font-size: 0.84rem;
}

.ver-chip {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 12%, transparent);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.active-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
}

.state-row {
  padding: 2.5rem 1.25rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
</style>
