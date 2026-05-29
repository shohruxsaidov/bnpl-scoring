<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { apiFetch } from '@/utils/apiFetch'
import { formatSom, formatDate, formatDateTime } from '@/utils/money'

// ── Types ─────────────────────────────────────────────────────────────────

interface DealRow {
  id: string
  clientName: string
  clientPinfl: string
  clientPhone: string
  status: string
  amount: number
  totalPayable: number
  termMonths: number
  tariffName: string
  agentName: string
  createdAt: string
}

interface ScheduleItem {
  index: number
  dueDate: string
  amount: number
  paidAmount: number
  paid: boolean
  paidAt: string | null
}

interface DealDetail extends DealRow {
  paymentDay: number | null
  schedule: ScheduleItem[]
}

// ── State ─────────────────────────────────────────────────────────────────

const statusFilter = ref<'active' | 'overdue' | 'closed'>('active')
const search = ref('')
const deals = ref<DealRow[]>([])
const loadingDeals = ref(false)
const dealsError = ref('')

const selectedDealId = ref<string | null>(null)
const detail = ref<DealDetail | null>(null)
const loadingDetail = ref(false)

// Per-row payment state: index → { inputSom (UZS number), paying, error }
const payState = ref<Record<number, { inputSom: number; paying: boolean; error: string }>>({})

// ── Helpers ───────────────────────────────────────────────────────────────

/** tiyin → UZS number for input display */
function tiyinToSomStr(tiyin: number): number {
  return Math.round(tiyin / 100)
}

/** UZS value (string or number) → tiyin integer */
function somStrToTiyin(s: string | number): number {
  return Math.round(parseFloat(String(s).replace(/[^0-9.]/g, '') || '0') * 100)
}

function remaining(item: ScheduleItem): number {
  return item.amount - item.paidAmount
}

function progressPct(item: ScheduleItem): number {
  if (item.amount === 0) return 100
  return Math.min(100, Math.round((item.paidAmount / item.amount) * 100))
}

function initRowState(item: ScheduleItem) {
  if (!payState.value[item.index]) {
    payState.value[item.index] = {
      inputSom: tiyinToSomStr(remaining(item)),
      paying: false,
      error: '',
    }
  }
}

const today = new Date()
today.setHours(0, 0, 0, 0)

function isOverdue(item: ScheduleItem): boolean {
  return !item.paid && new Date(item.dueDate) < today
}

// ── Load deals ────────────────────────────────────────────────────────────

async function loadDeals() {
  loadingDeals.value = true
  dealsError.value = ''
  try {
    const data = await apiFetch<{ deals: DealRow[] }>(
      `/admin/deals?status=${statusFilter.value}`,
    )
    deals.value = data.deals
  } catch {
    dealsError.value = 'Ошибка загрузки сделок'
  } finally {
    loadingDeals.value = false
  }
}

watch(statusFilter, () => {
  selectedDealId.value = null
  detail.value = null
  payState.value = {}
  loadDeals()
}, { immediate: true })

// ── Load detail ───────────────────────────────────────────────────────────

async function selectDeal(id: string) {
  selectedDealId.value = id
  detail.value = null
  payState.value = {}
  loadingDetail.value = true
  try {
    const data = await apiFetch<{ deal: DealDetail }>(`/admin/deals/${id}`)
    detail.value = data.deal
    for (const item of data.deal.schedule) initRowState(item)
  } catch {
    detail.value = null
  } finally {
    loadingDetail.value = false
  }
}

// ── Pay ───────────────────────────────────────────────────────────────────

async function pay(item: ScheduleItem) {
  if (!detail.value) return
  const state = payState.value[item.index]
  if (!state) return

  const tiyin = somStrToTiyin(state.inputSom)
  const rem = remaining(item)
  if (tiyin <= 0) { state.error = 'Введите сумму > 0'; return }
  if (tiyin > rem) { state.error = `Максимум: ${formatSom(rem)}`; return }

  state.error = ''
  state.paying = true
  try {
    const data = await apiFetch<{ schedule: ScheduleItem[] }>(
      `/admin/deals/${detail.value.id}/schedule/${item.index}/pay`,
      { method: 'POST', body: JSON.stringify({ amount: tiyin }) },
    )
    detail.value.schedule = data.schedule
    // Re-init pay state for all rows with updated remaining amounts
    payState.value = {}
    for (const row of data.schedule) initRowState(row)
    loadDeals()
  } catch (err: any) {
    state.error = err.message === 'amount_exceeds_remaining'
      ? `Максимум: ${formatSom(rem)}`
      : 'Ошибка оплаты'
  } finally {
    state.paying = false
  }
}

