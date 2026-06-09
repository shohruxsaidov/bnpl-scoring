<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { useScoringModelStore } from '@/stores/scoring-model'

const store = useScoringModelStore()
const toast = useToast()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const revisionId = Number(route.params.id)
const localParams = ref<Record<string, unknown> | null>(null)
const showSaveDialog = ref(false)
const saveName = ref('')
const saveVersion = ref('')
const saveError = ref('')

onMounted(async () => {
  try {
    await Promise.all([store.loadRevision(revisionId), store.fetchHistory()])
    localParams.value = JSON.parse(JSON.stringify(store.revision!.params))
  } catch {
    toast.add({ severity: 'error', summary: t('scoringModel.loadFailed'), life: 3000 })
  }
})

const isActive = computed(() => store.history[0]?.id === revisionId)

function openSaveDialog() {
  saveName.value = store.revision?.name ?? ''
  saveVersion.value = store.revision?.version ?? ''
  saveError.value = ''
  showSaveDialog.value = true
}

async function confirmSave() {
  if (!localParams.value || !saveName.value || !saveVersion.value) return
  saveError.value = ''
  try {
    await store.save(saveName.value, saveVersion.value, localParams.value)
    showSaveDialog.value = false
    toast.add({ severity: 'success', summary: t('scoringModel.saved'), life: 2000 })
    router.push(`/scoring-model/${store.revision!.id}`)
  } catch (e) {
    if ((e as Error).message === 'version_taken') {
      saveError.value = t('scoringModel.versionTaken')
    } else {
      toast.add({ severity: 'error', summary: t('scoringModel.saveFailed'), life: 3000 })
    }
  }
}

function getCriteria() {
  if (!localParams.value) return []
  return Object.entries(localParams.value).map(([key, data]) => ({
    key,
    data: data as Record<string, unknown>,
  }))
}

function criterionName(key: string, data: Record<string, unknown>): string {
  return (data['Name'] as string | undefined) ?? key
}

function isRangeBased(data: Record<string, unknown>): boolean {
  return Array.isArray(data['Values'])
}

function isEnumBased(data: Record<string, unknown>): boolean {
  return (
    typeof data['Scores'] === 'object' &&
    data['Scores'] !== null &&
    !Array.isArray(data['Scores'])
  )
}

function isPassportData(key: string): boolean {
  return key === 'PassportData'
}

function isLimitSum(key: string): boolean {
  return key === 'LimitSum'
}

function bandFrom(band: Record<string, unknown>): number | null {
  const k = Object.keys(band).find(
    (k) => k.toLowerCase().endsWith('from') && k !== 'Score',
  )
  return k !== undefined ? (band[k] as number) : null
}

function bandTo(band: Record<string, unknown>): number | null {
  const k = Object.keys(band).find(
    (k) => k.toLowerCase().endsWith('to') && k !== 'Score',
  )
  return k !== undefined ? (band[k] as number) : null
}

function bandDescription(band: Record<string, unknown>): string {
  return (band['Description'] as string | undefined) ?? ''
}
</script>

