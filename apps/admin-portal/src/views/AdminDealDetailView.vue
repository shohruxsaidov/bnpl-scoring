<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StatusBadge from '@/components/StatusBadge.vue'
import { formatDate, formatDateTime, formatSomShort } from '@/utils/money'
import { useAdminDealQuery, useDealCommentsQuery, useAddDealComment } from '@/composables/useAdminDealsApi'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const dealId = computed(() => route.params.id as string)
const { data: deal, isLoading, isError } = useAdminDealQuery(dealId)

const activeTab = ref('deal')

const TABS = computed(() => [
  { key: 'deal',       label: t('dealDetail.tabDeals') },
  { key: 'status',     label: t('dealDetail.tabStatus') },
  { key: 'contracts',  label: t('dealDetail.tabContracts') },
  { key: 'accounting', label: t('dealDetail.tabAccounting') },
  { key: 'overdue',    label: t('dealDetail.tabOverdue') },
  { key: 'schedule',   label: t('dealDetail.tabSchedule') },
  { key: 'comments',   label: t('dealDetail.tabComments') },
])

// ── Comments ───────────────────────────────────────────────────────────────

const { data: comments } = useDealCommentsQuery(dealId)
const { mutate: addComment, isPending: isSubmitting } = useAddDealComment(dealId)
const newComment = ref('')

