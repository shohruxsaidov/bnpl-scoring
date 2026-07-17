<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBuyoutsStore, type Buyout } from '@/stores/buyouts'

const { t } = useI18n()
const store = useBuyoutsStore()

const search = ref('')
const statusFilter = ref<'all' | 'pending' | 'paid'>('all')
const merchantFilter = ref('all')
const expandedRows = ref(new Set<string>())

function toggleRow(id: string) {
  if (expandedRows.value.has(id)) expandedRows.value.delete(id)
  else expandedRows.value.add(id)
}

onMounted(() => store.fetch())

const statusOptions = computed(() => [
  { label: t('buyout.allStatuses'), value: 'all' },
  { label: t('buyout.statusPending'), value: 'pending' },
  { label: t('buyout.statusPaid'), value: 'paid' },
])

const merchantOptions = computed(() => {
  const seen = new Set<string>()
  const opts = [{ label: t('buyout.allMerchants'), value: 'all' }]
  for (const b of store.buyouts) {
    if (!seen.has(b.merchantId)) {
      seen.add(b.merchantId)
      opts.push({ label: b.merchantName, value: b.merchantId })
    }
  }
  return opts
})

const stats = computed(() => ({
  total: store.buyouts.length,
  pending: store.buyouts.filter((b) => b.status === 'pending').length,
  paid: store.buyouts.filter((b) => b.status === 'paid').length,
}))

const filtered = computed(() => {
  let list = store.buyouts
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (b) =>
        b.agentName.toLowerCase().includes(q) ||
        b.clientName.toLowerCase().includes(q) ||
        b.merchantName.toLowerCase().includes(q) ||
        b.branchName.toLowerCase().includes(q) ||
        b.clientPhone.includes(q) ||
        b.dealNumber.toLowerCase().includes(q),
    )
  }
  if (statusFilter.value !== 'all') list = list.filter((b) => b.status === statusFilter.value)
  if (merchantFilter.value !== 'all') list = list.filter((b) => b.merchantId === merchantFilter.value)
  return list
})

function fmtAmount(som: number) {
  return som.toLocaleString('ru-RU')
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Pay dialog ───────────────────────────────────────────────────────────────
// Marking a buyout paid is irreversible and needs its proof of payment attached,
// so the row button opens this instead of writing straight away.
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024

const payTarget = ref<Buyout | null>(null)
const payFile = ref<File | null>(null)
const paying = ref(false)
const payError = ref<string | null>(null)

const ERROR_KEYS: Record<string, string> = {
  file_required: 'buyout.errFileRequired',
  invalid_document_type: 'buyout.errFileType',
  file_too_large: 'buyout.errFileTooLarge',
  buyout_already_paid: 'buyout.errAlreadyPaid',
}

function openPay(row: Buyout) {
  payTarget.value = row
  payFile.value = null
  payError.value = null
}

function closePay() {
  if (paying.value) return
  payTarget.value = null
}

function pickFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  payError.value = null
  if (file && !ACCEPTED_TYPES.includes(file.type)) {
    payError.value = t('buyout.errFileType')
    input.value = ''
    return
  }
  if (file && file.size > MAX_DOCUMENT_BYTES) {
    payError.value = t('buyout.errFileTooLarge')
    input.value = ''
    return
  }
  payFile.value = file
}

async function submitPay() {
  if (!payTarget.value || !payFile.value) return
  paying.value = true
  payError.value = null
  try {
    await store.markPaid(payTarget.value.id, payFile.value)
    payTarget.value = null
  } catch (err: any) {
    const key = ERROR_KEYS[err?.message]
    payError.value = key ? t(key) : t('common.error')
  } finally {
    paying.value = false
  }
}
</script>

