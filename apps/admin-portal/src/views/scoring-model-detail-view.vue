<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
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
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useScoringModelStore } from '@/stores/scoring-model'

const store = useScoringModelStore()
const confirm = useConfirm()
const toast = useToast()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const modelId = computed(() => Number(route.params.id))
// Present only on the nested revision route — the view is read-only there.
const revId = computed(() => (route.params.revId != null ? Number(route.params.revId) : null))
const readOnly = computed(() => revId.value !== null)

const localParams = ref<Record<string, unknown> | null>(null)
const showSaveDialog = ref(false)
const saveName = ref('')
const saveVersion = ref('')
const saveError = ref('')

async function load() {
  localParams.value = null
  try {
    await store.fetchModel(modelId.value)
    await store.fetchModelHistory(modelId.value)
    if (revId.value !== null) {
      await store.loadRevision(revId.value)
    }
    if (store.revision) {
      localParams.value = JSON.parse(JSON.stringify(store.revision.params))
    } else if (!readOnly.value) {
      // Model without revisions: seed the editor from the Global Model.
      localParams.value = await store.fetchGlobalTemplateParams()
    }
    // Legacy revisions predate BaseLimit; show the effective default so the
    // admin always sees a concrete value rather than a blank field.
    const lc = getLimitCoefficient()
    if (lc && lc['BaseLimit'] === undefined) lc['BaseLimit'] = 5_000_000
  } catch {
    toast.add({ severity: 'error', summary: t('scoringModel.loadFailed'), life: 3000 })
  }
}

onMounted(load)
watch(
  () => route.fullPath,
  () => {
    if (route.name === 'scoring-model-detail' || route.name === 'scoring-model-revision') load()
  },
)

const isActive = computed(() => store.revision != null && store.history[0]?.id === store.revision.id)

