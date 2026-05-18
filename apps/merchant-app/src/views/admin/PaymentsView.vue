<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

type PaymentStatus = 'confirmed' | 'pending' | 'cancelled'
type PaymentType = 'cash' | 'card' | 'transfer'
type TabKey = 'all' | 'manual' | 'scheduled'

interface Payment {
  id: string
  clientName: string
  clientPhone: string
  contractId: string
  amount: number
  type: PaymentType
  status: PaymentStatus
  date: string
}

const { t } = useI18n()
const activeTab = ref<TabKey>('all')
const search = ref('')
const statusFilter = ref<'all' | PaymentStatus>('all')

const tabs = computed<{ key: TabKey; label: string; icon: string }[]>(() => [
  { key: 'all', label: t('payments.tabAll'), icon: 'pi pi-credit-card' },
  { key: 'manual', label: t('payments.tabManual'), icon: 'pi pi-pen-to-square' },
  { key: 'scheduled', label: t('payments.tabScheduled'), icon: 'pi pi-calendar' },
])

const statusOptions = computed(() => [
  { label: t('payments.all'), value: 'all' },
  { label: t('payments.statusConfirmed'), value: 'confirmed' },
  { label: t('payments.statusPending'), value: 'pending' },
  { label: t('payments.statusCancelled'), value: 'cancelled' },
])

const typeLabels = computed<Record<PaymentType, string>>(() => ({
  cash: t('payments.typeCash'),
  card: t('payments.typeCard'),
  transfer: t('payments.typeTransfer'),
}))

const payments = ref<Payment[]>([])

const dialogOpen = ref(false)
const form = ref({
  contractSearch: '',
  amount: '',
  paymentType: 'МИБ',
  note: '',
})
const paymentTypeOptions = ['МИБ', 'Наличные', 'Карта', 'Перевод']

function openDialog() {
  form.value = { contractSearch: '', amount: '', paymentType: 'МИБ', note: '' }
  dialogOpen.value = true
}

function closeDialog() {
  dialogOpen.value = false
}

function submitPayment() {
  // TODO: POST /api/payments/manual
  closeDialog()
}

const stats = computed(() => ({
  total: payments.value.length,
  confirmed: payments.value.filter((p) => p.status === 'confirmed').length,
  pending: payments.value.filter((p) => p.status === 'pending').length,
  totalAmount: payments.value.reduce((s, p) => s + p.amount, 0),
}))

const filtered = computed(() => {
  let list = payments.value

  if (activeTab.value === 'manual') {
    list = list.filter((p) => p.type === 'cash' || p.type === 'card')
  } else if (activeTab.value === 'scheduled') {
    list = list.filter((p) => p.type === 'transfer')
  }

  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (p) =>
        p.clientName.toLowerCase().includes(q) ||
        p.contractId.toLowerCase().includes(q) ||
        String(p.amount).includes(q),
    )
  }

  if (statusFilter.value !== 'all') {
    list = list.filter((p) => p.status === statusFilter.value)
  }

  return list
})

function fmtAmount(tiyin: number) {
  return (tiyin / 100).toLocaleString('ru-RU')
}
</script>