<template>
  <div class="buyout-page">

    <!-- ── Loading ─────────────────────────────────────────────────────── -->
    <template v-if="store.loading">
      <div class="stat-grid">
        <div v-for="i in 3" :key="i" class="stat-card skeleton" />
      </div>
      <div class="table-card skeleton-table" />
    </template>

    <template v-else>
      <!-- ── Stat cards ─────────────────────────────────────────────── -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon-wrap" style="background:var(--gradient-hero)">
            <i class="pi pi-file" />
          </div>
          <div class="stat-body">
            <span class="stat-value">{{ stats.total }}</span>
            <span class="stat-label">{{ $t('buyout.total') }}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap" style="background:linear-gradient(135deg,#ff8c42,#ffb02e)">
            <i class="pi pi-clock" />
          </div>
          <div class="stat-body">
            <span class="stat-value">{{ stats.pending }}</span>
            <span class="stat-label">{{ $t('buyout.pending') }}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap" style="background:linear-gradient(135deg,#00c49a,#00d4aa)">
            <i class="pi pi-check-circle" />
          </div>
          <div class="stat-body">
            <span class="stat-value">{{ stats.paid }}</span>
            <span class="stat-label">{{ $t('buyout.paid') }}</span>
          </div>
        </div>
      </div>

      <!-- ── Filters + table ─────────────────────────────────────────── -->
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
                <th style="width:32px" />
                <th>{{ $t('buyout.id') }}</th>
                <th>{{ $t('buyout.agent') }}</th>
                <th>{{ $t('buyout.merchant') }}</th>
                <th>{{ $t('buyout.client') }}</th>
                <th>{{ $t('buyout.amount') }}</th>
                <th>{{ $t('buyout.status') }}</th>
                <th>{{ $t('buyout.date') }}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <template v-for="row in filtered" :key="row.id">
                <tr :class="{ 'row-expanded': expandedRows.has(row.id) }">
                  <td class="expand-cell">
                    <button
                      class="expand-btn"
                      :class="{ open: expandedRows.has(row.id) }"
                      @click="toggleRow(row.id)"
                    >
                      <i class="pi pi-chevron-right" />
                    </button>
                  </td>
                  <td class="id-cell">
                    <RouterLink :to="`/deals/${row.dealId}`" class="deal-link">{{ row.dealNumber }}</RouterLink>
                  </td>
                  <td>
                    <span class="person-name">{{ row.agentName }}</span>
                  </td>
                  <td>
                    <RouterLink :to="`/merchants/${row.merchantId}`" class="deal-link">{{ row.merchantName }}</RouterLink>
                  </td>
                  <td>
                    <div class="person-cell">
                      <span class="person-name">{{ row.clientName }}</span>
                      <span class="person-phone">{{ row.clientPhone }}</span>
                    </div>
                  </td>
                  <td class="amount-cell">
                    <span class="amount-num">{{ fmtAmount(row.amount) }}</span>
                    <span class="amount-unit">{{ $t('buyout.som') }}</span>
                  </td>
                  <td>
                    <span class="status-badge" :class="row.status">
                      {{ row.status === 'paid' ? $t('buyout.statusPaid') : $t('buyout.statusPending') }}
                    </span>
                  </td>
                  <td class="date-cell">{{ fmtDate(row.createdAt) }}</td>
                  <td class="action-cell">
                    <button v-if="row.status === 'pending'" class="btn-pay" @click="openPay(row)">
                      <i class="pi pi-check-circle" /> {{ $t('buyout.statusPaid') }}
                    </button>
                    <button v-else class="btn-paid" disabled>
                      <i class="pi pi-check-circle" /> {{ $t('buyout.statusPaid') }}
                    </button>
                  </td>
                </tr>
                <tr v-if="expandedRows.has(row.id)" class="expansion-row">
                  <td colspan="9" class="expansion-cell">
                    <div v-if="row.status === 'paid'" class="pay-meta">
                      <div class="pay-meta-field">
                        <span class="pay-meta-label">{{ $t('buyout.paidAt') }}</span>
                        <span class="pay-meta-value">{{ row.paidAt ? fmtDateTime(row.paidAt) : '—' }}</span>
                      </div>
                      <div class="pay-meta-field">
                        <span class="pay-meta-label">{{ $t('buyout.paidBy') }}</span>
                        <span class="pay-meta-value">{{ row.paidByName ?? '—' }}</span>
                      </div>
                      <div class="pay-meta-field">
                        <span class="pay-meta-label">{{ $t('buyout.document') }}</span>
                        <a
                          v-if="row.documentUrl"
                          class="doc-link"
                          :href="row.documentUrl"
                          target="_blank"
                          rel="noopener"
                        >
                          <i class="pi pi-file" /> {{ $t('buyout.openDocument') }}
                        </a>
                        <span v-else class="pay-meta-value">—</span>
                      </div>
                    </div>
                    <table class="items-table">
                      <thead>
                        <tr>
                          <th>{{ $t('buyout.productName') }}</th>
                          <th>{{ $t('buyout.price') }}</th>
                          <th>{{ $t('buyout.qty') }}</th>
                          <th>{{ $t('buyout.itemAmount') }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(item, i) in row.items" :key="i">
                          <td class="item-name">{{ item.productName }}</td>
                          <td class="item-num">
                            {{ fmtAmount(item.price) }}
                            <span class="amount-unit">{{ $t('buyout.som') }}</span>
                          </td>
                          <td class="item-num">{{ item.qty }}</td>
                          <td class="item-num">
                            {{ fmtAmount(item.amount) }}
                            <span class="amount-unit">{{ $t('buyout.som') }}</span>
                          </td>
                        </tr>
                        <tr v-if="row.items.length === 0">
                          <td colspan="4" class="items-empty">—</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </template>
              <tr v-if="filtered.length === 0">
                <td colspan="9" class="empty-row">{{ $t('buyout.noData') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- ── Pay dialog ──────────────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="payTarget" class="dialog-backdrop" @mousedown.self="closePay">
        <div class="dialog surface-card">
          <div class="dialog-header">
            <h3>{{ $t('buyout.payTitle') }}</h3>
            <button class="close-btn" @click="closePay"><i class="pi pi-times" /></button>
          </div>

          <div class="dialog-body">
            <p class="dialog-hint">{{ $t('buyout.payHint') }}</p>

            <div class="pay-summary">
              <div class="pay-summary-row">
                <span class="pay-meta-label">{{ $t('buyout.merchant') }}</span>
                <span class="pay-summary-value">{{ payTarget.merchantName }}</span>
              </div>
              <div class="pay-summary-row">
                <span class="pay-meta-label">{{ $t('buyout.id') }}</span>
                <span class="pay-summary-value">{{ payTarget.dealNumber }}</span>
              </div>
              <div class="pay-summary-row">
                <span class="pay-meta-label">{{ $t('buyout.amount') }}</span>
                <span class="pay-summary-value strong">
                  {{ fmtAmount(payTarget.amount) }}
                  <span class="amount-unit">{{ $t('buyout.som') }}</span>
                </span>
              </div>
            </div>

            <div class="field">
              <label class="field-label">{{ $t('buyout.documentLabel') }}</label>
              <label class="file-drop" :class="{ 'has-file': payFile }">
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  class="file-native"
                  @change="pickFile"
                />
                <i :class="payFile ? 'pi pi-file-check' : 'pi pi-upload'" />
                <span class="file-drop-text">{{ payFile ? payFile.name : $t('buyout.browse') }}</span>
              </label>
            </div>

            <p v-if="payError" class="field-error">{{ payError }}</p>
          </div>

          <div class="dialog-footer">
            <button class="btn-ghost" :disabled="paying" @click="closePay">
              {{ $t('common.cancel') }}
            </button>
            <button class="btn-primary" :disabled="!payFile || paying" @click="submitPay">
              <i v-if="paying" class="pi pi-spin pi-spinner" />
              {{ paying ? $t('buyout.paying') : $t('buyout.confirmPay') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.buyout-page { display: flex; flex-direction: column; gap: 1.2rem; }

/* ── Skeletons ────────────────────────────────────────────────────────────── */
.skeleton { height: 82px; border-radius: 14px; background: var(--bg-surface); border: 1px solid var(--border-subtle); animation: pulse 1.4s ease-in-out infinite; }
.skeleton-table { height: 380px; border-radius: 14px; background: var(--bg-surface); border: 1px solid var(--border-subtle); animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }

/* ── Stat grid ────────────────────────────────────────────────────────────── */
.stat-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; }
.stat-card {
  background: var(--bg-surface); border: 1px solid var(--border-subtle);
  border-radius: 14px; padding: 1.1rem 1.3rem;
  display: flex; align-items: center; gap: 1rem;
}
.stat-icon-wrap {
  width: 44px; height: 44px; border-radius: 12px;
  display: grid; place-items: center; flex-shrink: 0; color: #fff; font-size: 1.1rem;
}
.stat-body { display: flex; flex-direction: column; }
.stat-value { font-size: 1.6rem; font-weight: 800; line-height: 1.1; }
.stat-label { font-size: 0.78rem; color: var(--text-secondary); font-weight: 600; margin-top: 0.15rem; }

/* ── Table card ───────────────────────────────────────────────────────────── */
.table-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 14px; overflow: hidden; }
@media (max-width: 600px) { .table-card { overflow-x: auto; } }

/* ── Toolbar ──────────────────────────────────────────────────────────────── */
.toolbar { display: flex; align-items: center; gap: 0.8rem; padding: 0.9rem 1rem; border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; }
.search-wrap { position: relative; }
.search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-secondary); font-size: 0.85rem; }
.search-input {
  padding: 0.45rem 0.75rem 0.45rem 2rem; border-radius: 9px;
  border: 1px solid var(--border-subtle); background: var(--bg-base); color: var(--text-primary);
  font-family: inherit; font-size: 0.85rem; width: 220px; outline: none; transition: border-color 0.15s;
}
.search-input:focus { border-color: var(--accent-2); }
.search-input::placeholder { color: var(--text-secondary); }
.filter-select {
  padding: 0.45rem 0.75rem; border-radius: 9px;
  border: 1px solid var(--border-subtle); background: var(--bg-base); color: var(--text-primary);
  font-family: inherit; font-size: 0.85rem; outline: none; cursor: pointer; transition: border-color 0.15s;
}
.filter-select:focus { border-color: var(--accent-2); }

/* ── Table ────────────────────────────────────────────────────────────────── */
.table-wrap { overflow-x: auto; }
.buyout-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.buyout-table thead th {
  padding: 0.75rem 1rem; text-align: left; font-size: 0.7rem; font-weight: 800;
  letter-spacing: 0.05em; color: var(--text-secondary); border-bottom: 1px solid var(--border-subtle); white-space: nowrap;
}
.buyout-table tbody tr { border-bottom: 1px solid var(--border-subtle); transition: background 0.1s; }
.buyout-table tbody tr:last-child { border-bottom: none; }
.buyout-table tbody tr:hover { background: var(--bg-base); }
.buyout-table td { padding: 0.75rem 1rem; vertical-align: middle; }

/* ── Cells ────────────────────────────────────────────────────────────────── */
.id-cell { color: var(--text-secondary); font-weight: 600; font-size: 0.82rem; }
.deal-link { color: var(--accent-2); text-decoration: none; font-weight: 700; }
.deal-link:hover { text-decoration: underline; }
.person-cell { display: flex; flex-direction: column; gap: 0.1rem; }
.person-name { font-weight: 700; font-size: 0.88rem; }
.person-phone { font-size: 0.76rem; color: var(--text-secondary); font-family: 'JetBrains Mono', monospace; }
.branch-cell { font-weight: 600; }
.amount-cell { white-space: nowrap; }
.amount-num { font-weight: 800; font-size: 0.92rem; }
.amount-unit { font-size: 0.76rem; color: var(--text-secondary); margin-left: 0.25rem; font-weight: 600; }

/* ── Status badges ────────────────────────────────────────────────────────── */
.status-badge { display: inline-flex; align-items: center; padding: 0.25rem 0.65rem; border-radius: 7px; font-size: 0.76rem; font-weight: 700; white-space: nowrap; }
.status-badge.pending { background: rgba(255,140,66,0.18); color: #ff8c42; }
.status-badge.paid { background: rgba(0,212,170,0.18); color: #00d4aa; }

/* ── Action buttons ───────────────────────────────────────────────────────── */
.action-cell { text-align: right; }
.btn-pay { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.85rem; border-radius: 8px; border: none; background: rgba(0,212,170,0.18); color: #00d4aa; font-family: inherit; font-size: 0.78rem; font-weight: 700; cursor: pointer; transition: all 0.15s ease; white-space: nowrap; }
.btn-pay:hover { background: rgba(0,212,170,0.32); }
.btn-paid { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.85rem; border-radius: 8px; border: none; background: rgba(0,212,170,0.08); color: rgba(0,212,170,0.45); font-family: inherit; font-size: 0.78rem; font-weight: 700; cursor: default; white-space: nowrap; }

.date-cell { font-size: 0.82rem; color: var(--text-secondary); white-space: nowrap; }
.empty-row { text-align: center; padding: 3rem 1rem; color: var(--text-secondary); font-size: 0.9rem; }

/* ── Expand button ────────────────────────────────────────────────────────── */
.expand-cell { padding: 0.75rem 0.5rem 0.75rem 1rem; }
.expand-btn {
  width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--border-subtle);
  background: var(--bg-base); color: var(--text-secondary); cursor: pointer;
  display: grid; place-items: center; font-size: 0.65rem;
  transition: all 0.15s ease;
}
.expand-btn:hover { color: var(--accent-2); border-color: var(--accent-2); }
.expand-btn i { transition: transform 0.15s ease; }
.expand-btn.open i { transform: rotate(90deg); }

.row-expanded td { background: var(--bg-base); }

/* ── Expansion row ────────────────────────────────────────────────────────── */
.expansion-row td { padding: 0; border-bottom: 2px solid var(--border-subtle); }
.expansion-cell { padding: 0.75rem 1rem 0.75rem 3rem !important; background: var(--bg-base); }

.items-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.items-table thead th {
  padding: 0.4rem 0.75rem; text-align: left; font-size: 0.68rem; font-weight: 800;
  letter-spacing: 0.05em; color: var(--text-secondary); border-bottom: 1px solid var(--border-subtle);
}
.items-table tbody tr:last-child td { border-bottom: none; }
.items-table td { padding: 0.45rem 0.75rem; border-bottom: 1px solid var(--border-subtle); }
.item-name { font-weight: 600; }
.item-num { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; }
.items-empty { color: var(--text-secondary); text-align: center; padding: 0.5rem; }

/* ── Payment details (paid rows) ──────────────────────────────────────────── */
.pay-meta { display: flex; gap: 2rem; flex-wrap: wrap; padding-bottom: 0.75rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-subtle); }
.pay-meta-field { display: flex; flex-direction: column; gap: 0.2rem; }
.pay-meta-label { font-size: 0.68rem; font-weight: 800; letter-spacing: 0.05em; color: var(--text-secondary); }
.pay-meta-value { font-size: 0.82rem; font-weight: 600; }
.doc-link { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--accent-2); text-decoration: none; font-size: 0.82rem; font-weight: 700; }
.doc-link:hover { text-decoration: underline; }

/* ── Dialog ───────────────────────────────────────────────────────────────── */
.dialog-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; display: grid; place-items: center; padding: 1rem; }
.dialog { width: 100%; max-width: 460px; border-radius: 16px; background: var(--bg-surface); border: 1px solid var(--border-subtle); }
.dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.2rem; border-bottom: 1px solid var(--border-subtle); }
.dialog-header h3 { margin: 0; font-size: 1rem; font-weight: 800; }
.close-btn { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-secondary); cursor: pointer; display: grid; place-items: center; font-size: 0.78rem; transition: all 0.12s; }
.close-btn:hover { color: var(--text-primary); }
.dialog-body { padding: 1.2rem; display: flex; flex-direction: column; gap: 1rem; }
.dialog-hint { margin: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.45; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 0.6rem; padding: 1rem 1.2rem; border-top: 1px solid var(--border-subtle); }