function setMax(item: ScheduleItem) {
  const state = payState.value[item.index]
  if (state) state.inputSom = tiyinToSomStr(remaining(item))
}

// ── Derived ───────────────────────────────────────────────────────────────

const filteredDeals = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return deals.value
  return deals.value.filter(
    (d) =>
      d.clientName.toLowerCase().includes(q) ||
      d.clientPinfl.includes(q) ||
      d.clientPhone.includes(q) ||
      d.id.includes(q),
  )
})

function paidCount(d: DealDetail): number {
  return d.schedule.filter((s) => s.paid).length
}

function overdueCount(d: DealDetail): number {
  return d.schedule.filter((s) => isOverdue(s)).length
}

function totalPaid(d: DealDetail): number {
  return d.schedule.reduce((s, r) => s + r.paidAmount, 0)
}

const statusColors: Record<string, string> = {
  active: 'var(--success)',
  overdue: 'var(--warning)',
  closed: 'var(--text-secondary)',
}
</script>

<template>
  <div class="tp-layout">

    <!-- Left panel ──────────────────────────────────────────────────── -->
    <aside class="tp-list">
      <div class="tp-list-head">
        <h2>Тест оплаты</h2>
        <p class="sub">Выберите сделку — оплачивайте взносы полностью или частично</p>

        <div class="filter-row">
          <button
            v-for="s in (['active', 'overdue', 'closed'] as const)"
            :key="s"
            class="filter-btn"
            :class="{ active: statusFilter === s }"
            @click="statusFilter = s"
          >
            {{ s === 'active' ? 'Активные' : s === 'overdue' ? 'Просрочены' : 'Закрытые' }}
          </button>
        </div>

        <input
          v-model="search"
          class="search-input"
          placeholder="Клиент, ПИНФЛ, телефон…"
        />
      </div>

      <div v-if="loadingDeals" class="state-row">
        <i class="pi pi-spin pi-spinner" /> Загрузка…
      </div>
      <div v-else-if="dealsError" class="state-row state-error">
        {{ dealsError }}
        <button class="btn-ghost" @click="loadDeals">Повторить</button>
      </div>
      <div v-else-if="filteredDeals.length === 0" class="state-row">
        Нет сделок
      </div>
      <div
        v-for="d in filteredDeals"
        :key="d.id"
        class="deal-item"
        :class="{ selected: selectedDealId === d.id }"
        @click="selectDeal(d.id)"
      >
        <div class="di-top">
          <span class="di-name">{{ d.clientName }}</span>
          <span class="di-status" :style="{ color: statusColors[d.status] }">{{ d.status }}</span>
        </div>
        <div class="di-meta font-mono">
          <span>{{ d.clientPinfl }}</span>
          <span>{{ formatSom(d.totalPayable) }}</span>
        </div>
        <div class="di-meta di-small">
          <span>{{ d.tariffName }}</span>
          <span>{{ formatDate(d.createdAt) }}</span>
        </div>
      </div>
    </aside>

    <!-- Right panel ─────────────────────────────────────────────────── -->
    <main class="tp-detail">
      <div v-if="!selectedDealId" class="empty-state">
        <i class="pi pi-credit-card" />
        <p>Выберите сделку слева</p>
      </div>

      <div v-else-if="loadingDetail" class="state-row">
        <i class="pi pi-spin pi-spinner" /> Загрузка сделки…
      </div>

      <template v-else-if="detail">
        <!-- Deal header ──────────────────────────────────────────────── -->
        <div class="detail-head">
          <div>
            <h3>{{ detail.clientName }}</h3>
            <span class="font-mono text-secondary">{{ detail.clientPinfl }} · {{ detail.clientPhone }}</span>
          </div>
          <div class="deal-stats">
            <div class="ds-item">
              <span class="ds-label">Итого</span>
              <span class="ds-value font-mono">{{ formatSom(detail.totalPayable) }}</span>
            </div>
            <div class="ds-item">
              <span class="ds-label">Оплачено</span>
              <span class="ds-value font-mono">{{ formatSom(totalPaid(detail)) }}</span>
            </div>
            <div class="ds-item">
              <span class="ds-label">Осталось</span>
              <span class="ds-value font-mono">{{ formatSom(detail.totalPayable - totalPaid(detail)) }}</span>
            </div>
            <div class="ds-item">
              <span class="ds-label">Взносы</span>
              <span class="ds-value">{{ paidCount(detail) }} / {{ detail.schedule.length }}</span>
            </div>
            <div v-if="overdueCount(detail) > 0" class="ds-item ds-danger">
              <span class="ds-label">Просрочено</span>
              <span class="ds-value">{{ overdueCount(detail) }}</span>
            </div>
          </div>
        </div>

        <!-- Schedule ─────────────────────────────────────────────────── -->
        <div class="schedule-wrap">
          <table class="sched">
            <thead>
              <tr>
                <th>#</th>
                <th>Дата</th>
                <th>Взнос</th>
                <th>Прогресс</th>
                <th>Статус</th>
                <th>Оплачено</th>
                <th>Сумма платежа (сум)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in detail.schedule"
                :key="item.index"
                :class="{ 'row-paid': item.paid, 'row-overdue': isOverdue(item) }"
              >
                <td class="font-mono td-idx">{{ item.index + 1 }}</td>
                <td class="font-mono">{{ formatDate(item.dueDate + 'T00:00:00') }}</td>
                <td class="font-mono">{{ formatSom(item.amount) }}</td>

                <!-- Progress bar ──────────────────────── -->
                <td class="td-progress">
                  <div class="prog-wrap">
                    <div class="prog-track">
                      <div
                        class="prog-bar"
                        :class="{ 'prog-full': item.paid }"
                        :style="{ width: progressPct(item) + '%' }"
                      />
                    </div>
                    <span class="prog-label font-mono">{{ progressPct(item) }}%</span>
                  </div>
                  <div class="prog-detail font-mono">
                    <span class="text-success">{{ formatSom(item.paidAmount) }}</span>
                    <span class="text-secondary"> / {{ formatSom(item.amount) }}</span>
                  </div>
                </td>

                <td>
                  <span v-if="item.paid" class="badge badge-success">Оплачен</span>
                  <span v-else-if="isOverdue(item)" class="badge badge-overdue">Просрочен</span>
                  <span v-else class="badge badge-pending">Ожидание</span>
                </td>

                <td class="font-mono td-paidat">{{ formatDateTime(item.paidAt) }}</td>

                <!-- Amount input ──────────────────────── -->
                <td class="td-input">
                  <template v-if="!item.paid && payState[item.index]">
                    <div class="amount-row">
                      <input
                        v-model="payState[item.index].inputSom"
                        type="number"
                        min="1"
                        class="amount-input font-mono"
                        placeholder="0"
                        @keyup.enter="pay(item)"
                      />
                      <button
                        class="btn-max"
                        :title="`Максимум: ${formatSom(remaining(item))}`"
                        @click="setMax(item)"
                      >
                        Макс
                      </button>
                    </div>
                    <div class="remaining font-mono">
                      Остаток: {{ formatSom(remaining(item)) }}
                    </div>
                    <div v-if="payState[item.index].error" class="input-error">
                      {{ payState[item.index].error }}
                    </div>
                  </template>
                </td>

                <!-- Pay button ────────────────────────── -->
                <td class="td-action">
                  <button
                    v-if="!item.paid"
                    class="btn-pay"
                    :disabled="payState[item.index]?.paying"
                    @click="pay(item)"
                  >
                    <i
                      :class="payState[item.index]?.paying
                        ? 'pi pi-spin pi-spinner'
                        : 'pi pi-wallet'"
                    />
                    {{ payState[item.index]?.paying ? '…' : 'Оплатить' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </main>

  </div>
</template>

<style scoped>
.tp-layout {
  display: flex;
  height: calc(100vh - 56px);
  overflow: hidden;
}

/* ── Left panel ──────────────────────────────────────────────────── */
.tp-list {
  width: 320px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.tp-list-head {
  padding: 1.2rem 1rem 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  position: sticky;
  top: 0;
  background: var(--bg-sidebar);
  z-index: 1;
}
.tp-list-head h2 { margin: 0; font-size: 1rem; font-weight: 800; }
.sub { margin: 0; font-size: 0.74rem; color: var(--text-secondary); }

.filter-row { display: flex; gap: 0.35rem; }
.filter-btn {
  flex: 1;
  padding: 0.28rem 0;
  border-radius: 7px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.12s;
}
.filter-btn.active {
  background: var(--gradient-accent);
  color: #fff;
  border-color: transparent;
  box-shadow: var(--accent-glow);
}
.search-input {
  width: 100%;
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 0.82rem;
  box-sizing: border-box;
}
.search-input:focus { outline: none; border-color: var(--accent-2); }

.deal-item {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background 0.12s;
}
.deal-item:hover { background: var(--bg-base); }
.deal-item.selected {
  background: color-mix(in srgb, var(--accent-2) 10%, transparent);
  border-left: 3px solid var(--accent-2);
}
.di-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.15rem;
}
.di-name { font-weight: 700; font-size: 0.86rem; }
.di-status { font-size: 0.68rem; font-weight: 800; text-transform: uppercase; }
.di-meta { display: flex; justify-content: space-between; font-size: 0.76rem; color: var(--text-secondary); }
.di-small { font-size: 0.7rem; margin-top: 0.1rem; }

/* ── Right panel ─────────────────────────────────────────────────── */
.tp-detail { flex: 1; overflow-y: auto; padding: 1.6rem 1.8rem; }

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  color: var(--text-secondary);
}
.empty-state i { font-size: 2.8rem; opacity: 0.25; }
.empty-state p { font-weight: 600; margin: 0; }

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1.6rem;
  flex-wrap: wrap;
}
.detail-head h3 { margin: 0 0 0.2rem; font-size: 1.1rem; font-weight: 800; }
.deal-stats { display: flex; gap: 1.1rem; flex-wrap: wrap; }
.ds-item { display: flex; flex-direction: column; align-items: flex-end; }
.ds-label { font-size: 0.68rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; }
.ds-value { font-size: 0.95rem; font-weight: 800; }
.ds-danger .ds-value { color: var(--danger); }

