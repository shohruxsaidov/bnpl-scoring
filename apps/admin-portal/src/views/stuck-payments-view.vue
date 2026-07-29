<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useAuthStore } from '@/stores/auth'
import {
  useStuckPaymentsStore,
  type ResolutionReason,
  type StuckSession,
  type StuckSessionStatus,
} from '@/stores/stuck-payments'
import MonoAmount from '@/components/mono-amount.vue'
import { formatDateTime } from '@/utils/money'

/**
 * The stuck-money worklist.
 *
 * Every row is a client who was charged by Plumgate and whose balance is still
 * wrong. Two actions close a row: Book (allocate money we are already holding)
 * and Resolve (record that it was refunded, or that no debit ever happened).
 * Nothing on this screen moves money at Plumgate — this system has no refund
 * call, so a refund is done in Plum's dashboard and reported here.
 */
const store = useStuckPaymentsStore()
const auth = useAuthStore()
const { t } = useI18n()

const canManage = computed(() => auth.can('manage_payments'))

const FILTERS: { key: StuckSessionStatus | null; labelKey: string }[] = [
  { key: null, labelKey: 'stuckPayments.filterActionable' },
  { key: 'needs_refund', labelKey: 'stuckPayments.filterNeedsRefund' },
  { key: 'resolved', labelKey: 'stuckPayments.filterResolved' },
  { key: 'pending', labelKey: 'stuckPayments.filterPending' },
  { key: 'confirming', labelKey: 'stuckPayments.filterConfirming' },
]

onMounted(() => {
  store.fetch(null)
  store.fetchCount()
})

// ── Row presentation ─────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { fg: string; bg: string }> = {
  debited_unbooked: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  needs_refund: { fg: 'var(--warning)', bg: 'var(--warning-bg)' },
  resolved: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  pending: { fg: 'var(--text-secondary)', bg: 'var(--bg-base)' },
  confirming: { fg: 'var(--text-secondary)', bg: 'var(--bg-base)' },
}

function statusLabel(s: StuckSessionStatus): string {
  return t(`stuckPayments.status.${s}`)
}

/**
 * Plum's raw codes mean nothing to an operator, and the difference between them
 * is what decides the next move: `confirm_interrupted` is the only one where we
 * genuinely do not know whether the card was debited, and it must be checked
 * against Plumgate before anything is booked.
 */
function failureLabel(code: string | null): string {
  if (!code) return '—'
  const known = ['confirm_interrupted', 'booking_failed', 'overpayment']
  return known.includes(code) ? t(`stuckPayments.failure.${code}`) : code
}

/** Whole days a row has been wrong. The queue's real priority signal. */
function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function ageLabel(iso: string): string {
  const days = ageDays(iso)
  return days < 1 ? t('stuckPayments.ageToday') : t('stuckPayments.ageDays', { days })
}

const copiedId = ref<string | null>(null)

/** The transaction id exists to be pasted into a message to Plumgate support. */
async function copyTransactionId(row: StuckSession) {
  if (!row.plumTransactionId) return
  try {
    await navigator.clipboard.writeText(row.plumTransactionId)
    copiedId.value = row.id
    setTimeout(() => {
      if (copiedId.value === row.id) copiedId.value = null
    }, 1500)
  } catch {
    // Clipboard blocked (insecure origin, denied permission). The id is on
    // screen and selectable either way; a failed copy is not worth an error.
  }
}

function isActionable(row: StuckSession): boolean {
  return row.status === 'debited_unbooked' || row.status === 'needs_refund'
}

// ── Book ─────────────────────────────────────────────────────────────────────
// One flight at a time. The server locks the row so a double press cannot double
// book, but there is no reason to let an operator fire the second request at all.
const bookingId = ref<string | null>(null)
const toast = ref<{ kind: 'ok' | 'info'; text: string } | null>(null)

function flash(kind: 'ok' | 'info', text: string) {
  toast.value = { kind, text }
  setTimeout(() => { toast.value = null }, 4000)
}