.pay-summary { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.8rem 0.9rem; border-radius: 10px; background: var(--bg-base); border: 1px solid var(--border-subtle); }
.pay-summary-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.pay-summary-value { font-size: 0.85rem; font-weight: 700; text-align: right; }
.pay-summary-value.strong { font-size: 0.95rem; font-weight: 800; }

.field { display: flex; flex-direction: column; gap: 0.4rem; position: relative; }
.field-label { font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.field-error { font-size: 0.8rem; color: var(--danger); margin: 0; }

.file-drop { display: flex; align-items: center; gap: 0.5rem; padding: 0.65rem 0.8rem; border: 1px dashed var(--border-subtle); border-radius: 0.6rem; cursor: pointer; background: color-mix(in srgb, var(--accent-1) 3%, transparent); transition: border-color 0.12s ease, background 0.12s ease; min-width: 0; }
.file-drop:hover { border-color: var(--accent-1); background: color-mix(in srgb, var(--accent-1) 8%, transparent); }
.file-drop.has-file { border-style: solid; border-color: color-mix(in srgb, var(--accent-1) 45%, transparent); }
.file-drop .pi { font-size: 0.95rem; color: var(--accent-1); flex-shrink: 0; }
.file-drop-text { font-size: 0.82rem; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-native { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }

.btn-primary { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.55rem 1.2rem; border-radius: 10px; border: none; background: var(--accent-2); color: #fff; font-size: 0.88rem; font-weight: 700; font-family: inherit; cursor: pointer; transition: opacity 0.15s ease; }
.btn-primary:hover:not(:disabled) { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost { padding: 0.5rem 1rem; border-radius: 10px; border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); font-size: 0.88rem; font-weight: 600; font-family: inherit; cursor: pointer; transition: all 0.12s; }
.btn-ghost:hover:not(:disabled) { color: var(--text-primary); border-color: var(--text-secondary); }
.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 700px) {
  .stat-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 480px) {
  .stat-grid { grid-template-columns: 1fr; }
}
</style>
