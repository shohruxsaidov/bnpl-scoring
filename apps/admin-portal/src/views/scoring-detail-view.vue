<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useScoringHistoryStore, type ScoringDetail } from '@/stores/scoring-history'
import MonoAmount from '@/components/mono-amount.vue'
import KatmGauge from '@/components/katm-gauge.vue'
import KatmBadge from '@/components/katm-badge.vue'
import InpsIncomeChart from '@/components/inps-income-chart.vue'
import ModelBreakdownChart from '@/components/model-breakdown-chart.vue'

const route = useRoute()
const router = useRouter()
const store = useScoringHistoryStore()

onMounted(() => store.fetchDetail(route.params.id as string))

const detail = computed<ScoringDetail | null>(() => store.detail)
const modelExpanded = ref(false)
const inpsExpanded = ref(false)

const age = computed(() => {
  if (!detail.value?.birthDate) return null
  const birth = new Date(detail.value.birthDate)
  const today = new Date()
  let years = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--
  return years
})

const statusColor = computed(() => {
  switch (detail.value?.status) {
    case 'approved': return { color: 'var(--success)', bg: 'var(--success-bg)' }
    case 'declined': return { color: 'var(--danger)', bg: 'var(--danger-bg)' }
    default: return { color: 'var(--warning)', bg: 'var(--warning-bg)' }
  }
})

const coeffColor = computed(() => {
  const c = detail.value?.coefficient
  if (c == null || c === 0) return 'var(--danger)'
  if (c < 1) return 'var(--warning)'
  return 'var(--success)'
})

function tileColor(value: number | null | undefined, thresholds: [number, number]): string {
  if (value == null) return 'var(--text-secondary)'
  if (value <= thresholds[0]) return 'var(--success)'
  if (value <= thresholds[1]) return 'var(--warning)'
  return 'var(--danger)'
}

function tileBg(value: number | null | undefined, thresholds: [number, number]): string {
  if (value == null) return 'var(--bg-surface)'
  if (value <= thresholds[0]) return 'var(--success-bg)'
  if (value <= thresholds[1]) return 'var(--warning-bg)'
  return 'var(--danger-bg)'
}
</script>

