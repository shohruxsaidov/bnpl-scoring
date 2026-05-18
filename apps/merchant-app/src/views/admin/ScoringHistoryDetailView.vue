<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const id = computed(() => route.params.id as string)

interface SessionStep {
  label: string
  date: string
  time: string
  code: string
}

interface ScoreFactor {
  label: string
  score: number
  max: number
  color: string
}

const detail = computed(() => ({
  id: id.value,
  fullName: "SAIDOV SHOHRUH ABDULLA O'G'LI",
  firstName: 'SHOHRUH',
  lastName: 'SAIDOV',
  patronymic: "ABDULLA O'G'LI",
  phone: '+998934244724',
  score: 625,
  limit: 150000000,
  status: 'review' as const,
  date: '16/05/2026, 14:08',
  pinfl: '31909975580035',
  birthDate: '19/09/1997',
  gender: '',
  region: '',
  address: '',
  passport: 'AD6423999',
  citizenship: "O'zbekiston",
  platformStats: {
    total: 71,
    active: 54,
    closed: 0,
    overdue: 0,
    totalPaid: 0,
  },
}))

const sessionSteps = computed<SessionStep[]>(() => [
  { label: t('scoringDetail.waitingScore'), date: '16/05/2026', time: '14:08:54', code: '625' },
  { label: t('scoringDetail.underReview'), date: '16/05/2026', time: '14:08:54', code: '' },
])

const scoreFactors: ScoreFactor[] = [
  { label: 'Yosh', score: 150, max: 150, color: '#7b68ee' },
  { label: 'Daromad', score: 250, max: 250, color: '#00c49a' },
  { label: 'KATM reyting', score: 125, max: 250, color: '#4a9eff' },
  { label: 'Ish staji', score: 0, max: 200, color: '#9898bb' },
  { label: "To'lov tarixi", score: 100, max: 150, color: '#ff6b6b' },
]

const totalScore = computed(() => scoreFactors.reduce((s, f) => s + f.score, 0))
const totalMax = computed(() => scoreFactors.reduce((s, f) => s + f.max, 0))

function fmtLimit(tiyin: number) {
  return (tiyin / 100).toLocaleString('ru-RU')
}

function scoreColor(score: number) {
  if (score >= 620) return '#00d4aa'
  if (score >= 550) return '#ffb02e'
  return '#ff5c5c'
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    review: t('scoringDetail.statusReview'),
    approved: t('scoringDetail.statusApproved'),
    declined: t('scoringDetail.statusDeclined'),
  }
  return map[s] ?? s
}
</script>

