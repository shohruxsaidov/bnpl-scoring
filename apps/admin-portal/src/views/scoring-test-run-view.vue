<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import Select from 'primevue/select'
import { useScoringModelStore } from '@/stores/scoring-model'
import { useScoringTestCasesStore, type TestRun } from '@/stores/scoring-test-cases'

const store = useScoringTestCasesStore()
const modelStore = useScoringModelStore()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()

const selectedRevisionId = ref<number | null>(null)
const run = ref<TestRun | null>(null)

const revisionOptions = computed(() =>
  modelStore.history.map((r) => ({
    label: `${r.name} · v${r.version}`,
    value: r.id,
  })),
)

onMounted(async () => {
  try {
    await modelStore.fetchHistory()
    if (modelStore.history.length) selectedRevisionId.value = modelStore.history[0].id
  } catch {
    toast.add({ severity: 'error', summary: t('scoringModel.loadFailed'), life: 3000 })
  }
})

async function runSuite() {
  if (!selectedRevisionId.value) return
  run.value = null
  try {
    run.value = await store.runSuite(selectedRevisionId.value)
  } catch {
    toast.add({ severity: 'error', summary: t('scoringTestRun.runFailed'), life: 3000 })
  }
}

function captureBaseline() {
  if (!run.value) return
  confirm.require({
    message: t('scoringTestRun.captureConfirm'),
    header: t('scoringTestRun.captureBaseline'),
    icon: 'pi pi-bookmark',
    accept: async () => {
      try {
        await store.captureBaseline(run.value!.id)
        toast.add({ severity: 'success', summary: t('scoringTestRun.captureDone'), life: 3000 })
      } catch {
        toast.add({ severity: 'error', summary: t('scoringTestRun.captureFailed'), life: 3000 })
      }
    },
  })
}

function outcomeClass(o: string) {
  if (o === 'approved') return 'badge-approved'
  if (o === 'partial')  return 'badge-partial'
  if (o === 'denied')   return 'badge-denied'
  return 'badge-rejected'
}

function outcomeLabel(o: string) {
  return t(`scoringTestCases.${o}`)
}
</script>