<template>
  <div class="page">
    <div class="top-bar">
      <button class="back-link" @click="router.push({ name: 'scoring-history' })">
        <i class="pi pi-arrow-left" /> {{ $t('scoringHistory.back') }}
      </button>
      <button v-if="detail" class="btn-client-history"
        @click="router.push({ name: 'scoring-history-all', query: { pinfl: detail.pinfl } })">
        <i class="pi pi-history" />
        {{ $t('scoringHistory.clientHistory') }}
      </button>
    </div>

    <div v-if="store.loading" class="surface-card skeleton-table" />
    <div v-else-if="store.error || !detail" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ store.error ?? $t('common.noData') }}</p>
    </div>

    <template v-else>
      <!-- Header card with verdict strip -->
      <div class="header-card surface-card">
        <div class="hc-left">
          <h1 class="hc-name">{{ detail.fullName }}</h1>
          <span class="muted font-mono">{{ detail.phone }}</span>
          <span v-if="detail.merchantName" class="muted">{{ detail.merchantName }}</span>
        </div>
        <div class="verdict-strip">
          <div class="verdict-item">
            <span class="verdict-label">{{ $t('scoringHistory.status') }}</span>
            <span class="pill" :style="{ color: statusColor.color, background: statusColor.bg }">
              {{ detail.status.toUpperCase() }}
            </span>
          </div>
          <div class="verdict-divider" />
          <div class="verdict-item">
            <span class="verdict-label">{{ $t('scoringHistory.coefficient') }}</span>
            <span class="verdict-coeff font-mono" :style="{ color: coeffColor }">
              {{ detail.coefficient ?? 0 }}
            </span>
          </div>
          <div class="verdict-divider" />
          <div class="verdict-item">
            <span class="verdict-label">{{ $t('scoringHistory.limit') }}</span>
            <MonoAmount :value="detail.limit" size="sm" />
          </div>
          <div class="verdict-divider" />
          <div class="verdict-item">
            <span class="verdict-label">{{ $t('scoringHistory.totalScore') }}</span>
            <span class="verdict-score font-mono text-gradient">{{ detail.score }}</span>
          </div>
        </div>
      </div>

      <!-- Client info + KATM gauge -->
      <div class="grid-2">
        <div class="surface-card panel">
          <h2 class="panel-title">{{ $t('scoringHistory.clientInfo') }}</h2>
          <dl class="info-list">
            <div><dt>{{ $t('scoringHistory.pinfl') }}</dt><dd class="font-mono">{{ detail.pinfl }}</dd></div>
            <div><dt>{{ $t('scoringHistory.birthDate') }}</dt><dd>{{ detail.birthDate || '—' }}</dd></div>
            <div><dt>{{ $t('scoringHistory.age') }}</dt><dd>{{ age != null ? age : '—' }}</dd></div>
            <div><dt>{{ $t('scoringHistory.address') }}</dt><dd>{{ detail.address || '—' }}</dd></div>
            <div><dt>{{ $t('scoringHistory.gender') }}</dt><dd>{{ detail.gender || '—' }}</dd></div>
            <div><dt>{{ $t('scoringHistory.passport') }}</dt><dd class="font-mono">{{ detail.passport }}</dd></div>
          </dl>
        </div>

        <div v-if="detail.katmData" class="surface-card panel">
          <h2 class="panel-title">KATM</h2>
          <div class="katm-visual-row">
            <KatmGauge
              v-if="detail.katmData.katmScore != null"
              :score="detail.katmData.katmScore"
            />
            <KatmBadge
              v-if="detail.katmData.katmClass"
              :katm-class="detail.katmData.katmClass"
              :scoring-level="detail.katmData.scoringLevel"
            />
          </div>
          <div v-if="detail.katmData.hasCreditBan != null" class="credit-ban-row">
            <span class="muted" style="font-size:0.8rem;font-weight:600">
              {{ $t('scoringHistory.creditBan') }}
            </span>
            <span class="pill" :style="detail.katmData.hasCreditBan
              ? { color: 'var(--danger)', background: 'var(--danger-bg)' }
              : { color: 'var(--success)', background: 'var(--success-bg)' }">
              {{ detail.katmData.hasCreditBan ? $t('scoringHistory.creditBanYes') : $t('scoringHistory.creditBanNo') }}
            </span>
          </div>
        </div>
      </div>

      <!-- KATM stat tiles -->
      <div v-if="detail.katmData" class="surface-card panel">
        <h2 class="panel-title">{{ $t('scoringHistory.katmMetrics') }}</h2>
        <div class="tiles-grid">
          <div class="tile"
            :style="{ color: tileColor(detail.katmData.openCredits, [2, 5]), background: tileBg(detail.katmData.openCredits, [2, 5]) }">
            <span class="tile-val">{{ detail.katmData.openCredits ?? '—' }}</span>
            <span class="tile-lbl">{{ $t('scoringHistory.openCredits') }}</span>
          </div>
          <div class="tile"
            :style="{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }">
            <span class="tile-val">{{ detail.katmData.totalContracts ?? '—' }}</span>
            <span class="tile-lbl">{{ $t('scoringHistory.totalContracts') }}</span>
          </div>
          <div class="tile"
            :style="{ color: tileColor(detail.katmData.totalClaims, [5, 20]), background: tileBg(detail.katmData.totalClaims, [5, 20]) }">
            <span class="tile-val">{{ detail.katmData.totalClaims ?? '—' }}</span>
            <span class="tile-lbl">{{ $t('scoringHistory.totalClaims') }}</span>
          </div>
          <div class="tile"
            :style="{ color: tileColor(detail.katmData.overdueCount, [0, 2]), background: tileBg(detail.katmData.overdueCount, [0, 2]) }">
            <span class="tile-val">{{ detail.katmData.overdueCount ?? '—' }}</span>
            <span class="tile-lbl">{{ $t('scoringHistory.overdueCount') }}</span>
          </div>
          <div class="tile"
            :style="{ color: tileColor(detail.katmData.totalDebt, [0, 0]), background: tileBg(detail.katmData.totalDebt, [0, 0]) }">
            <div class="tile-val tile-val--sm">
              <MonoAmount v-if="detail.katmData.totalDebt != null" :value="detail.katmData.totalDebt" size="sm" />
              <span v-else>—</span>
            </div>
            <span class="tile-lbl">{{ $t('scoringHistory.totalDebt') }}</span>
          </div>
          <div class="tile"
            :style="{ color: tileColor(detail.katmData.overdueInOpenCredits, [0, 0]), background: tileBg(detail.katmData.overdueInOpenCredits, [0, 0]) }">
            <div class="tile-val tile-val--sm">
              <MonoAmount v-if="detail.katmData.overdueInOpenCredits != null" :value="detail.katmData.overdueInOpenCredits" size="sm" />
              <span v-else>—</span>
            </div>
            <span class="tile-lbl">{{ $t('scoringHistory.overdueInOpenCredits') }}</span>
          </div>
          <div class="tile"
            :style="{ color: tileColor(detail.katmData.maxOverdueDays, [0, 29]), background: tileBg(detail.katmData.maxOverdueDays, [0, 29]) }">
            <span class="tile-val">{{ detail.katmData.maxOverdueDays ?? '—' }}</span>
            <span class="tile-lbl">{{ $t('scoringHistory.maxOverdueDays') }}</span>
          </div>
          <div class="tile" style="color:var(--text-secondary);background:var(--bg-surface)">
            <div class="tile-val tile-val--sm">
              <MonoAmount v-if="detail.katmData.avgMonthlyPayment != null" :value="detail.katmData.avgMonthlyPayment" size="sm" />
              <span v-else>—</span>
            </div>
            <span class="tile-lbl">{{ $t('scoringHistory.avgMonthlyPayment') }}</span>
          </div>
        </div>
      </div>

      <!-- INPS income -->
      <div v-if="detail.inpsData" class="surface-card panel">
        <h2 class="panel-title">{{ $t('scoringHistory.inpsTitle') }}</h2>
        <div class="inps-summary">
          <div class="model-stat">
            <span class="muted">{{ $t('scoringHistory.avgMonthlyIncome') }}</span>
            <MonoAmount v-if="detail.inpsData.avgMonthlyIncome != null" :value="detail.inpsData.avgMonthlyIncome" size="sm" />
            <span v-else class="font-mono">—</span>
          </div>
          <div class="model-stat">
            <span class="muted">{{ $t('scoringHistory.totalIncome12') }}</span>
            <MonoAmount v-if="detail.inpsData.incomesAllSumma != null" :value="detail.inpsData.incomesAllSumma" size="sm" />
            <span v-else class="font-mono">—</span>
          </div>
          <button v-if="detail.inpsData.incomes.length > 0" class="toggle-btn" @click="inpsExpanded = !inpsExpanded">
            {{ inpsExpanded ? $t('scoringHistory.collapse') : $t('scoringHistory.expand') }}
            <i :class="inpsExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
          </button>
        </div>

        <InpsIncomeChart
          v-if="detail.inpsData.incomes.length > 0"
          :incomes="detail.inpsData.incomes"
          :avg-monthly-income="detail.inpsData.avgMonthlyIncome"
          style="margin-top:1rem"
        />

        <table v-if="inpsExpanded && detail.inpsData.incomes.length > 0" class="breakdown-table" style="margin-top:1rem">
          <thead>
            <tr>
              <th>{{ $t('scoringHistory.period') }}</th>
              <th>{{ $t('scoringHistory.organization') }}</th>
              <th class="col-num">{{ $t('scoringHistory.income') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in [...detail.inpsData.incomes].sort((a, b) => b.period.localeCompare(a.period))" :key="row.period + row.org_inn">
              <td class="font-mono">{{ row.period }}</td>
              <td>{{ row.orgname }}</td>
              <td class="col-num font-mono">{{ Number(row.income_summa).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Scoring model -->
      <div v-if="detail.modelData" class="surface-card panel">
        <h2 class="panel-title">{{ $t('scoringHistory.scoringModel') }}</h2>
        <div v-if="detail.modelData.rejected" class="model-rejected">
          <span class="pill" style="color:var(--danger);background:var(--danger-bg)">{{ $t('scoringHistory.rejected') }}</span>
          <span class="model-stop-name">{{ detail.modelData.name }}</span>
        </div>
        <template v-else>
          <div class="model-summary">
            <div class="model-stat">
              <span class="muted">{{ $t('scoringHistory.totalScore') }}</span>
              <span class="font-mono" style="font-weight:800">{{ detail.modelData.totalScore }}</span>
            </div>
            <div class="model-stat">
              <span class="muted">{{ $t('scoringHistory.coefficient') }}</span>
              <span class="font-mono" :style="{ fontWeight: 800, color: coeffColor }">{{ detail.modelData.coefficient }}</span>
            </div>
            <button class="toggle-btn" @click="modelExpanded = !modelExpanded">
              {{ modelExpanded ? $t('scoringHistory.collapse') : $t('scoringHistory.expand') }}
              <i :class="modelExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
            </button>
          </div>

          <ModelBreakdownChart
            :breakdown="detail.modelData.breakdown"
            :total-score="detail.modelData.totalScore"
            style="margin-top:1rem"
          />

          <table v-if="modelExpanded" class="breakdown-table" style="margin-top:1.2rem">
            <thead>
              <tr>
                <th>{{ $t('scoringHistory.criterion') }}</th>
                <th class="col-num">{{ $t('scoringHistory.importantLevel') }}</th>
                <th class="col-num">{{ $t('scoringHistory.rawScore') }}</th>
                <th class="col-num">{{ $t('scoringHistory.weightedScore') }}</th>
                <th class="col-status">{{ $t('scoringHistory.modelStatus') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in detail.modelData.breakdown" :key="r.key" :class="{ skipped: r.skipped }">
                <td>{{ r.name }}</td>
                <td class="col-num font-mono">{{ r.importantLevel }}</td>
                <td class="col-num font-mono">{{ r.rawScore }}</td>
                <td class="col-num font-mono">{{ r.weightedScore }}</td>
                <td class="col-status">
                  <span class="pill" :style="r.skipped
                    ? { color: 'var(--text-secondary)', background: 'var(--bg-surface)' }
                    : { color: 'var(--success)', background: 'var(--success-bg)' }">
                    {{ r.skipped ? $t('scoringHistory.skipped') : $t('scoringHistory.calculated') }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.2rem; }
.top-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
}
.back-link {
  display: inline-flex; align-items: center; gap: 0.4rem; background: none; border: none;
  color: var(--text-secondary); font-weight: 700; font-size: 0.85rem; cursor: pointer; padding: 0;
}
.back-link:hover { color: var(--accent-2); }
.btn-client-history {
  display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.5rem 1rem;
  border-radius: 10px; border: 1px solid var(--border-subtle); background: var(--bg-base);
  color: var(--text-primary); font-size: 0.85rem; font-weight: 700; font-family: inherit;
  cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
}
.btn-client-history:hover { background: var(--gradient-accent); border-color: transparent; color: #fff; }

/* Header card */
.header-card {
  padding: 1.4rem 1.8rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
}
.hc-left { display: flex; flex-direction: column; gap: 0.25rem; }
.hc-name { margin: 0; font-size: 1.4rem; font-weight: 800; }

/* Verdict strip */
.verdict-strip {
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
}
.verdict-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1.2rem;
}
.verdict-label {
  font-size: 0.67rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}
.verdict-coeff { font-size: 1.1rem; font-weight: 800; }
.verdict-score { font-size: 1.3rem; font-weight: 800; }
.verdict-divider {
  width: 1px;
  height: 2.5rem;
  background: var(--border-subtle);
  flex-shrink: 0;
}

/* Layout */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; }
.panel { padding: 1.4rem 1.6rem; }
.panel-title { margin: 0 0 1rem; font-size: 1rem; font-weight: 800; }

/* KATM visual */
.katm-visual-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  margin-bottom: 0.75rem;
}
.credit-ban-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);
}

/* KATM tiles */
.tiles-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}
.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.85rem 0.5rem;
  border-radius: 10px;
  text-align: center;
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
}
.tile-val {
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.tile-val--sm { font-size: 0.95rem; }
.tile-lbl {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.8;
  line-height: 1.2;
}

/* INPS */
.inps-summary {
  display: flex;
  gap: 2rem;
  margin-bottom: 0.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-subtle);
  align-items: center;
}