function submitComment() {
  const text = newComment.value.trim()
  if (!text) return
  addComment(text, {
    onSuccess: () => { newComment.value = '' },
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────

const ustama = computed(() => {
  if (!deal.value || !deal.value.amount) return '0.00%'
  return (((deal.value.totalPayable - deal.value.amount) / deal.value.amount) * 100).toFixed(2) + '%'
})

function basketItemTotal(item: { tanNarxi: string; quantity: number }): number {
  return Math.round(parseFloat(item.tanNarxi) * 100) * item.quantity
}

// ── Payment schedule ───────────────────────────────────────────────────────

type RowStatus = 'paid' | 'pending' | 'overdue'

interface ScheduleEntry {
  index: number
  date: string
  amount: number
  status: RowStatus
}

const TODAY = new Date()

const schedule = computed((): ScheduleEntry[] => {
  if (!deal.value) return []
  const d = deal.value

  if (d.schedule?.length) {
    return d.schedule.map((row) => {
      const due = new Date(row.dueDate)
      let status: RowStatus
      if (row.paid) {
        status = 'paid'
      } else if (due < TODAY) {
        status = d.status === 'overdue' ? 'overdue' : 'paid'
      } else {
        status = 'pending'
      }
      return { index: row.index, date: row.dueDate, amount: row.amount, status }
    })
  }

  // Fallback: compute from totals
  const monthly = Math.round(d.totalPayable / d.termMonths)
  const base = new Date(d.createdAt)
  return Array.from({ length: d.termMonths }, (_, i) => {
    const payDate = new Date(base.getFullYear(), base.getMonth() + i + 1, d.paymentDay ?? 5)
    const isPast = payDate < TODAY
    let status: RowStatus
    if (d.status === 'closed') status = 'paid'
    else if (isPast) status = d.status === 'overdue' ? 'overdue' : 'paid'
    else status = 'pending'
    return {
      index: i + 1,
      date: payDate.toISOString(),
      amount: i === d.termMonths - 1 ? d.totalPayable - monthly * (d.termMonths - 1) : monthly,
      status,
    }
  })
})

const paidTotal = computed(() =>
  schedule.value.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0),
)
const remainingBalance = computed(() => (deal.value ? deal.value.totalPayable - paidTotal.value : 0))

// ── Status timeline ────────────────────────────────────────────────────────

interface TimelineEvent {
  key: string
  label: string
  description: string
  icon: string
  time: string
  variant: 'done' | 'current' | 'future'
}

const timeline = computed((): TimelineEvent[] => {
  if (!deal.value) return []
  const d = deal.value
  const base = new Date(d.createdAt).getTime()
  const add = (mins: number) => new Date(base + mins * 60000).toISOString()
  const currentStatus = d.status

  const all: Array<Omit<TimelineEvent, 'variant'> & { forStatuses: string[] }> = [
    {
      key: 'created',
      label: t('dealDetail.tlCreated'),
      description: t('dealDetail.tlCreatedDesc', { agent: d.agentName }),
      icon: 'pi-plus-circle',
      time: d.createdAt,
      forStatuses: ['draft', 'scoring', 'approved', 'declined', 'active', 'overdue', 'closed'],
    },
    {
      key: 'scoring',
      label: t('dealDetail.tlScoring'),
      description: t('dealDetail.tlScoringDesc'),
      icon: 'pi-search',
      time: add(3),
      forStatuses: ['scoring', 'approved', 'declined', 'active', 'overdue', 'closed'],
    },
    {
      key: 'approved',
      label: t('dealDetail.tlApproved'),
      description: t('dealDetail.tlApprovedDesc', { score: d.scoreSum ?? 0 }),
      icon: 'pi-check-circle',
      time: add(6),
      forStatuses: ['approved', 'active', 'overdue', 'closed'],
    },
    {
      key: 'declined',
      label: t('dealDetail.tlDeclined'),
      description: t('dealDetail.tlDeclinedDesc', { score: d.scoreSum ?? 0 }),
      icon: 'pi-times-circle',
      time: add(6),
      forStatuses: ['declined'],
    },
    {
      key: 'active',
      label: t('dealDetail.tlActive'),
      description: t('dealDetail.tlActiveDesc'),
      icon: 'pi-bolt',
      time: add(15),
      forStatuses: ['active', 'overdue', 'closed'],
    },
    {
      key: 'overdue',
      label: t('dealDetail.tlOverdue'),
      description: t('dealDetail.tlOverdueDesc'),
      icon: 'pi-exclamation-triangle',
      time: add(d.termMonths * 43200 * 0.4),
      forStatuses: ['overdue'],
    },
    {
      key: 'closed',
      label: t('dealDetail.tlClosed'),
      description: t('dealDetail.tlClosedDesc'),
      icon: 'pi-verified',
      time: add(d.termMonths * 43200),
      forStatuses: ['closed'],
    },
  ]

  const relevant = all.filter((e) => e.forStatuses.includes(currentStatus))
  const lastIndex = relevant.length - 1

  return relevant.map((e, i) => ({
    key: e.key,
    label: e.label,
    description: e.description,
    icon: e.icon,
    time: e.time,
    variant:
      i < lastIndex
        ? 'done'
        : currentStatus === 'declined'
        ? 'current'
        : i === lastIndex
        ? 'current'
        : 'done',
  }))
})

// ── Accounting ledger ──────────────────────────────────────────────────────

interface LedgerEntry {
  date: string
  amount: number
  type: string
  balance: number
}

const ledger = computed((): LedgerEntry[] => {
  if (!deal.value) return []
  const paid = schedule.value.filter((r) => r.status === 'paid')
  let balance = deal.value.totalPayable
  return paid.map((r) => {
    balance -= r.amount
    return { date: r.date, amount: r.amount, type: t('dealDetail.installmentPayment'), balance }
  })
})

// ── Overdue rows ───────────────────────────────────────────────────────────

const overdueRows = computed(() =>
  schedule.value
    .filter((r) => r.status === 'overdue')
    .map((r) => {
      const due = new Date(r.date)
      const days = Math.floor((TODAY.getTime() - due.getTime()) / 86400000)
      return { ...r, daysOverdue: days }
    }),
)

function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}
</script>

<template>
  <!-- ── Loading ─────────────────────────────────────────────────────────── -->
  <div v-if="isLoading" class="state-card surface-card">
    <i class="pi pi-spin pi-spinner" style="font-size:2rem" />
  </div>

  <!-- ── Error ───────────────────────────────────────────────────────────── -->
  <div v-else-if="isError" class="state-card surface-card">
    <i class="pi pi-exclamation-circle" style="color:var(--danger)" />
    <p>{{ $t('common.error') }}</p>
    <button class="btn-ghost" @click="router.push('/deals')">{{ $t('dealDetail.backToDeals') }}</button>
  </div>

  <!-- ── Not found ───────────────────────────────────────────────────────── -->
  <div v-else-if="!deal" class="state-card surface-card">
    <i class="pi pi-exclamation-circle" />
    <p>{{ $t('dealDetail.notFound') }}</p>
    <button class="btn-ghost" @click="router.push('/deals')">{{ $t('dealDetail.toDeals') }}</button>
  </div>

  <!-- ── Content ─────────────────────────────────────────────────────────── -->
  <div v-else class="page">

    <!-- Page header -->
    <div class="page-hdr">
      <div class="breadcrumb">
        <button class="bc-back" @click="router.push('/deals')">
          <i class="pi pi-arrow-left" /> {{ $t('dealDetail.backToDeals') }}
        </button>
        <span class="bc-sep">/</span>
        <span class="bc-current font-mono">{{ deal.dealNumber }}</span>
        <StatusBadge :status="(deal.status as any)" />
      </div>
      <div class="hdr-meta muted">
        <span>{{ deal.merchantName }}</span>
        <span class="sep">·</span>
        <span>{{ formatDateTime(deal.createdAt) }}</span>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="tab-bar">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- ── Сделка ─────────────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'deal'" class="surface-card deal-card">
      <div class="top-section">
        <div class="fields-grid">
          <div class="field-row">
            <span class="fl">{{ $t('dealDetail.finProduct') }}</span>
            <span class="fv">{{ deal.termMonths }} {{ $t('dealDetail.month') }}</span>
            <span class="fl">{{ $t('dealDetail.dealDate') }}</span>
            <span class="fv">{{ formatDateTime(deal.createdAt) }}</span>
          </div>
          <div class="field-row">
            <span class="fl">{{ $t('dealDetail.dealNumber') }}</span>
            <span class="fv font-mono deal-id-val">{{ deal.dealNumber }}</span>
            <span class="fl">{{ $t('dealDetail.status') }}</span>
            <span class="fv"><StatusBadge :status="(deal.status as any)" /></span>
          </div>
          <div class="field-row">
            <span class="fl">{{ $t('dealDetail.dealCost') }}</span>
            <span class="fv font-mono">{{ formatSomShort(deal.totalPayable) }} {{ $t('dealDetail.som') }}</span>
            <span class="fl">{{ $t('dealDetail.merchantPrice') }}</span>
            <span class="fv font-mono">{{ formatSomShort(deal.amount) }} {{ $t('dealDetail.som') }}</span>
          </div>
          <div class="field-row">
            <span class="fl">{{ $t('dealDetail.merchant') }}</span>
            <span class="fv">{{ deal.merchantName }}</span>
            <span class="fl">{{ $t('dealDetail.paymentDay') }}</span>
            <span class="fv font-mono">{{ deal.paymentDay ?? '—' }}</span>
          </div>
          <div class="field-row">
            <span class="fl">{{ $t('dealDetail.prepayment') }}</span>
            <span class="fv font-mono">0 {{ $t('dealDetail.som') }}</span>
            <span class="fl">{{ $t('dealDetail.markup') }}</span>
            <span class="fv">{{ ustama }}</span>
          </div>
          <div class="field-row last">
            <span class="fl">{{ $t('dealDetail.commission') }}</span>
            <span class="fv font-mono">0</span>
            <span class="fl"></span><span class="fv"></span>
          </div>
        </div>
        <div class="side-panels">
          <div class="side-panel">
            <span class="panel-role">{{ $t('dealDetail.agent') }}</span>
            <span class="panel-name">{{ deal.agentName }}</span>
            <span class="panel-sub muted font-mono">{{ deal.tariffName }}</span>
          </div>
          <div class="side-panel">
            <span class="panel-role">{{ $t('dealDetail.client') }}</span>
            <span class="panel-name">{{ deal.clientName }}</span>
            <span class="panel-sub muted font-mono">{{ deal.clientPhone }}</span>
            <span class="panel-sub muted font-mono">{{ deal.clientPinfl }}</span>
          </div>
        </div>
      </div>

      <!-- Basket -->
      <div class="section">
        <h4 class="section-title">{{ $t('dealDetail.products') }} ({{ deal.basket.length }})</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ $t('dealDetail.thNum') }}</th>
              <th>{{ $t('dealDetail.thName') }}</th>
              <th>{{ $t('dealDetail.thMxik') }}</th>
              <th>{{ $t('dealDetail.thQty') }}</th>
              <th>{{ $t('dealDetail.thPrice') }}</th>
              <th>{{ $t('dealDetail.thTotal') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in deal.basket" :key="i">
              <td class="font-mono muted">{{ i + 1 }}</td>
              <td>{{ item.productName }}</td>
              <td class="font-mono muted">{{ item.mxikCode ?? '—' }}</td>
              <td class="font-mono">{{ item.quantity }}</td>
              <td class="font-mono">{{ formatSomShort(Math.round(parseFloat(item.tanNarxi) * 100)) }}</td>
              <td class="font-mono">{{ formatSomShort(basketItemTotal(item)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Score breakdown (if factors available) -->
      <div v-if="deal.factors.length" class="section">
        <h4 class="section-title">{{ $t('dealDetail.scoreBreakdown') }} · {{ deal.scoreSum ?? '—' }}</h4>
        <div v-for="(f, i) in deal.factors" :key="i" class="factor-row">
          <span class="f-label muted">{{ f.label }}</span>
          <span
            class="f-weight font-mono"
            :style="{ color: f.weight >= 0 ? 'var(--success)' : 'var(--danger)' }"
          >
            {{ f.weight >= 0 ? '+' : '' }}{{ f.weight.toFixed(2) }}
          </span>
          <span class="f-value font-mono muted">{{ f.value }}</span>
        </div>
      </div>

      <!-- Contract summary -->
      <div class="section">
        <h4 class="section-title">{{ $t('dealDetail.tabContracts') }}</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ $t('dealDetail.contractNumber') }}</th>
              <th>{{ $t('dealDetail.type') }}</th>
              <th>{{ $t('dealDetail.client') }}</th>
              <th>{{ $t('dealDetail.term') }}</th>
              <th>{{ $t('dealDetail.dateCol') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="font-mono">{{ deal.dealNumber }}</td>
              <td>{{ $t('dealDetail.murabaha') }}</td>
              <td>{{ deal.clientName }}</td>
              <td>{{ deal.termMonths }} {{ $t('dealDetail.month') }}</td>
              <td class="font-mono">{{ formatDate(deal.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Status timeline ───────────────────────────────────────────────── -->
    <div v-else-if="activeTab === 'status'" class="surface-card deal-card">
      <div class="section">
        <h4 class="section-title">{{ $t('dealDetail.statusHistory') }}</h4>
        <div class="timeline">
          <div
            v-for="(event, i) in timeline"
            :key="event.key"
            class="tl-item"
            :class="event.variant"
          >
            <div class="tl-track">
              <div class="tl-dot"><i :class="`pi ${event.icon}`" /></div>
              <div v-if="i < timeline.length - 1" class="tl-line" />
            </div>
            <div class="tl-body">
              <div class="tl-label">{{ event.label }}</div>
              <div class="tl-desc muted">{{ event.description }}</div>
              <div class="tl-time font-mono muted">{{ formatDateTime(event.time) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Contracts ─────────────────────────────────────────────────────── -->
    <div v-else-if="activeTab === 'contracts'" class="surface-card deal-card">
      <div class="section">
        <div class="kontrakt-header">
          <div>
            <h4 class="section-title" style="margin-bottom:.2rem">{{ $t('dealDetail.contractNo', { id: deal.dealNumber }) }}</h4>
            <span class="muted" style="font-size:.82rem">{{ $t('dealDetail.typeDate', { date: formatDate(deal.createdAt) }) }}</span>
          </div>
          <span class="k-badge">{{ $t('dealDetail.activeContract') }}</span>
        </div>
      </div>

      <div class="section">
        <h4 class="section-title">{{ $t('dealDetail.contractParties') }}</h4>
        <div class="k-parties">
          <div class="k-party">
            <span class="kp-role">{{ $t('dealDetail.seller') }}</span>
            <span class="kp-name">{{ deal.merchantName }}</span>
          </div>
          <div class="k-party">
            <span class="kp-role">{{ $t('dealDetail.buyer') }}</span>
            <span class="kp-name">{{ deal.clientName }}</span>
            <span class="kp-sub muted font-mono">{{ $t('dealDetail.pinfl', { pinfl: deal.clientPinfl }) }}</span>
            <span class="kp-sub muted font-mono">{{ deal.clientPhone }}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h4 class="section-title">{{ $t('dealDetail.financialTerms') }}</h4>
        <div class="k-terms">
          <div class="k-term">
            <span class="fl">{{ $t('dealDetail.merchantPriceTerm') }}</span>
            <span class="kv font-mono">{{ formatSomShort(deal.amount) }} {{ $t('dealDetail.som') }}</span>
          </div>
          <div class="k-term">
            <span class="fl">{{ $t('dealDetail.markupUstama') }}</span>
            <span class="kv">{{ ustama }}</span>
          </div>
          <div class="k-term">
            <span class="fl">{{ $t('dealDetail.dealCostTerm') }}</span>
            <span class="kv font-mono">{{ formatSomShort(deal.totalPayable) }} {{ $t('dealDetail.som') }}</span>
          </div>
          <div class="k-term">
            <span class="fl">{{ $t('dealDetail.installmentTerm') }}</span>
            <span class="kv">{{ $t('dealDetail.monthsValue', { count: deal.termMonths }) }}</span>
          </div>
          <div class="k-term">
            <span class="fl">{{ $t('dealDetail.monthlyPayment') }}</span>
            <span class="kv font-mono">{{ formatSomShort(Math.round(deal.totalPayable / deal.termMonths)) }} {{ $t('dealDetail.som') }}</span>
          </div>
          <div class="k-term">
            <span class="fl">{{ $t('dealDetail.paymentDayTerm') }}</span>
            <span class="kv">{{ $t('dealDetail.paymentDayValue', { day: deal.paymentDay ?? 5 }) }}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h4 class="section-title">{{ $t('dealDetail.contractProducts') }}</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ $t('dealDetail.thNum') }}</th>
              <th>{{ $t('dealDetail.thName') }}</th>
              <th>{{ $t('dealDetail.thMxik') }}</th>
              <th>{{ $t('dealDetail.thQty') }}</th>
              <th>{{ $t('dealDetail.thPrice') }}</th>
              <th>{{ $t('dealDetail.thTotal') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in deal.basket" :key="i">
              <td class="font-mono">{{ i + 1 }}</td>
              <td>{{ item.productName }}</td>
              <td class="font-mono muted">{{ item.mxikCode ?? '—' }}</td>
              <td class="font-mono">{{ item.quantity }}</td>
              <td class="font-mono">{{ formatSomShort(Math.round(parseFloat(item.tanNarxi) * 100)) }}</td>
              <td class="font-mono">{{ formatSomShort(basketItemTotal(item)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="section">
        <h4 class="section-title">{{ $t('dealDetail.signatures') }}</h4>
        <div class="k-sigs">
          <div class="k-sig">
            <i class="pi pi-check-circle" style="color:var(--success)" />
            <div>
              <div class="ks-name">{{ $t('dealDetail.agentSigned', { name: deal.agentName }) }}</div>
              <div class="muted" style="font-size:.8rem">{{ $t('dealDetail.signedAt', { date: formatDateTime(deal.createdAt) }) }}</div>
            </div>
          </div>
          <div class="k-sig">
            <i class="pi pi-check-circle" style="color:var(--success)" />
            <div>
              <div class="ks-name">{{ $t('dealDetail.clientSigned', { name: deal.clientName }) }}</div>
              <div class="muted" style="font-size:.8rem">{{ $t('dealDetail.otpConfirmed', { date: formatDateTime(deal.createdAt) }) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Accounting ─────────────────────────────────────────────────────── -->
    <div v-else-if="activeTab === 'accounting'" class="surface-card deal-card">
      <div class="section">
        <div class="uchet-summary">
          <div class="us-card">
            <span class="us-label">{{ $t('dealDetail.totalDue') }}</span>
            <span class="us-val font-mono">{{ formatSomShort(deal.totalPayable) }} {{ $t('dealDetail.som') }}</span>
          </div>
          <div class="us-card success">
            <span class="us-label">{{ $t('dealDetail.paid') }}</span>
            <span class="us-val font-mono">{{ formatSomShort(paidTotal) }} {{ $t('dealDetail.som') }}</span>
          </div>
          <div class="us-card warn">
            <span class="us-label">{{ $t('dealDetail.remaining') }}</span>
            <span class="us-val font-mono">{{ formatSomShort(remainingBalance) }} {{ $t('dealDetail.som') }}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h4 class="section-title">{{ $t('dealDetail.transactions') }}</h4>
        <div v-if="ledger.length === 0" class="empty-state">
          <i class="pi pi-inbox" /><p>{{ $t('dealDetail.noPayments') }}</p>
        </div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>{{ $t('dealDetail.dateCol') }}</th>
              <th>{{ $t('dealDetail.operationType') }}</th>
              <th>{{ $t('dealDetail.amountCol') }}</th>
              <th>{{ $t('dealDetail.balanceCol') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, i) in ledger" :key="i">
              <td class="font-mono">{{ formatDateShort(entry.date) }}</td>
              <td>{{ entry.type }}</td>
              <td class="font-mono" style="color:var(--success)">+ {{ formatSomShort(entry.amount) }} {{ $t('dealDetail.som') }}</td>
              <td class="font-mono">{{ formatSomShort(entry.balance) }} {{ $t('dealDetail.som') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Overdue ────────────────────────────────────────────────────────── -->
    <div v-else-if="activeTab === 'overdue'" class="surface-card deal-card">
      <div class="section">
        <div v-if="overdueRows.length === 0" class="empty-state">
          <i class="pi pi-check-circle" style="color:var(--success)" />
          <p style="color:var(--success)">{{ $t('dealDetail.noOverdue') }}</p>
          <span class="muted" style="font-size:.85rem">{{ $t('dealDetail.allPaidOnTime') }}</span>
        </div>
        <template v-else>
          <div class="overdue-alert">
            <i class="pi pi-exclamation-triangle" />
            <span>{{ $t('dealDetail.overdueDetected', { count: overdueRows.length }) }}</span>
          </div>
          <table class="data-table" style="margin-top:1rem">
            <thead>
              <tr>
                <th>{{ $t('dealDetail.payment') }}</th>
                <th>{{ $t('dealDetail.paymentDate') }}</th>
                <th>{{ $t('dealDetail.amountCol') }}</th>
                <th>{{ $t('dealDetail.daysOverdue') }}</th>
                <th>{{ $t('dealDetail.status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in overdueRows" :key="row.index">
                <td class="font-mono">{{ row.index }}</td>
                <td class="font-mono">{{ formatDateShort(row.date) }}</td>
                <td class="font-mono">{{ formatSomShort(row.amount) }} {{ $t('dealDetail.som') }}</td>
                <td><span class="days-badge">{{ row.daysOverdue }} {{ $t('dealDetail.days') }}</span></td>
                <td><span class="overdue-pill">{{ $t('dealDetail.overduePill') }}</span></td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
    </div>

    <!-- ── Comments ────────────────────────────────────────────────────────── -->
    <div v-else-if="activeTab === 'comments'" class="surface-card deal-card">
      <div class="section">
        <div v-if="!comments?.length" class="empty-state">
          <i class="pi pi-comment" />
          <p>{{ $t('dealDetail.commentsEmpty') }}</p>
        </div>
        <div v-else class="comment-list">
          <div v-for="c in comments" :key="c.id" class="comment-item">
            <div class="comment-meta">
              <span class="comment-author">{{ c.authorName }}</span>
              <span class="muted font-mono comment-time">{{ formatDateTime(c.createdAt) }}</span>
            </div>
            <p class="comment-text">{{ c.text }}</p>
          </div>
        </div>
      </div>
      <div class="section comment-form">
        <textarea
          v-model="newComment"
          class="comment-textarea"
          :placeholder="$t('dealDetail.commentPlaceholder')"
          rows="3"
          :disabled="isSubmitting"
          @keydown.ctrl.enter="submitComment"
        />
        <div class="comment-form-footer">
          <button class="btn-primary" :disabled="!newComment.trim() || isSubmitting" @click="submitComment">
            <i class="pi pi-send" />
            {{ isSubmitting ? $t('dealDetail.commentSubmitting') : $t('dealDetail.commentSubmit') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Schedule ───────────────────────────────────────────────────────── -->
    <div v-else-if="activeTab === 'schedule'" class="surface-card deal-card">
      <div class="section grafik-header-row">
        <h4 class="section-title" style="margin:0">{{ $t('dealDetail.paymentSchedule') }}</h4>
        <div class="grafik-legend">
          <span class="leg paid">{{ $t('dealDetail.legendPaid') }}</span>
          <span class="leg overdue">{{ $t('dealDetail.legendOverdue') }}</span>
          <span class="leg pending">{{ $t('dealDetail.legendPending') }}</span>
        </div>
      </div>
      <div class="section" style="padding-top:0;border-top:none">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ $t('dealDetail.thNum') }}</th>
              <th>{{ $t('dealDetail.paymentDate') }}</th>
              <th>{{ $t('dealDetail.amountCol') }}</th>
              <th>{{ $t('dealDetail.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in schedule" :key="row.index">
              <td class="font-mono muted">{{ row.index }}</td>
              <td class="font-mono">{{ formatDateShort(row.date) }}</td>
              <td class="font-mono">{{ formatSomShort(row.amount) }} {{ $t('dealDetail.som') }}</td>
              <td>
                <span class="row-pill" :class="row.status">
                  {{
                    row.status === 'paid'
                      ? $t('dealDetail.pillPaid')
                      : row.status === 'overdue'
                      ? $t('dealDetail.pillOverdue')
                      : $t('dealDetail.pillPending')
                  }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="section grafik-footer">
        <div class="gf-item">
          <span class="fl muted">{{ $t('dealDetail.totalPayments') }}</span>
          <span class="font-mono">{{ deal.termMonths }}</span>
        </div>
        <div class="gf-item">
          <span class="fl muted">{{ $t('dealDetail.paid') }}</span>
          <span class="font-mono" style="color:var(--success)">{{ schedule.filter(r => r.status === 'paid').length }}</span>
        </div>
        <div class="gf-item">
          <span class="fl muted">{{ $t('dealDetail.remaining') }}</span>
          <span class="font-mono">{{ formatSomShort(remainingBalance) }} {{ $t('dealDetail.som') }}</span>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Layout ───────────────────────────────────────────────────────────────── */
.page { display: flex; flex-direction: column; gap: 0; }

/* ── Page header ──────────────────────────────────────────────────────────── */
.page-hdr {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1.2rem; flex-wrap: wrap; gap: 0.5rem;
}
.breadcrumb { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; flex-wrap: wrap; }
.bc-back {
  display: inline-flex; align-items: center; gap: 0.35rem;
  background: transparent; border: none; color: var(--text-secondary);
  font-weight: 600; cursor: pointer; font-size: 0.9rem; font-family: inherit; padding: 0;
}
.bc-back:hover { color: var(--accent-2); }
.bc-sep { color: var(--text-secondary); }
.bc-current { font-weight: 700; color: var(--text-primary); font-size: 0.85rem; }
.hdr-meta { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; }
.hdr-meta .sep { opacity: 0.4; }

/* ── Tab bar ──────────────────────────────────────────────────────────────── */
.tab-bar {
  display: flex; border-bottom: 2px solid var(--border-subtle); margin-bottom: 1.2rem; overflow-x: auto;
}
.tab-btn {
  background: transparent; border: none; padding: 0.65rem 1.1rem;
  font-size: 0.875rem; font-weight: 600; color: var(--text-secondary);
  cursor: pointer; position: relative; font-family: inherit; white-space: nowrap;
  transition: color 0.15s ease; flex-shrink: 0;
}
.tab-btn::after {
  content: ''; position: absolute; bottom: -2px; left: 0; right: 0;
  height: 2px; background: var(--gradient-hero); opacity: 0; transition: opacity 0.15s ease;
}
.tab-btn.active { color: var(--text-primary); }
.tab-btn.active::after { opacity: 1; }
.tab-btn:hover:not(.active) { color: var(--text-primary); }

/* ── Card shell ───────────────────────────────────────────────────────────── */
.deal-card { padding: 0; overflow: hidden; }

/* ── Top section ──────────────────────────────────────────────────────────── */
.top-section { display: flex; border-bottom: 1px solid var(--border-subtle); }
.fields-grid { flex: 1; min-width: 0; }
.field-row {
  display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;
  border-bottom: 1px solid var(--border-subtle);
}
.field-row.last { border-bottom: none; }
.fl {
  padding: 0.7rem 1.4rem; font-size: 0.82rem; color: var(--text-secondary);
  font-weight: 500; display: flex; align-items: center;
}
.fv {
  padding: 0.7rem 0.8rem 0.7rem 0; font-size: 0.88rem; font-weight: 600;
  display: flex; align-items: center; overflow: hidden;
}
.deal-id-val { font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.side-panels { width: 220px; flex-shrink: 0; border-left: 1px solid var(--border-subtle); display: flex; flex-direction: column; }
.side-panel { flex: 1; padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.15rem; }
.side-panel + .side-panel { border-top: 1px solid var(--border-subtle); }
.panel-role { font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.panel-name { font-size: 0.95rem; font-weight: 800; margin-top: 0.15rem; }
.panel-sub { font-size: 0.78rem; }

/* ── Section ──────────────────────────────────────────────────────────────── */
.section { padding: 1.2rem 1.4rem; border-top: 1px solid var(--border-subtle); }
.section-title { margin: 0 0 0.9rem; font-size: 0.92rem; font-weight: 800; }

/* ── Data table ───────────────────────────────────────────────────────────── */
.data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.data-table th {
  text-align: left; padding: 0.55rem 0.9rem;
  font-size: 0.72rem; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.05em;
  background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle);
}
.data-table td { padding: 0.75rem 0.9rem; border-bottom: 1px solid var(--border-subtle); }
.data-table tbody tr:last-child td { border-bottom: none; }

/* ── Score factors ────────────────────────────────────────────────────────── */
.factor-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.32rem 0; font-size: 0.82rem; }
.f-label { flex: 1; }
.f-weight { width: 52px; text-align: right; font-weight: 700; }
.f-value { width: 60px; text-align: right; }

/* ── Timeline ─────────────────────────────────────────────────────────────── */
.timeline { display: flex; flex-direction: column; }
.tl-item { display: flex; gap: 1rem; }
.tl-track { display: flex; flex-direction: column; align-items: center; width: 36px; flex-shrink: 0; }
.tl-dot {
  width: 36px; height: 36px; border-radius: 50%;
  display: grid; place-items: center; font-size: 1rem;
  border: 2px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-secondary); flex-shrink: 0;
}
.tl-item.done .tl-dot { background: color-mix(in srgb, var(--success) 15%, transparent); border-color: var(--success); color: var(--success); }
.tl-item.current .tl-dot { background: var(--gradient-hero); border-color: transparent; color: #fff; box-shadow: 0 0 12px color-mix(in srgb, var(--accent-1) 40%, transparent); }
.tl-line { flex: 1; width: 2px; background: var(--border-subtle); margin: 4px 0; min-height: 2rem; }
.tl-item.done .tl-line { background: color-mix(in srgb, var(--success) 40%, transparent); }
.tl-body { padding: 0.4rem 0 1.6rem; }
.tl-label { font-size: 0.92rem; font-weight: 700; margin-bottom: 0.2rem; }
.tl-desc { font-size: 0.82rem; margin-bottom: 0.3rem; }
.tl-time { font-size: 0.78rem; }

/* ── Kontrakty ────────────────────────────────────────────────────────────── */
.kontrakt-header { display: flex; align-items: flex-start; justify-content: space-between; }
.k-badge { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 999px; }
.k-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; }
.k-party { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.2rem; }
.kp-role { font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
.kp-name { font-size: 1rem; font-weight: 800; margin-top: 0.2rem; }
.kp-sub { font-size: 0.8rem; }
.k-terms { display: flex; flex-direction: column; }
.k-term { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0; border-bottom: 1px solid var(--border-subtle); font-size: 0.88rem; }
.k-term:last-child { border-bottom: none; }
.kv { font-weight: 700; }
.k-sigs { display: flex; flex-direction: column; gap: 1rem; }
.k-sig { display: flex; align-items: flex-start; gap: 0.7rem; font-size: 0.88rem; }
.k-sig i { font-size: 1.2rem; margin-top: 0.1rem; }
.ks-name { font-weight: 700; }

/* ── Accounting ───────────────────────────────────────────────────────────── */
.uchet-summary { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; }
.us-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.3rem; }
.us-card.success { border-color: color-mix(in srgb, var(--success) 30%, transparent); }
.us-card.warn { border-color: color-mix(in srgb, var(--warning) 30%, transparent); }
.us-label { font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
.us-val { font-size: 1rem; font-weight: 800; }
.us-card.success .us-val { color: var(--success); }
.us-card.warn .us-val { color: var(--warning); }

/* ── Overdue ──────────────────────────────────────────────────────────────── */
.overdue-alert { display: flex; align-items: center; gap: 0.6rem; background: var(--danger-bg); border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent); border-radius: 10px; padding: 0.75rem 1rem; color: var(--danger); font-weight: 600; font-size: 0.88rem; }
.days-badge { background: var(--danger-bg); color: var(--danger); font-size: 0.78rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 6px; }
.overdue-pill { background: var(--danger-bg); color: var(--danger); font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 999px; }

/* ── Schedule ─────────────────────────────────────────────────────────────── */
.grafik-header-row { display: flex; align-items: center; justify-content: space-between; }
.grafik-legend { display: flex; gap: 1rem; }
.leg { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; font-weight: 600; }
.leg::before { content: ''; width: 8px; height: 8px; border-radius: 2px; }
.leg.paid::before { background: var(--success); }
.leg.overdue::before { background: var(--danger); }
.leg.pending::before { background: var(--warning); }
.row-pill { display: inline-flex; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
.row-pill.paid { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }
.row-pill.overdue { background: var(--danger-bg); color: var(--danger); }
.row-pill.pending { background: var(--warning-bg); color: var(--warning); }
.grafik-footer { display: flex; gap: 2.5rem; background: var(--bg-surface); }
.gf-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.88rem; }
.gf-item .fl { padding: 0; font-size: 0.82rem; }

/* ── State cards (loading / error / not-found) ────────────────────────────── */
.state-card { padding: 4rem 2rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; text-align: center; }
.state-card i { font-size: 2.4rem; color: var(--text-secondary); }
.state-card p { margin: 0; font-weight: 600; color: var(--text-secondary); }

/* ── Empty state ──────────────────────────────────────────────────────────── */
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 3rem 2rem; color: var(--text-secondary); text-align: center; }
.empty-state i { font-size: 2rem; opacity: 0.5; }
.empty-state p { margin: 0; font-weight: 600; font-size: 0.92rem; }

/* ── Comments ─────────────────────────────────────────────────────────────── */
.comment-list { display: flex; flex-direction: column; gap: 0; }
.comment-item { padding: 0.9rem 0; border-bottom: 1px solid var(--border-subtle); }
.comment-item:last-child { border-bottom: none; }
.comment-meta { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.35rem; }
.comment-author { font-size: 0.82rem; font-weight: 700; }
.comment-time { font-size: 0.75rem; }
.comment-text { margin: 0; font-size: 0.88rem; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
.comment-form { display: flex; flex-direction: column; gap: 0.75rem; }
.comment-textarea {
  width: 100%; padding: 0.65rem 0.8rem; font-size: 0.88rem; font-family: inherit;
  background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px;
  color: var(--text-primary); resize: vertical; outline: none; box-sizing: border-box;
  transition: border-color 0.15s ease;
}
.comment-textarea:focus { border-color: var(--accent-2); }
.comment-textarea:disabled { opacity: 0.6; }
.comment-form-footer { display: flex; justify-content: flex-end; }
.btn-primary {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: var(--gradient-hero); color: #fff; border: none; border-radius: 8px;
  padding: 0.5rem 1.1rem; font-size: 0.85rem; font-weight: 700; font-family: inherit;
  cursor: pointer; transition: opacity 0.15s ease;
}
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Utilities ────────────────────────────────────────────────────────────── */
.muted { color: var(--text-secondary); }
</style>