<template>
  <div class="run-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('scoringTestRun.title') }}</h1>
        <p class="page-subtitle">{{ t('scoringTestRun.subtitle') }}</p>
      </div>
      <button class="btn-secondary" @click="router.push('/scoring-test-cases')">
        {{ t('scoringTestRun.backToTestCases') }}
      </button>
    </div>

    <!-- Controls -->
    <div class="surface-card controls-card">
      <div class="controls-row">
        <div class="field-row">
          <label>{{ t('scoringTestRun.selectRevision') }}</label>
          <Select
            v-model="selectedRevisionId"
            :options="revisionOptions"
            option-label="label"
            option-value="value"
            :placeholder="t('scoringTestRun.revisionPlaceholder')"
            class="revision-select"
          />
        </div>
        <button
          class="btn-primary"
          :disabled="!selectedRevisionId || store.running"
          @click="runSuite"
        >
          <i v-if="store.running" class="pi pi-spin pi-spinner" />
          <i v-else class="pi pi-play" />
          {{ store.running ? t('scoringTestRun.running') : t('scoringTestRun.run') }}
        </button>
      </div>
    </div>

    <!-- Results -->
    <template v-if="run">
      <!-- Summary bar -->
      <div class="summary-bar">
        <div class="summary-item passed">
          <span class="summary-count">{{ run.passCount }}</span>
          <span class="summary-label">{{ t('scoringTestRun.passed') }}</span>
        </div>
        <div class="summary-item failed">
          <span class="summary-count">{{ run.failCount }}</span>
          <span class="summary-label">{{ t('scoringTestRun.failed') }}</span>
        </div>
        <div class="summary-item total">
          <span class="summary-count">{{ run.results.length }}</span>
          <span class="summary-label">{{ t('scoringTestCases.title') }}</span>
        </div>
        <div class="summary-spacer" />
        <button class="btn-capture" @click="captureBaseline">
          <i class="pi pi-bookmark" /> {{ t('scoringTestRun.captureBaseline') }}
        </button>
      </div>

      <!-- Results table -->
      <div class="surface-card table-card">
        <table class="results-table">
          <thead>
            <tr>
              <th class="col-result" />
              <th class="col-name">{{ t('scoringTestCases.name') }}</th>
              <th class="col-outcome">{{ t('scoringTestRun.expected') }}</th>
              <th class="col-outcome">{{ t('scoringTestRun.actual') }}</th>
              <th class="col-score">{{ t('scoringTestRun.score') }}</th>
              <th class="col-score">{{ t('scoringTestRun.coeff') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in run.results"
              :key="r.testCaseId"
              class="result-row"
              :class="{ fail: !r.pass }"
            >
              <td class="col-result">
                <span class="pass-icon" :class="r.pass ? 'pass' : 'fail'">
                  <i :class="r.pass ? 'pi pi-check' : 'pi pi-times'" />
                </span>
              </td>
              <td class="col-name">
                <span class="case-name">{{ r.name }}</span>
                <span v-if="r.stopFactor" class="stop-factor">{{ r.stopFactor }}</span>
              </td>
              <td class="col-outcome">
                <span class="outcome-badge" :class="outcomeClass(r.expectedOutcome)">
                  {{ outcomeLabel(r.expectedOutcome) }}
                </span>
              </td>
              <td class="col-outcome">
                <span class="outcome-badge" :class="outcomeClass(r.actualOutcome)">
                  {{ outcomeLabel(r.actualOutcome) }}
                </span>
              </td>
              <td class="col-score mono">{{ r.totalScore !== null ? r.totalScore.toFixed(1) : '—' }}</td>
              <td class="col-score mono">{{ r.coefficient !== null ? r.coefficient : '—' }}</td>
            </tr>
            <tr v-if="!run.results.length">
              <td colspan="6" class="state-row">{{ t('common.noData') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-else-if="!store.running" class="empty-state surface-card">
      <i class="pi pi-play-circle empty-icon" />
      <p>{{ t('scoringTestRun.noRevision') }}</p>
    </div>
  </div>
</template>

<style scoped>
.run-page {
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

/* ── Controls ───────────────────────────────────────────────────────────────*/
.controls-card { padding: 1.25rem 1.5rem; }

.controls-row {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
  min-width: 240px;
}

.field-row label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

.revision-select { width: 100%; }

/* ── Summary bar ────────────────────────────────────────────────────────────*/
.summary-bar {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  flex-wrap: wrap;
}

.summary-item {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.summary-count {
  font-size: 1.6rem;
  font-weight: 800;
  font-family: monospace;
}

.summary-label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

.summary-item.passed .summary-count { color: #22c55e; }
.summary-item.failed .summary-count { color: #ef4444; }
.summary-item.total .summary-count  { color: var(--text-primary); }

.summary-spacer { flex: 1; }

.btn-capture {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-capture:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── Results table ──────────────────────────────────────────────────────────*/
.table-card { overflow: hidden; }

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.results-table thead tr {
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-base);
}

.results-table th {
  padding: 0.65rem 1rem;
  text-align: left;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  white-space: nowrap;
}

.result-row {
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.1s;
}

.result-row:last-child { border-bottom: none; }
.result-row.fail { background: color-mix(in srgb, #ef4444 4%, transparent); }

.results-table td {
  padding: 0.75rem 1rem;
  vertical-align: middle;
}

.col-result { width: 40px; text-align: center; }
.col-name   { }
.col-outcome { width: 130px; }
.col-score  { width: 90px; text-align: right; }

.pass-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  font-size: 0.72rem;
  font-weight: 700;
}

.pass-icon.pass { background: color-mix(in srgb, #22c55e 15%, transparent); color: #22c55e; }
.pass-icon.fail { background: color-mix(in srgb, #ef4444 15%, transparent); color: #ef4444; }

.case-name {
  display: block;
  font-weight: 600;
}

.stop-factor {
  display: block;
  font-size: 0.78rem;
  color: #a855f7;
  margin-top: 0.1rem;
}

.outcome-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 5px;
}

.badge-approved { background: color-mix(in srgb, #22c55e 15%, transparent); color: #22c55e; }
.badge-partial  { background: color-mix(in srgb, #f59e0b 15%, transparent); color: #f59e0b; }
.badge-denied   { background: color-mix(in srgb, #ef4444 15%, transparent); color: #ef4444; }
.badge-rejected { background: color-mix(in srgb, #a855f7 15%, transparent); color: #a855f7; }

.mono { font-family: monospace; }

.state-row {
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

/* ── Empty state ────────────────────────────────────────────────────────────*/
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3.5rem 2rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.empty-icon {
  font-size: 2.5rem;
  color: var(--border-subtle);
}

/* ── Shared buttons ─────────────────────────────────────────────────────────*/
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.4rem;
  border-radius: 9px;
  border: none;
  background: var(--gradient-hero);
  color: #fff;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  transition: opacity 0.15s;
  box-shadow: var(--accent-glow);
  white-space: nowrap;
}

.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.2rem;
  border-radius: 9px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-secondary:hover { border-color: var(--text-secondary); color: var(--text-primary); }
</style>