async function book(row: StuckSession) {
  if (bookingId.value) return
  bookingId.value = row.id
  try {
    await store.book(row.id)
    flash('ok', t('stuckPayments.bookedToast', { amount: row.amount.toLocaleString('ru') }))
  } catch (err: any) {
    if (err?.message === 'OVERPAYMENT') {
      // Not a failure the operator caused, and not one they can retry: the debt
      // shrank below this amount, so the money is surplus and has to go back.
      // The row has already been reclassified server-side; offer the only move
      // that is left rather than an error toast nobody can act on.
      openResolve(row, 'refunded_at_plumgate')
      overpaidRow.value = row
      await store.fetch()
    } else if (err?.message === 'payment_session_not_stranded') {
      // Someone else got here first. The list is simply stale.
      flash('info', t('stuckPayments.alreadyHandled'))
      await Promise.all([store.fetch(), store.fetchCount()])
    } else {
      flash('info', t('common.error'))
    }
  } finally {
    bookingId.value = null
  }
}

// ── Resolve ──────────────────────────────────────────────────────────────────
const resolveOpen = ref(false)
const resolveRow = ref<StuckSession | null>(null)
/** Set only when the dialog was opened by an OVERPAYMENT, which changes the copy. */
const overpaidRow = ref<StuckSession | null>(null)
const resolveReason = ref<ResolutionReason>('refunded_at_plumgate')
const resolveNote = ref('')
const resolving = ref(false)
const resolveError = ref('')

const REASONS: ResolutionReason[] = ['refunded_at_plumgate', 'no_debit_occurred', 'other']

/** Matches the server's minimum: a note shorter than this explains nothing. */
const NOTE_MIN = 10
const noteValid = computed(() => resolveNote.value.trim().length >= NOTE_MIN)

function openResolve(row: StuckSession, reason: ResolutionReason = 'refunded_at_plumgate') {
  resolveRow.value = row
  // Cleared here rather than only on close: the overpayment callout must never
  // survive into a resolve the operator started themselves.
  overpaidRow.value = null
  resolveReason.value = reason
  resolveNote.value = ''
  resolveError.value = ''
  resolveOpen.value = true
}

function closeResolve() {
  resolveOpen.value = false
  resolveRow.value = null
  overpaidRow.value = null
}

