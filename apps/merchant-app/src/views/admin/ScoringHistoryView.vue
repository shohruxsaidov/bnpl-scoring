<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SkeletonStatCards from '@/components/SkeletonStatCards.vue'
import SkeletonTable from '@/components/SkeletonTable.vue'
import { usePageLoad } from '@/composables/usePageLoad'

interface ScoringRecord {
  id: string
  clientName: string
  clientPhone: string
  score: number
  limit: number
  region: string
  address: string
  date: string
  status: 'approved' | 'declined' | 'pending'
}

const router = useRouter()
const { loading } = usePageLoad()
const { t } = useI18n()
const search = ref('')
const statusFilter = ref<'all' | 'approved' | 'declined'>('all')

const statusOptions = computed(() => [
  { label: t('scoringHistory.all'), value: 'all' },
  { label: t('scoringHistory.approved'), value: 'approved' },
  { label: t('scoringHistory.declined'), value: 'declined' },
])

const records = ref<ScoringRecord[]>([
  { id: 'PROC-20260516-2646', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', score: 625, limit: 150000000, region: '', address: '', date: '16/05/2026', status: 'pending' },
  { id: 'PROC-20260516-6410', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', score: 625, limit: 170000000, region: '', address: '', date: '16/05/2026', status: 'pending' },
  { id: 'PROC-20260516-7251', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', score: 625, limit: 70000000, region: '', address: '', date: '16/05/2026', status: 'pending' },
  { id: 'PROC-20260516-4120', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', score: 625, limit: 50000000, region: '', address: '', date: '16/05/2026', status: 'pending' },
  { id: 'PROC-20260516-4094', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', score: 625, limit: 60000000, region: '', address: '', date: '16/05/2026', status: 'pending' },
  { id: 'PROC-20260516-3221', clientName: 'NURBEK HAYDAROV', clientPhone: '+998957708789', score: 615, limit: 60000000, region: '', address: 'Кашкадарьинская область, Камашинский район, Бадахшон...', date: '16/05/2026', status: 'pending' },
  { id: 'PROC-20260516-8206', clientName: 'NURBEK HAYDAROV', clientPhone: '+998957708789', score: 615, limit: 100000000, region: '', address: 'Кашкадарьинская область, Камашинский район, Бадахшон...', date: '16/05/2026', status: 'pending' },
  { id: 'PROC-20260516-2060', clientName: 'NURILLA ABDIYEV', clientPhone: '+998909690608', score: 615, limit: 140000000, region: '', address: '', date: '16/05/2026', status: 'pending' },
  { id: 'PROC-20260516-1729', clientName: 'NURBEK HAYDAROV', clientPhone: '+998957708789', score: 615, limit: 90000000, region: '', address: 'Кашкадарьинская область, Камашинский район, Бадахшон...', date: '16/05/2026', status: 'pending' },
  { id: 'PROC-20260514-4599', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', score: 625, limit: 100000000, region: '', address: '', date: '14/05/2026', status: 'pending' },
  { id: 'PROC-20260514-1248', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', score: 625, limit: 50000000, region: '', address: '', date: '14/05/2026', status: 'pending' },
  { id: 'PROC-20260513-5146', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', score: 625, limit: 120000000, region: '', address: '', date: '13/05/2026', status: 'pending' },
  { id: 'PROC-20260513-2854', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', score: 625, limit: 140000000, region: '', address: '', date: '13/05/2026', status: 'pending' },
  { id: 'PROC-20260513-7574', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', score: 625, limit: 160000000, region: '', address: '', date: '13/05/2026', status: 'pending' },
  { id: 'PROC-20260513-4600', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', score: 625, limit: 130000000, region: '', address: '', date: '13/05/2026', status: 'pending' },
])

const stats = computed(() => ({
  total: records.value.length,
  approved: records.value.filter((r) => r.status === 'approved').length,
  declined: records.value.filter((r) => r.status === 'declined').length,
  avgScore: records.value.length
    ? Math.round(records.value.reduce((s, r) => s + r.score, 0) / records.value.length)
    : 0,
}))

const filtered = computed(() => {
  let list = records.value
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (r) =>
        r.clientName.toLowerCase().includes(q) ||
        r.clientPhone.includes(q) ||
        r.id.toLowerCase().includes(q),
    )
  }
  if (statusFilter.value !== 'all') {
    list = list.filter((r) => r.status === statusFilter.value)
  }
  return list
})

function fmtLimit(tiyin: number) {
  return (tiyin / 100).toLocaleString('ru-RU')
}

function scoreColor(score: number) {
  if (score >= 620) return '#00d4aa'
  if (score >= 550) return '#ffb02e'
  return '#ff5c5c'
}

function scorePercent(score: number) {
  return Math.min(100, Math.round((score / 850) * 100))
}

function recalculate() {
  // TODO: POST /api/scoring/recalculate
}

function openDetail(id: string) {
  router.push({ name: 'admin-scoring-history-detail', params: { id } })
}
</script>

<template>
  <div class="scoring-page">
    <template v-if="loading">
      <SkeletonStatCards :count="4" />
      <SkeletonTable :rows="10" :cols="6" :has-actions="false" :has-header="true" />
    </template>
    <template v-else>
    <!-- Recalculate -->
    <div class="page-actions">
      <button class="btn-recalc" @click="recalculate">
        <i class="pi pi-refresh" />
        {{ $t('scoringHistory.recalculate') }}
      </button>
    </div>

    <!-- Stat cards -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: var(--gradient-hero)">
          <i class="pi pi-bolt" />
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">{{ $t('scoringHistory.totalRequests') }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: linear-gradient(135deg,#00c49a,#00d4aa)">
          <i class="pi pi-arrow-up-right" />
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ stats.approved }}</span>
          <span class="stat-label">{{ $t('scoringHistory.approved') }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: linear-gradient(135deg,#ff8c42,#ffb02e)">
          <i class="pi pi-exclamation-triangle" />
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ stats.declined }}</span>
          <span class="stat-label">{{ $t('scoringHistory.declined') }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: linear-gradient(135deg,#f5a623,#ffb02e)">
          <i class="pi pi-chart-bar" />
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ stats.avgScore }}</span>
          <span class="stat-label">{{ $t('scoringHistory.avgScore') }}</span>
        </div>
      </div>
    </div>

    <!-- Table card -->
    <div class="table-card">
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="search-wrap">
          <i class="pi pi-search search-icon" />
          <input
            v-model="search"
            class="search-input"
            :placeholder="$t('scoringHistory.searchClient')"
          />
        </div>
        <select v-model="statusFilter" class="status-select">
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <table class="scoring-table">
          <thead>
            <tr>
              <th>{{ $t('scoringHistory.id') }}</th>
              <th>{{ $t('scoringHistory.client') }}</th>
              <th>{{ $t('scoringHistory.limit') }}</th>
              <th>{{ $t('scoringHistory.score') }}</th>
              <th>{{ $t('scoringHistory.region') }}</th>
              <th>{{ $t('scoringHistory.address') }}</th>
              <th>{{ $t('scoringHistory.date') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filtered" :key="row.id" class="clickable-row" @click="openDetail(row.id)">
              <td class="id-cell">{{ row.id }}</td>
              <td>
                <div class="client-cell">
                  <div class="score-badge" :style="{ background: scoreColor(row.score) }">
                    {{ row.score }}
                  </div>
                  <div class="client-info">
                    <span class="client-name">{{ row.clientName }}</span>
                    <span class="client-phone">{{ row.clientPhone }}</span>
                  </div>
                </div>
              </td>
              <td class="limit-cell">{{ fmtLimit(row.limit) }}</td>
              <td>
                <div class="score-cell">
                  <div class="score-bar-track">
                    <div
                      class="score-bar-fill"
                      :style="{ width: scorePercent(row.score) + '%', background: scoreColor(row.score) }"
                    />
                  </div>
                  <span class="score-num">{{ row.score }}</span>
                </div>
              </td>
              <td class="muted-cell">{{ row.region || '—' }}</td>
              <td class="address-cell">{{ row.address || '—' }}</td>
              <td class="date-cell">{{ row.date }}</td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td colspan="7" class="empty-row">{{ $t('scoringHistory.noData') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.scoring-page {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.page-actions {
  display: flex;
  justify-content: flex-end;
}
.btn-recalc {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.1rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-family: inherit;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-recalc:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}

/* Stat grid */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}
.stat-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.1rem 1.3rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.stat-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: #fff;
  font-size: 1.1rem;
}
.stat-body {
  display: flex;
  flex-direction: column;
}
.stat-value {
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1.1;
  color: var(--text-primary);
}
.stat-label {
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-weight: 600;
  margin-top: 0.15rem;
}

/* Table card */
.table-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.8rem;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
}
.search-wrap {
  position: relative;
}
.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  font-size: 0.85rem;
}
.search-input {
  padding: 0.45rem 0.75rem 0.45rem 2rem;
  border-radius: 9px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.85rem;
  width: 200px;
  outline: none;
  transition: border-color 0.15s;
}
.search-input:focus {
  border-color: var(--accent-2);
}
.search-input::placeholder {
  color: var(--text-secondary);
}
.status-select {
  padding: 0.45rem 0.75rem;
  border-radius: 9px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.85rem;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}
.status-select:focus {
  border-color: var(--accent-2);
}

/* Table */
.table-wrap {
  overflow-x: auto;
}
.scoring-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.scoring-table thead th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
  white-space: nowrap;
}
.scoring-table tbody tr {
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.1s;
}
.scoring-table tbody tr:last-child {
  border-bottom: none;
}
.scoring-table tbody tr.clickable-row {
  cursor: pointer;
}
.scoring-table tbody tr:hover {
  background: var(--bg-base);
}
.scoring-table td {
  padding: 0.75rem 1rem;
  vertical-align: middle;
}

/* Cells */
.id-cell {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem;
  color: var(--text-secondary);
  white-space: nowrap;
}
.client-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.score-badge {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 800;
  font-size: 0.78rem;
  flex-shrink: 0;
}
.client-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.client-name {
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--text-primary);
}
.client-phone {
  font-size: 0.76rem;
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
}
.limit-cell {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  white-space: nowrap;
}
.score-cell {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.score-bar-track {
  width: 80px;
  height: 6px;
  border-radius: 999px;
  background: var(--border-subtle);
  overflow: hidden;
  flex-shrink: 0;
}
.score-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}
.score-num {
  font-weight: 700;
  font-size: 0.88rem;
}
.muted-cell {
  color: var(--text-secondary);
}
.address-cell {
  color: var(--text-secondary);
  font-size: 0.82rem;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.date-cell {
  font-size: 0.82rem;
  color: var(--text-secondary);
  white-space: nowrap;
}
.empty-row {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
</style>