async function makeGlobal() {
  if (!store.model) return
  const name = store.model.name
  if (!store.models.length) await store.fetchModels().catch(() => {})
  const current = store.models.find((m) => m.isGlobal)
  confirm.require({
    message: t('scoringModel.makeGlobalConfirm', { name, current: current?.name ?? '—' }),
    header: t('scoringModel.makeGlobal'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('scoringModel.makeGlobal'), severity: 'danger' },
    accept: async () => {
      try {
        await store.setGlobal(modelId.value)
        toast.add({
          severity: 'success',
          summary: t('scoringModel.makeGlobalSuccess', { name }),
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

function openSaveDialog() {
  saveName.value = store.revision?.name ?? store.model?.name ?? ''
  saveVersion.value = store.revision?.version ?? ''
  saveError.value = ''
  showSaveDialog.value = true
}

async function confirmSave() {
  if (!localParams.value || !saveName.value || !saveVersion.value) return
  saveError.value = ''
  const baseLimit = getLimitCoefficient()?.['BaseLimit']
  if (typeof baseLimit !== 'number' || baseLimit <= 0) {
    saveError.value = t('scoringModel.baseLimitRequired')
    return
  }
  try {
    await store.save(modelId.value, saveName.value, saveVersion.value, localParams.value)
    showSaveDialog.value = false
    toast.add({ severity: 'success', summary: t('scoringModel.saved'), life: 2000 })
    if (readOnly.value) router.push(`/scoring-model/${modelId.value}`)
  } catch (e) {
    if ((e as Error).message === 'version_taken') {
      saveError.value = t('scoringModel.versionTaken')
    } else {
      toast.add({ severity: 'error', summary: t('scoringModel.saveFailed'), life: 3000 })
    }
  }
}

// ── Section accessors ─────────────────────────────────────────────────────────

function getStopFactors() {
  if (!localParams.value) return []
  const sf = (localParams.value as Record<string, unknown>)['StopFactors'] as Record<string, unknown> | undefined
  if (!sf) return []
  return Object.entries(sf).map(([key, data]) => ({
    key,
    data: data as Record<string, unknown>,
  }))
}

function getCriteria() {
  if (!localParams.value) return []
  const sp = (localParams.value as Record<string, unknown>)['ScoringParams'] as Record<string, unknown> | undefined
  if (!sp) return []
  return Object.entries(sp).map(([key, data]) => ({
    key,
    data: data as Record<string, unknown>,
  }))
}

function getLimitCoefficient(): Record<string, unknown> | null {
  if (!localParams.value) return null
  return ((localParams.value as Record<string, unknown>)['LimitCoefficient'] as Record<string, unknown>) ?? null
}

// ── Criterion helpers ─────────────────────────────────────────────────────────

function criterionName(key: string, data: Record<string, unknown>): string {
  return (data['Name'] as string | undefined) ?? key
}

function isRangeBased(data: Record<string, unknown>): boolean {
  return Array.isArray(data['Ranges'])
}

function isEnumBased(data: Record<string, unknown>): boolean {
  return (
    typeof data['Categories'] === 'object' &&
    data['Categories'] !== null &&
    !Array.isArray(data['Categories'])
  )
}

function isPassportData(key: string): boolean {
  return key === 'PassportData'
}

function bandFrom(band: Record<string, unknown>): number | null {
  return band['From'] as number ?? null
}

function bandTo(band: Record<string, unknown>): number | null {
  return (band['To'] as number | null | undefined) ?? null
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
        <button
          v-if="readOnly"
          class="back-btn"
          @click="router.push(`/scoring-model/${modelId}`)"
        >
          <i class="pi pi-arrow-left" /> {{ t('scoringModel.backToModel') }}
        </button>
        <button v-else class="back-btn" @click="router.push('/scoring-model')">
          <i class="pi pi-arrow-left" /> {{ t('scoringModel.backToList') }}
        </button>
        <div v-if="store.model" class="title-row">
          <h1 class="page-title">{{ store.model.name }}</h1>
          <span v-if="store.model.isGlobal" class="global-badge">{{ t('scoringModel.global') }}</span>
          <template v-if="store.revision">
            <span class="ver-chip">v{{ store.revision.version }}</span>
            <span v-if="isActive" class="active-badge">{{ t('scoringModel.active') }}</span>
            <span class="rev-id">#{{ store.revision.id }}</span>
          </template>
          <span v-if="readOnly" class="readonly-badge">{{ t('scoringModel.viewingRevision') }}</span>
        </div>
      </div>
      <div class="header-actions">
        <button
          v-if="!readOnly && store.model && !store.model.isGlobal"
          class="btn-secondary"
          :disabled="!store.history.length"
          :title="!store.history.length ? t('scoringModel.noRevisionsYet') : undefined"
          @click="makeGlobal"
        >
          <i class="pi pi-globe" /> {{ t('scoringModel.makeGlobal') }}
        </button>
        <button class="btn-primary" :disabled="store.saving || !localParams" @click="openSaveDialog">
          <i class="pi pi-plus" />
          {{ store.saving ? '…' : t(readOnly ? 'scoringModel.restoreRevision' : 'scoringModel.saveRevision') }}
        </button>
      </div>
    </div>

    <div v-if="store.loading" class="loading-state">
      <i class="pi pi-spin pi-spinner" /> {{ t('common.loading') }}
    </div>

    <template v-else-if="localParams">

      <!-- ── Stop Factors ─────────────────────────────────────────────────── -->
      <div v-if="getStopFactors().length" class="section-card">
        <div class="section-header">
          <div>
            <h2 class="section-title">{{ t('scoringModel.stopFactors') }}</h2>
            <p class="section-subtitle">{{ t('scoringModel.stopFactorsSubtitle') }}</p>
          </div>
        </div>
        <table class="crit-table">
          <thead>
            <tr>
              <th class="col-key">{{ t('scoringModel.stopFactorName') }}</th>
              <th class="col-desc">{{ t('scoringModel.stopFactorCondition') }}</th>
              <th class="col-reject">{{ t('scoringModel.score') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="{ key, data } in getStopFactors()" :key="key">
              <td class="col-key">
                <span class="crit-key-badge">{{ key }}</span>
                <span class="sf-name">{{ data['Name'] as string }}</span>
              </td>
              <td class="col-desc">
                <code class="sf-match">{{ data['Match'] as string }}</code>
                <span v-if="data['Description']" class="sf-desc">{{ data['Description'] as string }}</span>
              </td>
              <td class="col-reject">
                <span v-if="data['Reject']" class="reject-chip">{{ t('scoringTry.denied') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── Scoring Parameters ──────────────────────────────────────────── -->
      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">{{ t('scoringModel.scoringParams') }}</h2>
        </div>
        <Accordion multiple>
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
                    :disabled="readOnly"
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
                    :disabled="readOnly || data['Enabled'] === false"
                  />
                </div>
              </div>
            </AccordionHeader>

            <AccordionContent>
              <!-- Range-based -->
              <template v-if="isRangeBased(data)">
                <table class="crit-table">
                  <thead>
                    <tr>
                      <th class="col-desc">{{ t('scoringModel.description') }}</th>
                      <th class="col-range">{{ t('scoringModel.range') }}</th>
                      <th class="col-score">{{ t('scoringModel.score') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(band, i) in (data['Ranges'] as Record<string, unknown>[])" :key="i">
                      <td class="col-desc">{{ bandDescription(band) }}</td>
                      <td class="col-range">
                        <span class="range-val">{{ bandFrom(band) }}</span>
                        <span class="range-sep">—</span>
                        <span class="range-val">{{ bandTo(band) ?? '∞' }}</span>
                      </td>
                      <td class="col-score">
                        <InputNumber
                          v-model="(band as Record<string, unknown>)['Score'] as number"
                          :use-grouping="false"
                          :disabled="readOnly"
                          input-class="score-input"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>

              <!-- Categorical -->
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
                      v-for="(_, catKey) in (data['Categories'] as Record<string, { Score: number }>)"
                      :key="catKey"
                    >
                      <td class="col-desc enum-key-cell">{{ catKey }}</td>
                      <td class="col-score">
                        <InputNumber
                          v-model="(data['Categories'] as Record<string, { Score: number }>)[catKey].Score"
                          :use-grouping="false"
                          :disabled="readOnly"
                          input-class="score-input"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>

              <!-- PassportData (regionMatch) -->
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
                          v-model="(data as Record<string, unknown>)['MatchScore'] as number"
                          :use-grouping="false"
                          :disabled="readOnly"
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

      <!-- ── Limit Coefficient ───────────────────────────────────────────── -->
      <div v-if="getLimitCoefficient()" class="section-card">
        <div class="section-header">
          <div>
            <h2 class="section-title">{{ t('scoringModel.limitCoefficient') }}</h2>
            <p class="section-subtitle">{{ t('scoringModel.limitCoefficientSubtitle') }}</p>
          </div>
          <div class="default-coeff-wrap">
            <span class="imp-label">{{ t('scoringModel.baseLimit') }}</span>
            <InputNumber
              v-model="(getLimitCoefficient() as Record<string, unknown>)['BaseLimit'] as number"
              :min="0" :use-grouping="true" :max-fraction-digits="0"
              :suffix="' ' + t('scoringModel.baseLimitHint')"
              :disabled="readOnly"
              input-class="imp-input"
            />
          </div>
          <div class="default-coeff-wrap">
            <span class="imp-label">{{ t('scoringModel.defaultCoefficient') }}</span>
            <InputNumber
              v-model="(getLimitCoefficient() as Record<string, unknown>)['DefaultCoefficient'] as number"
              :min="0" :max="1" :step="0.1" :max-fraction-digits="2"
              :disabled="readOnly"
              input-class="imp-input"
            />
          </div>
        </div>
        <table class="crit-table">
          <thead>
            <tr>
              <th class="col-range">{{ t('scoringModel.scoreFrom') }}</th>
              <th class="col-range">{{ t('scoringModel.scoreTo') }}</th>
              <th class="col-score">{{ t('scoringModel.coefficient') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(band, i) in ((getLimitCoefficient() as Record<string, unknown>)['Ranges'] as Record<string, unknown>[])"
              :key="i"
            >
              <td class="col-range">
                <InputNumber
                  v-model="(band as Record<string, unknown>)['From'] as number"
                  :use-grouping="false" :max-fraction-digits="0"
                  :disabled="readOnly"
                  input-class="score-input"
                />
              </td>
              <td class="col-range">
                <span v-if="band['To'] === null" class="range-val">∞</span>
                <InputNumber
                  v-else
                  v-model="(band as Record<string, unknown>)['To'] as number"
                  :use-grouping="false" :max-fraction-digits="0"
                  :disabled="readOnly"
                  input-class="score-input"
                />
              </td>
              <td class="col-score">
                <InputNumber
                  v-model="(band as Record<string, unknown>)['Coefficient'] as number"
                  :min="0" :max="1" :max-fraction-digits="2" :step="0.1"
                  :disabled="readOnly"
                  input-class="score-input"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </template>

    <div v-else class="empty-state">{{ t('scoringModel.noActiveRevision') }}</div>

    <!-- ── Revision history (model view only) ──────────────────────────────── -->
    <div v-if="!store.loading && !readOnly && store.history.length" class="section-card">
      <div class="section-header">
        <h2 class="section-title">{{ t('scoringModel.revisionHistory') }}</h2>
      </div>
      <table class="crit-table">
        <thead>
          <tr>
            <th class="col-rev-id">#</th>
            <th class="col-desc">{{ t('scoringModel.modelName') }}</th>
            <th class="col-range">{{ t('scoringModel.modelVersion') }}</th>
            <th class="col-range">{{ t('scoringModel.createdAt') }}</th>
            <th class="col-range">{{ t('scoringModel.status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(rev, i) in store.history"
            :key="rev.id"
            class="hist-row"
            @click="router.push(`/scoring-model/${modelId}/revisions/${rev.id}`)"
          >
            <td class="mono col-rev-id">{{ rev.id }}</td>
            <td class="col-desc">{{ rev.name }}</td>
            <td class="col-range"><span class="ver-chip">v{{ rev.version }}</span></td>
            <td class="col-range">{{ new Date(rev.createdAt).toLocaleDateString() }}</td>
            <td class="col-range">
              <span v-if="i === 0" class="active-badge">{{ t('scoringModel.active') }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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
        <InputText v-model="saveVersion" fluid placeholder="2.0.0" @input="saveError = ''" />
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

.global-badge {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
}

.readonly-badge {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
}

.empty-state {
  padding: 2.5rem 1.25rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.hist-row {
  cursor: pointer;
}

.col-rev-id {
  width: 56px;
  color: var(--text-secondary);
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

/* ── Section cards ───────────────────────────────────────────────────────────*/
.section-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
}

.section-title {
  font-size: 0.95rem;
  font-weight: 800;
  margin: 0;
  color: var(--text-primary);
}

.section-subtitle {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin: 0.15rem 0 0;
}

.default-coeff-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* ── Stop factor cells ───────────────────────────────────────────────────────*/
.col-key { width: 280px; }
.col-reject { width: 90px; text-align: center; }

.crit-key-badge {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 0.08rem 0.3rem;
  margin-right: 0.4rem;
  vertical-align: middle;
}

.sf-name {
  font-weight: 600;
  font-size: 0.86rem;
  vertical-align: middle;
}

.sf-match {
  font-family: monospace;
  font-size: 0.8rem;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
}

.sf-desc {
  display: block;
  font-size: 0.76rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
}

.reject-chip {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--error, #e53e3e);
  background: color-mix(in srgb, var(--error, #e53e3e) 12%, transparent);
  border-radius: 4px;
  padding: 0.1rem 0.4rem;
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
  padding: 0.45rem 1rem;
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