/* ── Schedule table ──────────────────────────────────────────────── */
.schedule-wrap { overflow-x: auto; }
.sched {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}
.sched th {
  text-align: left;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  padding: 0.45rem 0.75rem;
  border-bottom: 2px solid var(--border-subtle);
  white-space: nowrap;
}
.sched td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}
.sched tr:hover td { background: var(--bg-base); }
.row-paid td { opacity: 0.45; }
.row-overdue .td-idx,
.row-overdue .sched td:nth-child(2),
.row-overdue .sched td:nth-child(3) { color: var(--danger); }

.td-idx { color: var(--text-secondary); width: 32px; }
.td-paidat { font-size: 0.74rem; color: var(--text-secondary); }

/* Progress ────────────────────────────────────────────────────────── */
.td-progress { min-width: 140px; }
.prog-wrap { display: flex; align-items: center; gap: 0.5rem; }
.prog-track {
  flex: 1;
  height: 6px;
  background: var(--border-subtle);
  border-radius: 999px;
  overflow: hidden;
}
.prog-bar {
  height: 100%;
  background: var(--accent-2);
  border-radius: 999px;
  transition: width 0.3s ease;
}
.prog-bar.prog-full { background: var(--success); }
.prog-label { font-size: 0.72rem; color: var(--text-secondary); width: 32px; text-align: right; }
.prog-detail { font-size: 0.72rem; margin-top: 0.2rem; }