<template>
  <div class="detail-page">
    <!-- Page header -->
    <div class="page-header">
      <div class="header-left">
        <button class="back-btn" @click="router.push('/scoring-model')">
          <i class="pi pi-arrow-left" /> {{ t('scoringModel.backToList') }}
        </button>
        <div v-if="store.revision" class="title-row">
          <h1 class="page-title">{{ store.revision.name }}</h1>
          <span class="ver-chip">v{{ store.revision.version }}</span>
          <span v-if="isActive" class="active-badge">{{ t('scoringModel.active') }}</span>
          <span class="rev-id">#{{ store.revision.id }}</span>
        </div>
      </div>
      <div class="header-actions">
        <button
          v-if="store.revision"
          class="btn-secondary"
          @click="router.push(`/scoring-model/${revisionId}/try`)"
        >
          <i class="pi pi-play" /> {{ t('scoringModel.tryModel') }}
        </button>
        <button class="btn-primary" :disabled="store.saving || !localParams" @click="openSaveDialog">
          <i class="pi pi-plus" />
          {{ store.saving ? '…' : t('scoringModel.saveRevision') }}
        </button>
      </div>
    </div>

    <div v-if="store.loading" class="loading-state">
      <i class="pi pi-spin pi-spinner" /> {{ t('common.loading') }}
    </div>

    <Accordion v-else-if="localParams" multiple>
      <AccordionPanel
        v-for="{ key, data } in getCriteria()"
        :key="key"
        :value="key"
        :class="{ 'criterion-disabled': data['Enabled'] === false }"
      >
        <AccordionHeader>
          <div class="crit-header">
            <div class="enabled-wrap" @click.stop>
              <ToggleSwitch
                :model-value="(data as Record<string, unknown>)['Enabled'] !== false"
                @update:model-value="(v: boolean) => (data as Record<string, unknown>)['Enabled'] = v"
              />
            </div>
            <span class="crit-name" :class="{ 'name-muted': data['Enabled'] === false }">{{ criterionName(key, data) }}</span>
            <span class="crit-key">{{ key }}</span>
            <div class="imp-wrap" @click.stop>
              <span class="imp-label">{{ t('scoringModel.importantLevel') }}</span>
              <InputNumber
                v-model="(data as Record<string, unknown>)['ImportantLevel'] as number"
                :min="0" :max="1" :step="0.5" :max-fraction-digits="1"
                input-class="imp-input"
                :disabled="data['Enabled'] === false"
              />
            </div>
          </div>
        </AccordionHeader>

        <AccordionContent>
          <!-- Range-based -->
          <template v-if="isRangeBased(data) && !isLimitSum(key)">
            <table class="crit-table">
              <thead>
                <tr>
                  <th class="col-desc">{{ t('scoringModel.description') }}</th>
                  <th class="col-range">{{ t('scoringModel.range') }}</th>
                  <th class="col-score">{{ t('scoringModel.score') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(band, i) in (data['Values'] as Record<string, unknown>[])" :key="i">
                  <td class="col-desc">{{ bandDescription(band) }}</td>
                  <td class="col-range">
                    <span class="range-val">{{ bandFrom(band) }}</span>
                    <span class="range-sep">—</span>
                    <span class="range-val">{{ bandTo(band) }}</span>
                  </td>
                  <td class="col-score">
                    <InputNumber
                      v-model="(band as Record<string, unknown>)['Score'] as number"
                      :use-grouping="false"
                      input-class="score-input"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </template>

          <!-- LimitSum coefficient table -->
          <template v-else-if="isLimitSum(key)">
            <table class="crit-table">
              <thead>
                <tr>
                  <th class="col-range">{{ t('scoringModel.scoreFrom') }}</th>
                  <th class="col-range">{{ t('scoringModel.scoreTo') }}</th>
                  <th class="col-score">{{ t('scoringModel.coefficient') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(band, i) in (data['Values'] as Record<string, unknown>[])" :key="i">
                  <td class="col-range">
                    <InputNumber
                      v-model="(band as Record<string, unknown>)['From'] as number"
                      :use-grouping="false" :min-fraction-digits="0" :max-fraction-digits="0"
                      input-class="score-input"
                    />
                  </td>
                  <td class="col-range">
                    <InputNumber
                      v-model="(band as Record<string, unknown>)['To'] as number"
                      :use-grouping="false" :min-fraction-digits="0" :max-fraction-digits="0"
                      input-class="score-input"
                    />
                  </td>
                  <td class="col-score">
                    <InputNumber
                      v-model="(band as Record<string, unknown>)['Score'] as number"
                      :min="0" :max="1" :max-fraction-digits="2" :step="0.1"
                      input-class="score-input"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </template>

          <!-- Enum-based -->
          <template v-else-if="isEnumBased(data)">
            <table class="crit-table">
              <thead>
                <tr>
                  <th class="col-desc">{{ t('scoringModel.option') }}</th>
                  <th class="col-score">{{ t('scoringModel.score') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(_s, enumKey) in (data['Scores'] as Record<string, number>)"
                  :key="enumKey"
                >
                  <td class="col-desc enum-key-cell">{{ enumKey }}</td>
                  <td class="col-score">
                    <InputNumber
                      v-model="(data['Scores'] as Record<string, number>)[enumKey]"
                      :use-grouping="false"
                      input-class="score-input"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </template>

          <!-- PassportData -->
          <template v-else-if="isPassportData(key)">
            <table class="crit-table">
              <thead>
                <tr>
                  <th class="col-desc">{{ t('scoringModel.validRegions') }}</th>
                  <th class="col-score">{{ t('scoringModel.score') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="col-desc mono">
                    {{ (data['ValidRegions'] as string[]).join(', ') }}
                  </td>
                  <td class="col-score">
                    <InputNumber
                      v-model="(data as Record<string, unknown>)['Score'] as number"
                      :use-grouping="false"
                      input-class="score-input"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>
  </div>

  <!-- Save dialog -->
  <Dialog
    v-model:visible="showSaveDialog"
    modal
    :header="t('scoringModel.saveRevision')"
    :style="{ width: '420px' }"
  >
    <div class="save-form">
      <div class="field">
        <label class="field-label">{{ t('scoringModel.modelName') }}</label>
        <InputText v-model="saveName" fluid :placeholder="t('scoringModel.namePlaceholder')" />
      </div>
      <div class="field">
        <label class="field-label">{{ t('scoringModel.modelVersion') }}</label>
        <InputText v-model="saveVersion" fluid placeholder="1.0" @input="saveError = ''" />
      </div>
      <p v-if="saveError" class="save-error">{{ saveError }}</p>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="showSaveDialog = false">{{ t('common.cancel') }}</button>
      <button
        class="btn-primary"
        :disabled="store.saving || !saveName || !saveVersion"
        @click="confirmSave"
      >
        {{ store.saving ? '…' : t('common.save') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.detail-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Header ──────────────────────────────────────────────────────────────────*/
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
  width: fit-content;
}

.back-btn:hover { color: var(--text-primary); }

.title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.page-title {
  font-size: 1.35rem;
  font-weight: 800;
  margin: 0;
  color: var(--text-primary);
}

.ver-chip {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 12%, transparent);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.active-badge {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
}

.rev-id {
  font-family: monospace;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  padding: 2rem 0;
}

/* ── Buttons ─────────────────────────────────────────────────────────────────*/
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

.btn-primary:hover:not(:disabled) { opacity: 0.9; }

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

/* ── Disabled criterion ──────────────────────────────────────────────────────*/
:deep(.criterion-disabled .p-accordioncontent) {
  opacity: 0.35;
  pointer-events: none;
}

.name-muted {
  opacity: 0.45;
  text-decoration: line-through;
}

/* ── Accordion header ────────────────────────────────────────────────────────*/
.crit-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 1;
  min-width: 0;
  padding-right: 0.5rem;
}

.enabled-wrap {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.crit-name {
  font-weight: 700;
  font-size: 0.95rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.crit-key {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  padding: 0.12rem 0.35rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.imp-wrap {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.imp-label {
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-weight: 600;
  white-space: nowrap;
}

:deep(.imp-input) {
  width: 56px !important;
  text-align: center;
  font-weight: 700;
  font-size: 0.88rem;
  padding: 0.3rem 0.4rem !important;
}

/* ── Criteria table ──────────────────────────────────────────────────────────*/
.crit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.crit-table thead tr {
  border-bottom: 2px solid var(--border-subtle);
}

.crit-table th {
  padding: 0.45rem 1rem;
  text-align: left;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.crit-table tbody tr {
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.1s;
}

.crit-table tbody tr:last-child { border-bottom: none; }
.crit-table tbody tr:hover { background: var(--bg-base); }

.crit-table td {
  padding: 0.3rem 1rem;
  vertical-align: middle;
}

.col-desc { width: 100%; }

.col-range {
  white-space: nowrap;
  width: 160px;
  text-align: center;
}

.col-score {
  width: 110px;
  text-align: right;
}

.range-val {
  font-family: monospace;
  font-size: 0.84rem;
  font-weight: 600;
}

.range-sep {
  margin: 0 0.3rem;
  color: var(--text-secondary);
}

.mono { font-family: monospace; }
.enum-key-cell { font-weight: 600; }

:deep(.score-input) {
  width: 90px !important;
  text-align: right;
  font-weight: 700;
  font-size: 0.88rem;
  padding: 0.28rem 0.5rem !important;
}

/* ── Save dialog ─────────────────────────────────────────────────────────────*/
.save-form {
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

.save-error {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--error, #e53e3e);
}
</style>
