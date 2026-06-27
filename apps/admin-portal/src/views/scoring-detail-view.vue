<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useScoringsStore, type ScoringDetailPipeline } from '@/stores/scorings'
import JsonReport from '@/components/json-report/json-report.vue'
import JsonNode from '@/components/json-report/json-node.vue'
import {
  KATM_077_SECTION_KEYS,
  KATM_INPS_SECTION_KEYS,
  VENDOR_LABELS,
} from '@/components/json-report/scoring-report-config'
import { type Json, formatMoney, humanize, isObject } from '@/utils/json-report'

const route = useRoute()
const router = useRouter()
const store = useScoringsStore()
const { t, te } = useI18n()

const activeType = ref<string | null>(null)

onMounted(load)
watch(
  () => route.params.id,
  () => load(),
)

async function load() {
  await store.fetchDetail(route.params.id as string)
  activeType.value = store.detail?.pipelines[0]?.type ?? null
}

const detail = computed(() => store.detail)
const pipelines = computed(() => detail.value?.pipelines ?? [])
const activePipeline = computed(
  () => pipelines.value.find((p) => p.type === activeType.value) ?? null,
)

// ---- localized labels -------------------------------------------------------
function pipelineName(type: string): string {
  const key = `scoringPipeline.type.${type}`
  return te(key) ? t(key) : humanize(type)
}
function statusLabel(status: string): string {
  const key = `scorings.statusValue.${status}`
  return te(key) ? t(key) : status
}
function rejectLabel(code: string | null): string {
  if (!code) return ''
  const key = `scorings.rejectReason.${code}`
  return te(key) ? t(key) : code
}
function sectionTitle(key: string): string {
  const k = `scoringReport.section.${key}`
  return te(k) ? t(k) : humanize(key)
}

function statusClass(status: string): string {
  switch (status) {
    case 'passed':
    case 'scored':
      return 'pill-success'
    case 'in_progress':
    case 'pending':
      return 'pill-progress'
    case 'rejected':
      return 'pill-warn'
    case 'error':
      return 'pill-error'
    default:
      return 'pill-progress'
  }
}

// ---- formatting helpers -----------------------------------------------------
function formatScore(v: number | null): string {
  return v != null ? String(v) : '—'
}
function formatLimit(v: number | null): string {
  return v != null ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + " so'm" : '—'
}
function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

// Render a pipeline's `summary` jsonb as a strip of cards.
function summaryCards(pipeline: { type: string; summary: Record<string, unknown> | null; raw?: unknown } | null) {
  if (!pipeline?.summary) return []
  const { type, summary, raw } = pipeline
  return Object.entries(summary)
    // KATM 077: hasDefaults is redundant with the credit-ban / overdue cards.
    .filter(([key]) => !(type === 'katm_077' && key === 'hasDefaults'))
    .map(([key, value]) => {
      // KATM 077: append the scoring level (Уровень) to the class, e.g. "A1 ОТЛИЧНЫЙ".
      if (type === 'katm_077' && key === 'scoringClass') {
        const level = (raw as { scorring?: { scoring_level?: unknown } } | undefined)?.scorring
          ?.scoring_level
        const text = [value, level]
          .filter((x) => x != null && x !== '')
          .map(String)
          .join(' ')
        return { label: humanize(key), value: text || '—' }
      }
      return { label: humanize(key), value: formatSummaryValue(value) }
    })
}
function formatSummaryValue(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no')
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : '—'
  if (typeof value === 'number') {
    return Math.abs(value) >= 1000 ? formatMoney(Math.round(value)) : String(value)
  }
  return String(value)
}

// ---- KATM reports -----------------------------------------------------------
function sections(keys: string[]) {
  return keys.map((key) => ({ key, title: sectionTitle(key) }))
}
// INPS data is nested under `report`; KATM-077 is at the root.
function inpsData(raw: Record<string, unknown> | null): Json {
  const report = raw && isObject(raw.report) ? raw.report : raw
  return (report as Json) ?? {}
}