/* Amount input ──────────────────────────────────────────────────── */
.td-input { min-width: 180px; }
.amount-row { display: flex; gap: 0.4rem; align-items: center; }
.amount-input {
  width: 110px;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 0.82rem;
}
.amount-input:focus { outline: none; border-color: var(--accent-2); }
.btn-max {
  padding: 0.3rem 0.55rem;
  border-radius: 7px;
  border: 1px solid var(--accent-2);
  background: transparent;
  color: var(--accent-2);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.remaining { font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.25rem; }
.input-error { font-size: 0.72rem; color: var(--danger); margin-top: 0.2rem; }

/* Pay button ────────────────────────────────────────────────────── */
.td-action { white-space: nowrap; }
.btn-pay {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.38rem 0.9rem;
  border-radius: 8px;
  background: var(--gradient-accent);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.btn-pay:disabled { opacity: 0.6; cursor: default; }

/* Badges ────────────────────────────────────────────────────────── */
.badge {
  display: inline-block;
  padding: 0.18rem 0.6rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 800;
  white-space: nowrap;
}
.badge-success { background: var(--success-bg); color: var(--success); }
.badge-overdue { background: var(--danger-bg, #fff0f0); color: var(--danger); }
.badge-pending { background: var(--bg-surface); color: var(--text-secondary); }

.state-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.2rem 1rem;
  color: var(--text-secondary);
  font-size: 0.86rem;
}
.state-error { color: var(--danger); }

.text-secondary { color: var(--text-secondary); }
.text-success { color: var(--success); }
.font-mono { font-family: 'JetBrains Mono', monospace; }
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.7rem;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}
</style>
