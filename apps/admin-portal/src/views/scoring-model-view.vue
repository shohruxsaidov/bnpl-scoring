<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useScoringModelStore } from '@/stores/scoring-model'
import type { ScoringModelListItem } from '@/stores/scoring-model'

const store = useScoringModelStore()
const confirm = useConfirm()
const toast = useToast()
const { t } = useI18n()
const router = useRouter()

const showCreateDialog = ref(false)
const newModelName = ref('')
const creating = ref(false)

onMounted(async () => {
  try {
    await store.fetchModels()
  } catch {
    toast.add({ severity: 'error', summary: t('scoringModel.loadFailed'), life: 3000 })
  }
})

function makeGlobal(model: ScoringModelListItem) {
  const current = store.models.find((m) => m.isGlobal)
  confirm.require({
    message: t('scoringModel.makeGlobalConfirm', { name: model.name, current: current?.name ?? '—' }),
    header: t('scoringModel.makeGlobal'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('scoringModel.makeGlobal'), severity: 'danger' },
    accept: async () => {
      try {
        await store.setGlobal(model.id)
        toast.add({
          severity: 'success',
          summary: t('scoringModel.makeGlobalSuccess', { name: model.name }),
          life: 2500,
        })
      } catch (e) {
        const summary =
          (e as Error).message === 'scoring_model_has_no_revisions'
            ? t('scoringModel.noRevisionsYet')
            : t('scoringModel.makeGlobalFailed')
        toast.add({ severity: 'error', summary, life: 3000 })
      }
    },
  })
}

function openCreateDialog() {
  newModelName.value = ''
  showCreateDialog.value = true
}

async function confirmCreate() {
  if (!newModelName.value.trim()) return
  creating.value = true
  try {
    const model = await store.createModel(newModelName.value.trim())
    showCreateDialog.value = false
    toast.add({ severity: 'success', summary: t('scoringModel.created'), life: 2000 })
    router.push(`/scoring-model/${model.id}`)
  } catch {
    toast.add({ severity: 'error', summary: t('scoringModel.createFailed'), life: 3000 })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="list-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('scoringModel.title') }}</h1>
        <p class="page-subtitle">{{ t('scoringModel.modelsSubtitle') }}</p>
      </div>
      <button class="btn-primary" @click="openCreateDialog">
        <i class="pi pi-plus" /> {{ t('scoringModel.newModel') }}
      </button>
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
            <th class="col-count">{{ t('scoringModel.merchantCount') }}</th>
            <th class="col-count">{{ t('scoringModel.revisionCount') }}</th>
            <th class="col-date">{{ t('scoringModel.createdAt') }}</th>
            <th class="col-status">{{ t('scoringModel.status') }}</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="m in store.models"
            :key="m.id"
            class="rev-row"
            @click="router.push(`/scoring-model/${m.id}`)"
          >
            <td class="col-id mono">{{ m.id }}</td>
            <td class="col-name">{{ m.name }}</td>
            <td class="col-count mono">{{ m.merchantCount }}</td>
            <td class="col-count mono">{{ m.revisionCount }}</td>
            <td class="col-date">{{ new Date(m.createdAt).toLocaleDateString() }}</td>
            <td class="col-status">
              <span v-if="m.isGlobal" class="global-badge">{{ t('scoringModel.global') }}</span>
            </td>
            <td class="col-actions" @click.stop>
              <button
                v-if="!m.isGlobal"
                class="btn-make-global"
                :disabled="m.revisionCount === 0"
                :title="m.revisionCount === 0 ? t('scoringModel.noRevisionsYet') : undefined"
                @click="makeGlobal(m)"
              >
                <i class="pi pi-globe" /> {{ t('scoringModel.makeGlobal') }}
              </button>
            </td>
          </tr>
          <tr v-if="!store.models.length">
            <td colspan="7" class="state-row">{{ t('common.noData') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- New model dialog -->
  <Dialog
    v-model:visible="showCreateDialog"
    modal
    :header="t('scoringModel.newModel')"
    :style="{ width: '420px' }"
  >
    <div class="create-form">
      <div class="field">
        <label class="field-label">{{ t('scoringModel.modelName') }}</label>
        <InputText
          v-model="newModelName"
          fluid
          :placeholder="t('scoringModel.namePlaceholder')"
          @keyup.enter="confirmCreate"
        />
      </div>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="showCreateDialog = false">{{ t('common.cancel') }}</button>
      <button
        class="btn-primary"
        :disabled="creating || !newModelName.trim()"
        @click="confirmCreate"
      >
        {{ creating ? '…' : t('scoringModel.createModel') }}
      </button>
    </template>
  </Dialog>
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

.col-count {
  width: 110px;
  text-align: left;
  color: var(--text-secondary);
}

.col-date {
  width: 140px;
  color: var(--text-secondary);
  font-size: 0.84rem;
}

.col-status {
  width: 110px;
}

.col-actions {
  width: 200px;
  text-align: right;
  white-space: nowrap;
}

.mono {
  font-family: monospace;
  font-size: 0.84rem;
}

.global-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
}

.btn-make-global {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-make-global:hover:not(:disabled) {
  border-color: var(--success);
  color: var(--success);
}

.btn-make-global:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.4rem;
  border-radius: 10px;
  border: none;
  background: var(--gradient-hero);
  color: #fff;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  transition: opacity 0.15s, box-shadow 0.15s;
  box-shadow: var(--accent-glow);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.2rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary:hover {
  border-color: var(--text-secondary);
  color: var(--text-primary);
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.4rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
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