<template>
  <div class="payments-page">
    <!-- Stat cards -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: var(--gradient-hero)">
          <i class="pi pi-credit-card" />
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">{{ $t('payments.totalPayments') }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: linear-gradient(135deg,#00c49a,#00d4aa)">
          <i class="pi pi-check-circle" />
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ stats.confirmed }}</span>
          <span class="stat-label">{{ $t('payments.confirmed') }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: linear-gradient(135deg,#ff8c42,#ffb02e)">
          <i class="pi pi-clock" />
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ stats.pending }}</span>
          <span class="stat-label">{{ $t('payments.pending') }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: linear-gradient(135deg,#7b68ee,#9d4edd)">
          <i class="pi pi-chart-line" />
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ fmtAmount(stats.totalAmount) }} {{ $t('payments.som') }}</span>
          <span class="stat-label">{{ $t('payments.totalAmount') }}</span>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-row">
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <i :class="tab.icon" />
          {{ tab.label }}
        </button>
      </div>
      <button v-if="activeTab === 'manual'" class="btn-add-payment" @click="openDialog">
        <i class="pi pi-plus" />
        {{ $t('payments.addPayment') }}
      </button>
    </div>

    <!-- Table card -->
    <div class="table-card">
      <div class="toolbar">
        <div class="search-wrap">
          <i class="pi pi-search search-icon" />
          <input
            v-model="search"
            class="search-input"
            :placeholder="$t('payments.searchPlaceholder')"
          />
        </div>
        <select v-model="statusFilter" class="filter-select">
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="table-wrap">
        <table class="payments-table">
          <thead>
            <tr>
              <th>{{ $t('payments.id') }}</th>
              <th>{{ $t('payments.client') }}</th>
              <th>{{ $t('payments.contract') }}</th>
              <th>{{ $t('payments.amount') }}</th>
              <th>{{ $t('payments.type') }}</th>
              <th>{{ $t('payments.status') }}</th>
              <th>{{ $t('payments.date') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filtered" :key="row.id">
              <td class="id-cell">{{ row.id }}</td>
              <td>
                <div class="person-cell">
                  <span class="person-name">{{ row.clientName }}</span>
                  <span class="person-phone">{{ row.clientPhone }}</span>
                </div>
              </td>
              <td class="mono-cell">{{ row.contractId }}</td>
              <td class="amount-cell">
                <span class="amount-num">{{ fmtAmount(row.amount) }}</span>
                <span class="amount-unit">{{ $t('payments.som') }}</span>
              </td>
              <td>
                <span class="type-badge">{{ typeLabels[row.type] }}</span>
              </td>
              <td>
                <span class="status-badge" :class="row.status">
                  {{ row.status === 'confirmed' ? $t('payments.statusConfirmed') : row.status === 'pending' ? $t('payments.statusPending') : $t('payments.statusCancelled') }}
                </span>
              </td>
              <td class="date-cell">{{ row.date }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Empty state -->
        <div v-if="filtered.length === 0" class="empty-state">
          <i class="pi pi-credit-card" />
          <span>{{ $t('payments.notFound') }}</span>
        </div>
      </div>

      <div class="table-footer">
        {{ $t('payments.paymentsCount', { count: filtered.length }) }}
      </div>
    </div>

    <!-- Manual payment dialog -->
    <Teleport to="body">
      <Transition name="dialog-fade">
        <div v-if="dialogOpen" class="dialog-overlay" @click.self="closeDialog">
          <div class="dialog">
            <div class="dialog-header">
              <span class="dialog-title">{{ $t('payments.addManualPayment') }}</span>
              <button class="dialog-close" @click="closeDialog">
                <i class="pi pi-times" />
              </button>
            </div>

            <div class="dialog-body">
              <div class="field">
                <label class="field-label">{{ $t('payments.contractLabel') }}</label>
                <div class="field-search-wrap">
                  <i class="pi pi-search field-search-icon" />
                  <input
                    v-model="form.contractSearch"
                    class="field-input field-search"
                    :placeholder="$t('payments.contractSearch')"
                  />
                </div>
              </div>

              <div class="field">
                <label class="field-label">{{ $t('payments.amountLabel') }}</label>
                <div class="field-amount-wrap">
                  <input
                    v-model="form.amount"
                    class="field-input field-amount"
                    type="number"
                    min="0"
                    placeholder="500 000"
                  />
                  <span class="amount-suffix">{{ $t('payments.som') }}</span>
                </div>
              </div>

              <div class="field">
                <label class="field-label">{{ $t('payments.paymentType') }}</label>
                <select v-model="form.paymentType" class="field-input field-select">
                  <option v-for="opt in paymentTypeOptions" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </div>

              <div class="field">
                <label class="field-label">{{ $t('payments.note') }}</label>
                <textarea
                  v-model="form.note"
                  class="field-input field-textarea"
                  :placeholder="$t('payments.notePlaceholder')"
                  rows="3"
                />
              </div>
            </div>

            <div class="dialog-footer">
              <button class="btn-cancel" @click="closeDialog">{{ $t('common.cancel') }}</button>
              <button class="btn-submit" @click="submitPayment">{{ $t('payments.submit') }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.payments-page {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
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
  min-width: 0;
}
.stat-value {
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stat-label {
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-weight: 600;
  margin-top: 0.15rem;
}

/* Tabs row */
.tabs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.tabs {
  display: flex;
  gap: 0.4rem;
}
.btn-add-payment {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: none;
  background: var(--gradient-accent);
  color: #fff;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--accent-glow);
  transition: opacity 0.15s;
}
.btn-add-payment:hover {
  opacity: 0.88;
}
.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.tab-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}
.tab-btn.active {
  background: var(--gradient-accent);
  border-color: transparent;
  color: #fff;
  box-shadow: var(--accent-glow);
}
.tab-btn i {
  font-size: 0.9rem;
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
  width: 210px;
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
  min-height: 160px;
}
.payments-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.payments-table thead th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
  white-space: nowrap;
}
.payments-table tbody tr {
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.1s;
}
.payments-table tbody tr:last-child {
  border-bottom: none;
}
.payments-table tbody tr:hover {
  background: var(--bg-base);
}
.payments-table td {
  padding: 0.75rem 1rem;
  vertical-align: middle;
}

/* Cells */
.id-cell {
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
}
.person-cell {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.person-name {
  font-weight: 700;
  font-size: 0.88rem;
}
.person-phone {
  font-size: 0.76rem;
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
}
.mono-cell {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.82rem;
  color: var(--text-secondary);
}
.amount-cell {
  white-space: nowrap;
}
.amount-num {
  font-weight: 800;
  font-size: 0.92rem;
}
.amount-unit {
  font-size: 0.76rem;
  color: var(--text-secondary);
  margin-left: 0.25rem;
  font-weight: 600;
}
.type-badge {
  display: inline-flex;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-secondary);
}
.status-badge {
  display: inline-flex;
  padding: 0.25rem 0.65rem;
  border-radius: 7px;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}
.status-badge.confirmed {
  background: rgba(0, 212, 170, 0.15);
  color: #00d4aa;
}
.status-badge.pending {
  background: rgba(255, 140, 66, 0.15);
  color: #ff8c42;
}
.status-badge.cancelled {
  background: rgba(255, 92, 92, 0.15);
  color: #ff5c5c;
}
.date-cell {
  font-size: 0.82rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 3rem 1rem;
  color: var(--text-secondary);
  opacity: 0.5;
}
.empty-state i {
  font-size: 1.6rem;
}
.empty-state span {
  font-size: 0.88rem;
  font-weight: 600;
}

/* Footer */
.table-footer {
  padding: 0.65rem 1rem;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 600;
}

/* Dialog overlay */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.dialog {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.3rem;
  border-bottom: 1px solid var(--border-subtle);
}
.dialog-title {
  font-weight: 800;
  font-size: 1rem;
}
.dialog-close {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  transition: all 0.15s;
}
.dialog-close:hover {
  color: var(--danger);
  border-color: var(--danger);
}
.dialog-body {
  padding: 1.2rem 1.3rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.field-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
}
.field-input {
  width: 100%;
  padding: 0.6rem 0.85rem;
  border-radius: 9px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.15s;
}
.field-input:focus {
  border-color: var(--accent-2);
}
.field-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.7;
}
.field-search-wrap {
  position: relative;
}
.field-search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  font-size: 0.82rem;
}
.field-search {
  padding-left: 2.1rem;
}
.field-amount-wrap {
  position: relative;
}
.field-amount {
  padding-right: 3.2rem;
}
.amount-suffix {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  padding: 0 0.75rem;
  display: flex;
  align-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 0 9px 9px 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  pointer-events: none;
}
.field-select {
  cursor: pointer;
  appearance: auto;
}
.field-textarea {
  resize: vertical;
  min-height: 72px;
}
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.7rem;
  padding: 1rem 1.3rem;
  border-top: 1px solid var(--border-subtle);
}
.btn-cancel {
  padding: 0.55rem 1.1rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-cancel:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}
.btn-submit {
  padding: 0.55rem 1.3rem;
  border-radius: 10px;
  border: none;
  background: #00d4aa;
  color: #fff;
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-submit:hover {
  opacity: 0.85;
}

/* Transition */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.18s ease;
}
.dialog-fade-enter-active .dialog,
.dialog-fade-leave-active .dialog {
  transition: transform 0.18s ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
.dialog-fade-enter-from .dialog,
.dialog-fade-leave-to .dialog {
  transform: scale(0.95) translateY(8px);
}
</style>