/* Client info */
.info-list { display: flex; flex-direction: column; gap: 0.6rem; margin: 0; }
.info-list > div { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.info-list dt { margin: 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600; }
.info-list dd { margin: 0; font-weight: 700; font-size: 0.85rem; }

/* Model */
.model-rejected { display: flex; align-items: center; gap: 0.75rem; }
.model-stop-name { font-weight: 700; font-size: 0.9rem; }
.model-summary {
  display: flex; gap: 2rem; margin-bottom: 0.5rem; padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-subtle); align-items: center;
}
.model-stat { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.85rem; }

/* Shared */
.toggle-btn {
  margin-left: auto; display: inline-flex; align-items: center; gap: 0.35rem;
  background: none; border: 1px solid var(--border-subtle); border-radius: 8px;
  padding: 0.3rem 0.75rem; font-size: 0.8rem; font-weight: 700; font-family: inherit;
  color: var(--text-secondary); cursor: pointer; transition: all 0.15s;
}
.toggle-btn:hover { color: var(--text-primary); border-color: var(--accent-2); }
.breakdown-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.breakdown-table th {
  text-align: left; padding: 0.45rem 0.6rem; font-size: 0.72rem; font-weight: 700;
  color: var(--text-secondary); text-transform: uppercase; border-bottom: 1px solid var(--border-subtle);
}
.breakdown-table td { padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--border-subtle); font-weight: 600; }
.breakdown-table tr.skipped td { color: var(--text-secondary); }
.breakdown-table tr:last-child td { border-bottom: none; }
.col-num { text-align: right; width: 110px; }
.col-status { text-align: center; width: 140px; }

.muted { color: var(--text-secondary); }
.pill {
  display: inline-flex; align-items: center; padding: 0.2rem 0.6rem; border-radius: 999px;
  font-size: 0.72rem; font-weight: 700; white-space: nowrap;
  border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
}
.skeleton-table { height: 300px; opacity: 0.5; animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity:.5 } 50% { opacity:.25 } }
.error-state { padding: 3rem 2rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-align: center; }
.error-state i { font-size: 2.2rem; color: var(--danger); }
.error-state p { margin: 0; font-weight: 600; color: var(--text-secondary); }

@media (max-width: 900px) {
  .tiles-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 800px) {
  .grid-2 { grid-template-columns: 1fr; }
  .header-card { flex-direction: column; align-items: flex-start; }
  .verdict-strip { flex-wrap: wrap; }
}
@media (max-width: 600px) {
  .tiles-grid { grid-template-columns: repeat(2, 1fr); }
  .katm-visual-row { flex-direction: column; }
}
</style>
