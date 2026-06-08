<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useScoringHistoryStore, type ScoringDetail } from '@/stores/scoring-history'
import MonoAmount from '@/components/mono-amount.vue'
import { formatDateTime, maskPinfl } from '@/utils/money'

const route = useRoute()
const router = useRouter()
const store = useScoringHistoryStore()

onMounted(() => store.fetchDetail(route.params.id as string))

const detail = computed<ScoringDetail | null>(() => store.detail)

const STATUS_COLORS: Record<ScoringDetail['status'], { fg: string; bg: string }> = {
  approved: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  declined: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  review: { fg: 'var(--warning)', bg: 'var(--warning-bg)' },
}
</script>

<template>
  <div class="page">
    <button class="back-link" @click="router.push({ name: 'scoring-history' })">
      <i class="pi pi-arrow-left" /> {{ $t('scoringHistory.back') }}
    </button>

    <div v-if="store.loading" class="surface-card skeleton-table" />
    <div v-else-if="store.error || !detail" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ store.error ?? $t('common.noData') }}</p>
    </div>

    <template v-else>
      <div class="header-card surface-card">
        <div class="hc-main">
          <h1 class="hc-name">{{ detail.fullName }}</h1>
          <span class="muted font-mono">{{ detail.phone }}</span>
          <span class="muted">{{ detail.merchantName }}</span>
        </div>
        <div class="hc-score">
          <span class="hc-score-val font-mono text-gradient">{{ detail.score }}</span>
          <span
            class="pill"
            :style="{ color: STATUS_COLORS[detail.status].fg, background: STATUS_COLORS[detail.status].bg }"
          >{{ $t('scoringHistory.' + detail.status) }}</span>
        </div>
      </div>

      <div class="grid-2">
        <div class="surface-card panel">
          <h2 class="panel-title">{{ $t('scoringHistory.clientInfo') }}</h2>
          <dl class="info-list">
            <div><dt>{{ $t('scoringHistory.pinfl') }}</dt><dd class="font-mono">{{ maskPinfl(detail.pinfl) }}</dd></div>
            <div><dt>{{ $t('scoringHistory.birthDate') }}</dt><dd>{{ detail.birthDate || '—' }}</dd></div>
            <div><dt>{{ $t('scoringHistory.gender') }}</dt><dd>{{ detail.gender || '—' }}</dd></div>
            <div><dt>{{ $t('scoringHistory.passport') }}</dt><dd class="font-mono">{{ detail.passport }}</dd></div>
            <div><dt>{{ $t('scoringHistory.limit') }}</dt><dd><MonoAmount :value="detail.limit" size="sm" /></dd></div>
            <div><dt>{{ $t('scoringHistory.date') }}</dt><dd>{{ formatDateTime(detail.scoredAt) }}</dd></div>
            <div v-if="detail.coefficient != null"><dt>{{ $t('scoringHistory.coefficient') }}</dt><dd class="font-mono">{{ detail.coefficient }}</dd></div>
          </dl>
        </div>

        <div class="surface-card panel">
          <h2 class="panel-title">{{ $t('scoringHistory.platformStats') }}</h2>
          <div class="stat-grid">
            <div class="stat"><span class="stat-num font-mono">{{ detail.platformStats.total }}</span><span class="stat-lbl">{{ $t('scoringHistory.statTotal') }}</span></div>
            <div class="stat"><span class="stat-num font-mono" style="color:var(--success)">{{ detail.platformStats.active }}</span><span class="stat-lbl">{{ $t('scoringHistory.statActive') }}</span></div>
            <div class="stat"><span class="stat-num font-mono">{{ detail.platformStats.closed }}</span><span class="stat-lbl">{{ $t('scoringHistory.statClosed') }}</span></div>
            <div class="stat"><span class="stat-num font-mono" style="color:var(--danger)">{{ detail.platformStats.overdue }}</span><span class="stat-lbl">{{ $t('scoringHistory.statOverdue') }}</span></div>
          </div>
          <div class="paid-row">
            <span class="muted">{{ $t('scoringHistory.totalPaid') }}</span>
            <MonoAmount :value="detail.platformStats.totalPaid" size="sm" />
          </div>
        </div>
      </div>

      <div class="surface-card panel">
        <h2 class="panel-title">{{ $t('scoringHistory.factors') }}</h2>
        <div v-if="detail.factors.length === 0" class="muted">{{ $t('common.noData') }}</div>
        <div v-else class="factors">
          <div v-for="(f, i) in detail.factors" :key="i" class="factor-row">
            <span class="factor-label">{{ f.label }}</span>
            <span class="factor-score font-mono">{{ f.score.toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.2rem; }
.back-link {
  display: inline-flex; align-items: center; gap: 0.4rem; background: none; border: none;
  color: var(--text-secondary); font-weight: 700; font-size: 0.85rem; cursor: pointer; padding: 0;
}
.back-link:hover { color: var(--accent-2); }

.header-card { padding: 1.6rem 1.8rem; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; }
.hc-main { display: flex; flex-direction: column; gap: 0.25rem; }
.hc-name { margin: 0; font-size: 1.4rem; font-weight: 800; }
.hc-score { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
.hc-score-val { font-size: 2.2rem; font-weight: 800; line-height: 1; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; }
.panel { padding: 1.4rem 1.6rem; }
.panel-title { margin: 0 0 1rem; font-size: 1rem; font-weight: 800; }

.info-list { display: flex; flex-direction: column; gap: 0.6rem; margin: 0; }
.info-list > div { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.info-list dt { margin: 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600; }
.info-list dd { margin: 0; font-weight: 700; font-size: 0.85rem; }

.stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 0.8rem; }
.stat { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.8rem 0.4rem; background: var(--bg-surface); border-radius: 10px; }
.stat-num { font-size: 1.4rem; font-weight: 800; }
.stat-lbl { font-size: 0.66rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; }
.paid-row { display: flex; align-items: center; justify-content: space-between; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-subtle); }

.factors { display: flex; flex-direction: column; gap: 0.5rem; }
.factor-row { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.8rem; background: var(--bg-surface); border-radius: 8px; }
.factor-label { font-weight: 600; font-size: 0.85rem; }
.factor-score { font-weight: 700; }

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

@media (max-width: 800px) {
  .grid-2 { grid-template-columns: 1fr; }
  .header-card { flex-direction: column; align-items: flex-start; }
  .hc-score { align-items: flex-start; }
}
@media (max-width: 600px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