// ---- model_score breakdown --------------------------------------------------
interface BreakdownRow {
  key: string
  name: string
  skipped: boolean
  rawScore: number
  weightedScore: number
  importantLevel: number
}
function breakdownOf(p: ScoringDetailPipeline): BreakdownRow[] {
  const raw = p.raw as Json | null
  const list = raw && Array.isArray(raw.breakdown) ? (raw.breakdown as BreakdownRow[]) : []
  return list
}
function decisionLabel(decision: unknown): string {
  const key = `scoringReport.decision.${decision}`
  return te(key) ? t(key) : String(decision ?? '—')
}

function goBack() {
  router.push({ name: 'scorings' })
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <button class="btn-ghost" @click="goBack">
        <i class="pi pi-arrow-left" /> {{ t('common.back') }}
      </button>
    </div>

    <div v-if="store.detailLoading" class="loading">
      <i class="pi pi-spin pi-spinner" />
    </div>

    <div v-else-if="store.detailError" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ store.detailError }}</p>
      <button class="btn-ghost" @click="load">{{ t('common.retry') }}</button>
    </div>

    <template v-else-if="detail">
      <!-- Overview -->
      <div class="surface-card overview">
        <div class="overview-head">
          <div>
            <h1 class="page-title">{{ detail.fullName ?? t('scorings.noClient') }}</h1>
            <p v-if="detail.phone" class="page-sub font-mono">{{ detail.phone }}</p>
          </div>
          <span class="pill" :class="statusClass(detail.status)">{{ statusLabel(detail.status) }}</span>
        </div>

        <div class="overview-grid">
          <div class="ov-item">
            <span class="ov-label">{{ t('scorings.id') }}</span>
            <span class="font-mono">#{{ detail.id }}</span>
          </div>
          <div class="ov-item">
            <span class="ov-label">{{ t('scorings.score') }}</span>
            <span class="font-mono">{{ formatScore(detail.score) }}</span>
          </div>
          <div class="ov-item">
            <span class="ov-label">{{ t('scorings.creditLimit') }}</span>
            <span class="font-mono">{{ formatLimit(detail.creditLimit) }}</span>
          </div>
          <div class="ov-item">
            <span class="ov-label">{{ t('scorings.pipeline') }}</span>
            <span class="font-mono">{{ detail.currentPipeline ?? '—' }}</span>
          </div>
          <div class="ov-item">
            <span class="ov-label">{{ t('scorings.createdAt') }}</span>
            <span class="font-mono">{{ formatTimestamp(detail.createdAt) }}</span>
          </div>
          <div class="ov-item">
            <span class="ov-label">{{ t('scorings.updatedAt') }}</span>
            <span class="font-mono">{{ formatTimestamp(detail.updatedAt) }}</span>
          </div>
        </div>

        <div v-if="detail.rejectReasonCode" class="callout callout-warn">
          <i class="pi pi-ban" />
          <span>{{ t('scorings.rejectedReason') }}: <strong>{{ rejectLabel(detail.rejectReasonCode) }}</strong></span>
        </div>
      </div>

      <!-- Pipeline tabs -->
      <div v-if="pipelines.length" class="tabs">
        <button v-for="p in pipelines" :key="p.id" class="tab" :class="{ active: p.type === activeType }"
          @click="activeType = p.type">
          <span>{{ pipelineName(p.type) }}</span>
          <span class="pill pill-sm" :class="statusClass(p.status)">{{ statusLabel(p.status) }}</span>
        </button>
      </div>

      <!-- Active pipeline -->
      <div v-if="activePipeline" :key="activePipeline.id" class="pipeline-panel">
        <!-- reject / error callout -->
        <div v-if="activePipeline.rejectReasonCode" class="callout callout-warn">
          <i class="pi pi-ban" />
          <span>{{ t('scorings.rejectedReason') }}:
            <strong>{{ rejectLabel(activePipeline.rejectReasonCode) }}</strong></span>
        </div>

        <!-- summary cards (hidden on the My ID, KATM claim and KATM MIB tabs) -->
        <div
          v-if="!['myid', 'katm_claim', 'katm_mib'].includes(activePipeline.type) && summaryCards(activePipeline).length"
          class="cards">
          <div v-for="c in summaryCards(activePipeline)" :key="c.label" class="stat">
            <div class="l">{{ c.label }}</div>
            <div class="v">{{ c.value }}</div>
          </div>
        </div>

        <!-- model_score: breakdown table -->
        <div v-if="activePipeline.type === 'model_score'" class="surface-card table-card">
          <div class="model-meta">
            <span>{{ t('scoringReport.model.decision') }}:
              <strong>{{ decisionLabel((activePipeline.summary as any)?.decision) }}</strong></span>
            <span>{{ t('scoringReport.model.coefficient') }}:
              <strong>{{ (activePipeline.summary as any)?.coefficient ?? '—' }}</strong></span>
          </div>
          <table class="breakdown">
            <thead>
              <tr>
                <th>{{ t('scoringReport.model.criterion') }}</th>
                <th class="num">{{ t('scoringReport.model.rawScore') }}</th>
                <th class="num">{{ t('scoringReport.model.weightedScore') }}</th>
                <th class="num">{{ t('scoringReport.model.importance') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in breakdownOf(activePipeline)" :key="row.key" :class="{ skipped: row.skipped }">
                <td>
                  {{ row.name }}
                  <span v-if="row.skipped" class="skip-badge">{{ t('scoringReport.model.skipped') }}</span>
                </td>
                <td class="num font-mono">{{ row.skipped ? '—' : row.rawScore }}</td>
                <td class="num font-mono">{{ row.skipped ? '—' : row.weightedScore }}</td>
                <td class="num font-mono">{{ row.importantLevel }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- KATM-077 -->
        <JsonReport v-else-if="activePipeline.type === 'katm_077' && activePipeline.raw"
          :data="activePipeline.raw as Json" :sections="sections(KATM_077_SECTION_KEYS)" :labels="VENDOR_LABELS" />

        <!-- KATM-INPS (nested under report) -->
        <JsonReport v-else-if="activePipeline.type === 'katm_inps' && activePipeline.raw"
          :data="inpsData(activePipeline.raw)" :sections="sections(KATM_INPS_SECTION_KEYS)" :labels="VENDOR_LABELS" />

        <!-- myid / katm_claim — flat payloads -->
        <div v-else-if="activePipeline.raw" class="surface-card flat-card">
          <JsonNode :value="activePipeline.raw" :labels="VENDOR_LABELS" :show-meta="true" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.page-title {
  margin: 0 0 0.2rem;
  font-size: 1.4rem;
  font-weight: 800;
}

.page-sub {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.loading {
  display: grid;
  place-items: center;
  padding: 4rem;
  font-size: 1.6rem;
  color: var(--text-secondary);
}

.overview {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  padding: 1.4rem 1.6rem;
}

.overview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.9rem 1.4rem;
}

.ov-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ov-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.callout {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  font-size: 0.88rem;
}

.callout-warn {
  background: color-mix(in srgb, #f59e0b 14%, transparent);
  border: 1px solid color-mix(in srgb, #f59e0b 35%, transparent);
  color: #b45309;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.85rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-base);
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
}

.tab:hover {
  border-color: color-mix(in srgb, var(--primary, #2563eb) 40%, var(--border-subtle));
  color: var(--text-primary, inherit);
}

.tab.active {
  border-color: var(--primary, #2563eb);
  background: color-mix(in srgb, var(--primary, #2563eb) 10%, var(--bg-base));
  color: var(--primary, #2563eb);
}

.tab.active .pill-sm {
  opacity: 0.9;
}

.pipeline-panel {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.cards {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 12px 16px;
  min-width: 140px;
  flex: 1;
}

.stat .l {
  color: var(--text-secondary);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.stat .v {
  font-size: 18px;
  font-weight: 700;
  margin-top: 4px;
}

.table-card {
  padding: 1rem 1.2rem;
}

.flat-card {
  padding: 1rem 1.2rem;
}

.model-meta {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.9rem;
  font-size: 0.88rem;
  color: var(--text-secondary);
}

table.breakdown {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

table.breakdown th {
  text-align: left;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border-subtle);
}

table.breakdown td {
  padding: 0.55rem 0.6rem;
  border-bottom: 1px solid var(--border-subtle);
}

table.breakdown th.num,
table.breakdown td.num {
  text-align: right;
  white-space: nowrap;
}

tr.skipped td {
  color: var(--text-secondary);
  opacity: 0.65;
}

.skip-badge {
  margin-left: 0.5rem;
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.1rem 0.4rem;
  border-radius: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
}

.pill-sm {
  font-size: 0.64rem;
  padding: 0.1rem 0.45rem;
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
</style>
