<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

type BuyoutStatus = 'pending' | 'paid'

interface BuyoutRecord {
  id: number
  agentName: string
  agentPhone: string
  branch: string
  clientName: string
  clientPhone: string
  prepayment: number
  amount: number
  status: BuyoutStatus
  date: string
}

const { t } = useI18n()
const search = ref('')
const statusFilter = ref<'all' | 'pending' | 'paid'>('all')
const merchantFilter = ref('all')

const statusOptions = computed(() => [
  { label: t('buyout.allStatuses'), value: 'all' },
  { label: t('buyout.statusPending'), value: 'pending' },
  { label: t('buyout.statusPaid'), value: 'paid' },
])

const merchantOptions = computed(() => [
  { label: t('buyout.allMerchants'), value: 'all' },
  { label: 'DISKONT', value: 'DISKONT' },
  { label: 'Kiyim Olami', value: 'Kiyim Olami' },
])

const records = ref<BuyoutRecord[]>([
  { id: 9, agentName: 'Jasurbek Jumanazarov', agentPhone: '+998937444222', branch: 'DISKONT', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', prepayment: 0, amount: 11000000, status: 'pending', date: '16/05/2026' },
  { id: 8, agentName: 'Jasurbek Jumanazarov', agentPhone: '+998937444222', branch: 'DISKONT', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', prepayment: 0, amount: 11000000, status: 'pending', date: '16/05/2026' },
  { id: 7, agentName: 'Jasurbek Jumanazarov', agentPhone: '+998937444222', branch: 'DISKONT', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', prepayment: 0, amount: 11500000, status: 'pending', date: '16/05/2026' },
  { id: 6, agentName: 'Nurbek Khaydarov', agentPhone: '+998773088888', branch: 'Kiyim Olami', clientName: 'NURBEK HAYDAROV', clientPhone: '+998957708789', prepayment: 0, amount: 575000000, status: 'pending', date: '16/05/2026' },
  { id: 5, agentName: 'Nurbek Khaydarov', agentPhone: '+998773088888', branch: 'Kiyim Olami', clientName: 'NURBEK HAYDAROV', clientPhone: '+998957708789', prepayment: 0, amount: 590000000, status: 'paid', date: '16/05/2026' },
  { id: 4, agentName: 'Jasurbek Jumanazarov', agentPhone: '+998937444222', branch: 'DISKONT', clientName: 'NURILLA ABDIYEV', clientPhone: '+998909690608', prepayment: 0, amount: 44000000, status: 'pending', date: '14/05/2026' },
  { id: 3, agentName: 'Jasurbek Jumanazarov', agentPhone: '+998937444222', branch: 'DISKONT', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', prepayment: 0, amount: 11000000, status: 'pending', date: '14/05/2026' },
  { id: 2, agentName: 'Jasurbek Jumanazarov', agentPhone: '+998937444222', branch: 'DISKONT', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', prepayment: 0, amount: 13500000, status: 'pending', date: '14/05/2026' },
  { id: 1, agentName: 'Jasurbek Jumanazarov', agentPhone: '+998937444222', branch: 'DISKONT', clientName: 'SHOHRUH SAIDOV', clientPhone: '+998934244724', prepayment: 0, amount: 22000000, status: 'paid', date: '13/05/2026' },
])

const stats = computed(() => ({
  total: records.value.length,
  pending: records.value.filter((r) => r.status === 'pending').length,
  paid: records.value.filter((r) => r.status === 'paid').length,
}))

const filtered = computed(() => {
  let list = records.value
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (r) =>
        r.agentName.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        r.branch.toLowerCase().includes(q) ||
        r.agentPhone.includes(q) ||
        r.clientPhone.includes(q),
    )
  }
  if (statusFilter.value !== 'all') {
    list = list.filter((r) => r.status === statusFilter.value)
  }
  if (merchantFilter.value !== 'all') {
    list = list.filter((r) => r.branch === merchantFilter.value)
  }
  return list
})

function fmtAmount(tiyin: number) {
  return (tiyin / 100).toLocaleString('ru-RU')
}

function markPaid(id: number) {
  const rec = records.value.find((r) => r.id === id)
  if (rec) rec.status = 'paid'
}
</script>

<template>
  <div class="buyout-page">
    <!-- Stat cards -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: var(--gradient-hero)">
          <i class="pi pi-file" />
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">{{ $t('buyout.total') }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: linear-gradient(135deg,#ff8c42,#ffb02e)">
          <i class="pi pi-clock" />
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ stats.pending }}</span>
          <span class="stat-label">{{ $t('buyout.pending') }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: linear-gradient(135deg,#00c49a,#00d4aa)">
          <i class="pi pi-check-circle" />
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ stats.paid }}</span>
          <span class="stat-label">{{ $t('buyout.paid') }}</span>
        </div>
      </div>
    </div>

    <!-- Filters + table -->
    <div class="table-card">
      <div class="toolbar">
        <div class="search-wrap">
          <i class="pi pi-search search-icon" />
          <input
            v-model="search"
            class="search-input"
            :placeholder="$t('buyout.searchPlaceholder')"
          />
        </div>
        <select v-model="statusFilter" class="filter-select">
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select v-model="merchantFilter" class="filter-select">
          <option v-for="opt in merchantOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="table-wrap">
        <table class="buyout-table">
          <thead>
            <tr>
              <th>{{ $t('buyout.id') }}</th>
              <th>{{ $t('buyout.agent') }}</th>
              <th>{{ $t('buyout.branch') }}</th>
              <th>{{ $t('buyout.client') }}</th>
              <th>{{ $t('buyout.prepayment') }}</th>
              <th>{{ $t('buyout.amount') }}</th>
              <th>{{ $t('buyout.status') }}</th>
              <th>{{ $t('buyout.date') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filtered" :key="row.id">
              <td class="id-cell">{{ row.id }}</td>
              <td>
                <div class="person-cell">
                  <span class="person-name">{{ row.agentName }}</span>
                  <span class="person-phone">{{ row.agentPhone }}</span>
                </div>
              </td>
              <td class="branch-cell">{{ row.branch }}</td>
              <td>
                <div class="person-cell">
                  <span class="person-name">{{ row.clientName }}</span>
                  <span class="person-phone">{{ row.clientPhone }}</span>
                </div>
              </td>
              <td class="mono-cell">{{ row.prepayment }}</td>
              <td class="amount-cell">
                <span class="amount-num">{{ fmtAmount(row.amount) }}</span>
                <span class="amount-unit">{{ $t('buyout.som') }}</span>
              </td>
              <td>
                <span class="status-badge" :class="row.status">
                  {{ row.status === 'paid' ? $t('buyout.statusPaid') : $t('buyout.statusPending') }}
                </span>
              </td>
              <td class="date-cell">{{ row.date }}</td>
              <td class="action-cell">
                <button
                  v-if="row.status === 'pending'"
                  class="btn-pay"
                  @click="markPaid(row.id)"
                >
                  <i class="pi pi-check-circle" />
                  {{ $t('buyout.statusPaid') }}
                </button>
                <button v-else class="btn-paid" disabled>
                  <i class="pi pi-check-circle" />
                  {{ $t('buyout.statusPaid') }}
                </button>
              </td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td colspan="9" class="empty-row">{{ $t('buyout.noData') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.buyout-page {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

/* Stat grid */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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
.filter-select {
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
.filter-select:focus {
  border-color: var(--accent-2);
}

/* Table */
.table-wrap {
  overflow-x: auto;
}
.buyout-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.buyout-table thead th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
  white-space: nowrap;
}
.buyout-table tbody tr {
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.1s;
}
.buyout-table tbody tr:last-child {
  border-bottom: none;
}
.buyout-table tbody tr:hover {
  background: var(--bg-base);
}
.buyout-table td {
  padding: 0.75rem 1rem;
  vertical-align: middle;
}

/* Cells */
.id-cell {
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.82rem;
}
.person-cell {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.person-name {
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--text-primary);
}
.person-phone {
  font-size: 0.76rem;
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
}
.branch-cell {
  font-weight: 600;
  color: var(--text-primary);
}
.mono-cell {
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-secondary);
}
.amount-cell {
  white-space: nowrap;
}
.amount-num {
  font-weight: 800;
  font-size: 0.92rem;
  color: var(--text-primary);
}
.amount-unit {
  font-size: 0.76rem;
  color: var(--text-secondary);
  margin-left: 0.25rem;
  font-weight: 600;
}

/* Status badges */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.65rem;
  border-radius: 7px;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}
.status-badge.pending {
  background: rgba(255, 140, 66, 0.18);
  color: #ff8c42;
}
.status-badge.paid {
  background: rgba(0, 212, 170, 0.18);
  color: #00d4aa;
}

/* Action buttons */
.action-cell {
  text-align: right;
}
.btn-pay {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.85rem;
  border-radius: 8px;
  border: none;
  background: rgba(0, 212, 170, 0.18);
  color: #00d4aa;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-pay:hover {
  background: rgba(0, 212, 170, 0.32);
}
.btn-paid {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.85rem;
  border-radius: 8px;
  border: none;
  background: rgba(0, 212, 170, 0.08);
  color: rgba(0, 212, 170, 0.45);
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: default;
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