async function submitResolve() {
  if (!resolveRow.value || !noteValid.value) return
  resolving.value = true
  resolveError.value = ''
  try {
    await store.resolve(resolveRow.value.id, resolveReason.value, resolveNote.value.trim())
    closeResolve()
    flash('ok', t('stuckPayments.resolvedToast'))
  } catch (err: any) {
    resolveError.value =
      err?.message === 'payment_session_not_stranded'
        ? t('stuckPayments.alreadyHandled')
        : t('common.error')
  } finally {
    resolving.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ $t('routeTitle.stuckPayments') }}</h1>
        <p class="page-sub">{{ $t('stuckPayments.pageSubtitle') }}</p>
      </div>
      <button class="btn-ghost" :disabled="store.loading" @click="store.fetch()">
        <i class="pi pi-refresh" />
        {{ $t('common.refresh') }}
      </button>
    </div>

    <!-- The standing number: how much money is wrong right now. -->
    <div class="kpi-strip">
      <div class="kpi-card surface-card" :class="{ alarm: store.strandedCount > 0 }">
        <span class="kpi-label">{{ $t('stuckPayments.strandedCount') }}</span>
        <span class="kpi-value font-mono">{{ store.strandedCount }}</span>
        <span class="kpi-hint">{{ $t('stuckPayments.strandedHint') }}</span>
      </div>
      <div class="kpi-card surface-card">
        <span class="kpi-label">{{ $t('stuckPayments.strandedVolume') }}</span>
        <MonoAmount
          :value="store.actionable.reduce((sum, s) => sum + s.amount, 0)"
          size="lg"
          :gradient="false"
        />
        <span class="kpi-hint">{{ $t('stuckPayments.strandedVolumeHint') }}</span>
      </div>
    </div>

    <div class="tab-bar surface-card">
      <button
        v-for="f in FILTERS"
        :key="f.key ?? 'actionable'"
        class="tab-btn"
        :class="{ active: store.status === f.key }"
        @click="store.fetch(f.key)"
      >
        {{ $t(f.labelKey) }}
      </button>
    </div>

    <Transition name="fade">
      <div v-if="toast" class="toast surface-card" :class="toast.kind">{{ toast.text }}</div>
    </Transition>

    <div v-if="store.error" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ store.error }}</p>
      <button class="btn-ghost" @click="store.fetch()">{{ $t('common.retry') }}</button>
    </div>

    <div v-else-if="store.loading && store.sessions.length === 0" class="surface-card skeleton-table" />

    <!-- An empty worklist is the normal state, and it deserves to read as good news. -->
    <div v-else-if="store.sessions.length === 0" class="surface-card empty-state ok">
      <i class="pi pi-check-circle" />
      <p>{{ $t('stuckPayments.empty') }}</p>
    </div>

    <div v-else class="surface-card table-card">
      <DataTable :value="store.sessions" data-key="id" responsive-layout="scroll">
        <Column :header="$t('stuckPayments.colAge')">
          <template #body="{ data }">
            <span class="age" :class="{ old: ageDays(data.createdAt) >= 2 }">
              {{ ageLabel(data.createdAt) }}
            </span>
            <div class="muted-sm">{{ formatDateTime(data.createdAt) }}</div>
          </template>
        </Column>

        <Column :header="$t('stuckPayments.colClient')">
          <template #body="{ data }">
            <div class="client-cell">
              <RouterLink :to="`/clients/${data.userId}`" class="client-name">
                {{ data.clientName ?? `#${data.userId}` }}
              </RouterLink>
              <span class="client-phone font-mono">{{ data.clientPhone ?? '—' }}</span>
            </div>
          </template>
        </Column>

        <Column :header="$t('stuckPayments.colDeal')">
          <template #body="{ data }">
            <RouterLink :to="`/deals/${data.dealId}`" class="deal-id font-mono">
              {{ data.dealNumber ?? '—' }}
            </RouterLink>
          </template>
        </Column>

        <Column :header="$t('stuckPayments.colAmount')">
          <template #body="{ data }">
            <MonoAmount :value="data.amount" />
          </template>
        </Column>

        <Column :header="$t('stuckPayments.colStatus')">
          <template #body="{ data }">
            <span
              class="status-chip"
              :style="{ color: STATUS_STYLE[data.status]?.fg, background: STATUS_STYLE[data.status]?.bg }"
            >
              {{ statusLabel(data.status) }}
            </span>
            <div class="muted-sm">{{ failureLabel(data.failureCode) }}</div>
          </template>
        </Column>

        <Column :header="$t('stuckPayments.colTransaction')">
          <template #body="{ data }">
            <button
              v-if="data.plumTransactionId"
              class="copy-btn font-mono"
              :title="$t('stuckPayments.copyHint')"
              @click="copyTransactionId(data)"
            >
              {{ data.plumTransactionId }}
              <i :class="copiedId === data.id ? 'pi pi-check' : 'pi pi-copy'" />
            </button>
            <!-- No id means Plum never answered our confirm: whether the card was
                 debited can only be settled in Plum's dashboard. -->
            <span v-else class="muted-sm">{{ $t('stuckPayments.noTransactionId') }}</span>
          </template>
        </Column>

        <Column :header="$t('stuckPayments.colResolution')">
          <template #body="{ data }">
            <template v-if="data.status === 'resolved'">
              <div class="resolution-reason">{{ $t(`stuckPayments.reason.${data.resolutionReason}`) }}</div>
              <div class="muted-sm">{{ data.resolutionNote }}</div>
            </template>
            <span v-else class="muted-sm">—</span>
          </template>
        </Column>

        <Column v-if="canManage" :header="$t('stuckPayments.colActions')">
          <template #body="{ data }">
            <div v-if="isActionable(data)" class="row-actions">
              <button
                v-if="data.status === 'debited_unbooked'"
                class="btn-primary btn-sm"
                :disabled="bookingId !== null"
                @click="book(data)"
              >
                <i v-if="bookingId === data.id" class="pi pi-spin pi-spinner" />
                {{ $t('stuckPayments.book') }}
              </button>
              <button class="btn-ghost btn-sm" @click="openResolve(data)">
                {{ $t('stuckPayments.resolve') }}
              </button>
            </div>
            <span v-else class="muted-sm">—</span>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- ── Resolve dialog ─────────────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="resolveOpen" class="dialog-backdrop" @mousedown.self="closeResolve">
        <div class="dialog surface-card">
          <div class="dialog-header">
            <h3>{{ $t('stuckPayments.resolveTitle') }}</h3>
            <button class="close-btn" @click="closeResolve"><i class="pi pi-times" /></button>
          </div>

          <div class="dialog-body">
            <!-- Opened by an OVERPAYMENT: say what just happened, in the words of
                 the thing that has to happen next. -->
            <div v-if="overpaidRow" class="callout warn">
              <i class="pi pi-exclamation-triangle" />
              <div>
                <p class="callout-title">{{ $t('stuckPayments.overpaymentTitle') }}</p>
                <p class="callout-text">
                  {{ $t('stuckPayments.overpaymentBody', {
                    amount: overpaidRow.amount.toLocaleString('ru'),
                    deal: overpaidRow.dealNumber ?? '—',
                  }) }}
                </p>
              </div>
            </div>

            <div v-if="resolveRow" class="summary">
              <div class="summary-row">
                <span>{{ $t('stuckPayments.colClient') }}</span>
                <strong>{{ resolveRow.clientName ?? `#${resolveRow.userId}` }}</strong>
              </div>
              <div class="summary-row">
                <span>{{ $t('stuckPayments.colAmount') }}</span>
                <MonoAmount :value="resolveRow.amount" size="sm" />
              </div>
              <div class="summary-row">
                <span>{{ $t('stuckPayments.colTransaction') }}</span>
                <strong class="font-mono">{{ resolveRow.plumTransactionId ?? '—' }}</strong>
              </div>
            </div>

            <div class="field">
              <label class="field-label">{{ $t('stuckPayments.reasonLabel') }}</label>
              <select v-model="resolveReason" class="native-select">
                <option v-for="r in REASONS" :key="r" :value="r">
                  {{ $t(`stuckPayments.reason.${r}`) }}
                </option>
              </select>
              <p class="field-hint">{{ $t(`stuckPayments.reasonHint.${resolveReason}`) }}</p>
            </div>

            <div class="field">
              <label class="field-label">{{ $t('stuckPayments.noteLabel') }}</label>
              <textarea
                v-model="resolveNote"
                class="note-textarea"
                rows="3"
                :placeholder="$t('stuckPayments.notePlaceholder')"
              />
              <p class="field-hint">{{ $t('stuckPayments.noteHint', { min: NOTE_MIN }) }}</p>
            </div>

            <p v-if="resolveError" class="field-error">{{ resolveError }}</p>
          </div>

          <div class="dialog-footer">
            <button class="btn-ghost" @click="closeResolve">{{ $t('common.cancel') }}</button>
            <button class="btn-primary" :disabled="!noteValid || resolving" @click="submitResolve">
              <i v-if="resolving" class="pi pi-spin pi-spinner" />
              {{ $t('stuckPayments.resolveSubmit') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.4rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.page-title { margin: 0 0 0.2rem; font-size: 1.55rem; font-weight: 800; }
.page-sub { margin: 0; font-size: 0.85rem; color: var(--text-secondary); max-width: 62ch; }

.kpi-strip { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.kpi-card { padding: 1.25rem 1.4rem; display: flex; flex-direction: column; gap: 0.4rem; }
.kpi-card.alarm { border-color: var(--danger); }
.kpi-label { font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
.kpi-value { font-size: 1.6rem; font-weight: 800; line-height: 1; }
.kpi-card.alarm .kpi-value { color: var(--danger); }
.kpi-hint { font-size: 0.75rem; color: var(--text-secondary); }

.tab-bar { display: flex; gap: 0.35rem; padding: 0.4rem; flex-wrap: wrap; }
.tab-btn {
  border: none; background: transparent; color: var(--text-secondary);
  padding: 0.5rem 0.9rem; border-radius: 10px; font-size: 0.82rem; font-weight: 700; cursor: pointer;
}
.tab-btn:hover { background: var(--bg-base); color: var(--text-primary); }
.tab-btn.active { background: var(--accent-2); color: #fff; }

.toast { padding: 0.8rem 1.1rem; font-size: 0.85rem; font-weight: 600; border-left: 3px solid var(--accent-2); }
.toast.ok { border-left-color: var(--success); }

.table-card { padding: 0; overflow: hidden; }
.empty-state { padding: 3rem; display: flex; flex-direction: column; align-items: center; gap: 0.6rem; color: var(--text-secondary); }
.empty-state.ok .pi { font-size: 1.8rem; color: var(--success); }
.error-state { padding: 2.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.6rem; }

.age { font-weight: 700; font-size: 0.85rem; }
.age.old { color: var(--danger); }
.muted-sm { font-size: 0.75rem; color: var(--text-secondary); }

.client-cell { display: flex; flex-direction: column; gap: 0.15rem; }
.client-name { font-weight: 700; color: var(--text-primary); text-decoration: none; }
.client-name:hover { text-decoration: underline; }
.client-phone { font-size: 0.78rem; color: var(--text-secondary); }
.deal-id { font-size: 0.82rem; font-weight: 700; color: var(--accent-2); text-decoration: none; }
.deal-id:hover { text-decoration: underline; }

.status-chip { display: inline-block; padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
.resolution-reason { font-size: 0.8rem; font-weight: 700; }

.copy-btn {
  display: inline-flex; align-items: center; gap: 0.4rem; border: none; background: transparent;
  color: var(--text-secondary); font-size: 0.78rem; cursor: pointer; padding: 0.2rem 0;
}
.copy-btn:hover { color: var(--text-primary); }

.row-actions { display: flex; gap: 0.4rem; }
.btn-sm { padding: 0.35rem 0.7rem; font-size: 0.78rem; }
.btn-primary {
  display: inline-flex; align-items: center; gap: 0.4rem; border: none; border-radius: 10px;
  background: var(--accent-2); color: #fff; font-weight: 700; padding: 0.55rem 1rem; cursor: pointer;
}
.btn-primary:hover:not(:disabled) { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost {
  display: inline-flex; align-items: center; gap: 0.4rem; border: 1px solid var(--border-subtle);
  border-radius: 10px; background: transparent; color: var(--text-secondary); font-weight: 700;
  padding: 0.55rem 1rem; cursor: pointer;
}
.btn-ghost:hover { color: var(--text-primary); border-color: var(--text-secondary); }
.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

.dialog-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex;
  align-items: center; justify-content: center; z-index: 100; padding: 1rem;
}
.dialog { width: 100%; max-width: 480px; border-radius: 16px; }
.dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.2rem; border-bottom: 1px solid var(--border-subtle);
}
.dialog-header h3 { margin: 0; font-size: 1rem; font-weight: 800; }
.close-btn { border: none; background: transparent; color: var(--text-secondary); cursor: pointer; }
.dialog-body { padding: 1.2rem; display: flex; flex-direction: column; gap: 1rem; }
.dialog-footer {
  display: flex; justify-content: flex-end; gap: 0.6rem;
  padding: 1rem 1.2rem; border-top: 1px solid var(--border-subtle);
}

.callout { display: flex; gap: 0.7rem; padding: 0.9rem; border-radius: 12px; }
.callout.warn { background: var(--warning-bg); color: var(--warning); }
.callout-title { margin: 0 0 0.3rem; font-weight: 800; font-size: 0.85rem; }
.callout-text { margin: 0; font-size: 0.8rem; line-height: 1.45; }

.summary { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.8rem; border-radius: 12px; background: var(--bg-base); }
.summary-row { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.8rem; color: var(--text-secondary); }

.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field-label { font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); }
.field-hint { margin: 0; font-size: 0.74rem; color: var(--text-secondary); }
.field-error { margin: 0; font-size: 0.8rem; color: var(--danger); font-weight: 600; }
.native-select, .note-textarea {
  width: 100%; padding: 0.55rem 0.7rem; border-radius: 10px;
  border: 1px solid var(--border-subtle); background: var(--bg-base); color: var(--text-primary);
  font-size: 0.85rem; font-family: inherit;
}
.native-select:focus, .note-textarea:focus { border-color: var(--accent-2); outline: none; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 720px) {
  .kpi-strip { grid-template-columns: 1fr; }
}
</style>