<template>
  <div class="detail-page">
    <!-- Back link -->
    <button class="back-link" @click="router.push({ name: 'admin-scoring-history' })">
      <i class="pi pi-arrow-left" />
      {{ $t('scoringDetail.backToList') }}
    </button>

    <!-- Hero card -->
    <div class="hero-card">
      <div class="hero-left">
        <div class="hero-badge" :style="{ background: scoreColor(detail.score) }">
          {{ detail.score }}
        </div>
        <div class="hero-client">
          <span class="hero-name">{{ detail.fullName }}</span>
          <span class="hero-phone">{{ detail.phone }}</span>
        </div>
      </div>
      <div class="hero-right">
        <div class="hero-stat">
          <span class="hs-label">{{ $t('scoringDetail.score') }}</span>
          <span class="hs-value">{{ detail.score }}</span>
        </div>
        <div class="hero-divider" />
        <div class="hero-stat">
          <span class="hs-label">{{ $t('scoringDetail.limit') }}</span>
          <span class="hs-value limit-val">{{ fmtLimit(detail.limit) }}</span>
        </div>
        <div class="hero-divider" />
        <div class="hero-stat">
          <span class="hs-label">{{ $t('scoringDetail.status') }}</span>
          <span class="status-badge" :class="detail.status">{{ statusLabel(detail.status) }}</span>
        </div>
        <div class="hero-divider" />
        <div class="hero-stat">
          <span class="hs-label">{{ $t('scoringDetail.date') }}</span>
          <span class="hs-value">{{ detail.date }}</span>
        </div>
      </div>
    </div>

    <!-- Scoring session -->
    <div class="section-card">
      <div class="section-head">
        <span class="section-title">{{ $t('scoringDetail.scoringSession') }}</span>
        <div class="section-actions">
          <button class="btn-info">{{ $t('scoringDetail.detailedInfo') }}</button>
          <button class="btn-katm">{{ $t('scoringDetail.katm') }}</button>
        </div>
      </div>
      <table class="session-table">
        <thead>
          <tr>
            <th>{{ $t('scoringDetail.sequence') }}</th>
            <th>{{ $t('scoringDetail.dateCol') }}</th>
            <th>{{ $t('scoringDetail.timeCol') }}</th>
            <th>{{ $t('scoringDetail.codeCol') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(step, i) in sessionSteps" :key="i">
            <td>{{ step.label }}</td>
            <td>{{ step.date }}</td>
            <td class="mono-cell">{{ step.time }}</td>
            <td class="mono-cell">{{ step.code || '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Score distribution -->
    <div class="section-card">
      <div class="section-head">
        <span class="section-title">{{ $t('scoringDetail.scoreDistribution') }}</span>
      </div>
      <div class="score-factors">
        <div v-for="factor in scoreFactors" :key="factor.label" class="factor-row">
          <span class="factor-label">{{ factor.label }}</span>
          <div class="factor-bar-track">
            <div
              class="factor-bar-fill"
              :style="{
                width: factor.max > 0 ? (factor.score / factor.max) * 100 + '%' : '0%',
                background: factor.color,
              }"
            />
          </div>
          <span class="factor-score">{{ factor.score }}/{{ factor.max }}</span>
        </div>
        <div class="factor-total">
          <span class="total-label">{{ $t('scoringDetail.total') }}</span>
          <span class="total-value">{{ totalScore }} / {{ totalMax }}</span>
        </div>
      </div>
    </div>

    <!-- Personal data -->
    <div class="section-card">
      <div class="section-head">
        <span class="section-title">{{ $t('scoringDetail.personalData') }}</span>
      </div>
      <div class="personal-grid">
        <div class="pd-row">
          <div class="pd-item">
            <span class="pd-label">{{ $t('scoringDetail.firstName') }}</span>
            <span class="pd-value bold">{{ detail.firstName }}</span>
          </div>
          <div class="pd-item">
            <span class="pd-label">{{ $t('scoringDetail.lastName') }}</span>
            <span class="pd-value bold">{{ detail.lastName }}</span>
          </div>
        </div>
        <div class="pd-row">
          <div class="pd-item">
            <span class="pd-label">{{ $t('scoringDetail.patronymic') }}</span>
            <span class="pd-value bold">{{ detail.patronymic }}</span>
          </div>
          <div class="pd-item">
            <span class="pd-label">{{ $t('scoringDetail.pinfl') }}</span>
            <span class="pd-value bold mono-cell">{{ detail.pinfl }}</span>
          </div>
        </div>
        <div class="pd-row">
          <div class="pd-item">
            <span class="pd-label">{{ $t('scoringDetail.birthDate') }}</span>
            <span class="pd-value">{{ detail.birthDate }}</span>
          </div>
          <div class="pd-item">
            <span class="pd-label">{{ $t('scoringDetail.gender') }}</span>
            <span class="pd-value muted">{{ detail.gender || '—' }}</span>
          </div>
        </div>
        <div class="pd-row">
          <div class="pd-item">
            <span class="pd-label">{{ $t('scoringDetail.region') }}</span>
            <span class="pd-value muted">{{ detail.region || '—' }}</span>
          </div>
          <div class="pd-item">
            <span class="pd-label">{{ $t('scoringDetail.address') }}</span>
            <span class="pd-value muted">{{ detail.address || '—' }}</span>
          </div>
        </div>
        <div class="pd-row">
          <div class="pd-item">
            <span class="pd-label">{{ $t('scoringDetail.passport') }}</span>
            <span class="pd-value mono-cell">{{ detail.passport }}</span>
          </div>
          <div class="pd-item">
            <span class="pd-label">{{ $t('scoringDetail.citizenship') }}</span>
            <span class="pd-value bold">{{ detail.citizenship }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Platform history -->
    <div class="section-card">
      <div class="section-head">
        <span class="section-title">{{ $t('scoringDetail.platformHistory') }}</span>
      </div>
      <div class="platform-stats">
        <div class="ps-item">
          <span class="ps-label">{{ $t('scoringDetail.totalDeals') }}</span>
          <span class="ps-value">{{ detail.platformStats.total }}</span>
        </div>
        <div class="ps-item">
          <span class="ps-label">{{ $t('scoringDetail.activeDeals') }}</span>
          <span class="ps-value">{{ detail.platformStats.active }}</span>
        </div>
        <div class="ps-item">
          <span class="ps-label">{{ $t('scoringDetail.closedDeals') }}</span>
          <span class="ps-value">{{ detail.platformStats.closed }}</span>
        </div>
        <div class="ps-item">
          <span class="ps-label">{{ $t('scoringDetail.overdueDeals') }}</span>
          <span class="ps-value">{{ detail.platformStats.overdue }}</span>
        </div>
        <div class="ps-item">
          <span class="ps-label">{{ $t('scoringDetail.totalPaid') }}</span>
          <span class="ps-value">{{ detail.platformStats.totalPaid }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Back link */
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  color: var(--accent-2);
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  width: fit-content;
  transition: opacity 0.15s;
}
.back-link:hover {
  opacity: 0.75;
}

/* Hero card */
.hero-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-left: 4px solid #00d4aa;
  border-radius: 14px;
  padding: 1.2rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}
.hero-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.hero-badge {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 800;
  font-size: 1rem;
  flex-shrink: 0;
}
.hero-client {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.hero-name {
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--text-primary);
}
.hero-phone {
  font-size: 0.82rem;
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
}
.hero-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.hero-divider {
  width: 1px;
  height: 36px;
  background: var(--border-subtle);
}
.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}
.hs-label {
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.hs-value {
  font-weight: 800;
  font-size: 0.95rem;
  color: var(--text-primary);
}
.limit-val {
  font-size: 1.1rem;
}
.status-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}
.status-badge.review {
  background: rgba(255, 140, 66, 0.18);
  color: #ff8c42;
}
.status-badge.approved {
  background: rgba(0, 212, 170, 0.18);
  color: #00d4aa;
}
.status-badge.declined {
  background: rgba(255, 92, 92, 0.18);
  color: #ff5c5c;
}

/* Section card */
.section-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.3rem;
  border-bottom: 1px solid var(--border-subtle);
}
.section-title {
  font-weight: 800;
  font-size: 0.95rem;
}
.section-actions {
  display: flex;
  gap: 0.6rem;
}
.btn-info {
  padding: 0.4rem 0.9rem;
  border-radius: 8px;
  border: none;
  background: #ff8c42;
  color: #fff;
  font-family: inherit;
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-info:hover { opacity: 0.85; }
.btn-katm {
  padding: 0.4rem 0.9rem;
  border-radius: 8px;
  border: none;
  background: var(--accent-1);
  color: #fff;
  font-family: inherit;
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-katm:hover { opacity: 0.85; }

/* Session table */
.session-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.session-table thead th {
  padding: 0.65rem 1.3rem;
  text-align: left;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
}
.session-table tbody tr {
  border-bottom: 1px solid var(--border-subtle);
}
.session-table tbody tr:last-child {
  border-bottom: none;
}
.session-table tbody tr:hover {
  background: var(--bg-base);
}
.session-table td {
  padding: 0.75rem 1.3rem;
  color: var(--text-primary);
}
.mono-cell {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.82rem;
}

/* Score factors */
.score-factors {
  padding: 1rem 1.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.factor-row {
  display: grid;
  grid-template-columns: 140px 1fr 80px;
  align-items: center;
  gap: 1rem;
}
.factor-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.factor-bar-track {
  height: 10px;
  border-radius: 999px;
  background: var(--border-subtle);
  overflow: hidden;
}
.factor-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}
.factor-score {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: right;
  font-family: 'JetBrains Mono', monospace;
}
.factor-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);
  margin-top: 0.25rem;
}
.total-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-secondary);
}
.total-value {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
}

/* Personal data */
.personal-grid {
  padding: 0.5rem 1.3rem 1rem;
  display: flex;
  flex-direction: column;
}
.pd-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--border-subtle);
}
.pd-row:last-child {
  border-bottom: none;
}
.pd-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
}
.pd-item:first-child {
  border-right: 1px solid var(--border-subtle);
  padding-right: 1.5rem;
}
.pd-item:last-child {
  padding-left: 1.5rem;
}
.pd-label {
  font-size: 0.82rem;
  color: var(--text-secondary);
  font-weight: 500;
  white-space: nowrap;
  min-width: 110px;
}
.pd-value {
  font-size: 0.88rem;
  color: var(--text-primary);
}
.pd-value.bold {
  font-weight: 700;
}
.pd-value.muted {
  color: var(--text-secondary);
}

/* Platform stats */
.platform-stats {
  display: flex;
  padding: 1rem 1.3rem;
  gap: 0;
}
.ps-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0 1rem;
  border-right: 1px solid var(--border-subtle);
}
.ps-item:first-child {
  padding-left: 0;
}
.ps-item:last-child {
  border-right: none;
}
.ps-label {
  font-size: 0.76rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.ps-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
}
</style>
