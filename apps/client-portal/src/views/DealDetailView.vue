<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDealsStore } from '@/stores/deals'
import StatusBadge from '@/components/StatusBadge.vue'
import MonoAmount from '@/components/MonoAmount.vue'
import { formatDateLong, formatSomShort, formatDealNumber } from '@/utils/money'

const route = useRoute()
const router = useRouter()
const deals = useDealsStore()

const loading = ref(false)
const deal = computed(() => deals.byId(route.params.id as string))

onMounted(async () => {
  const id = route.params.id as string
  const existing = deals.byId(id)
  if (!existing || !existing.schedule?.length) {
    loading.value = true
    await deals.fetchById(id)
    loading.value = false
  }
})

type Tab = 'schedule' | 'payments'
const tab = ref<Tab>('schedule')

const tabs: { key: Tab; labelKey: string; icon: string }[] = [
  { key: 'schedule', labelKey: 'dealDetail.tabSchedule', icon: 'pi-calendar' },
  { key: 'payments', labelKey: 'dealDetail.tabPayments', icon: 'pi-wallet' },
]

const paidEntries = computed(() =>
  deal.value?.schedule?.filter((e) => e.paid || e.paidAmount > 0) ?? [],
)

function back() {
  router.back()
}

function pay() {
}
</script>

<template>
  <div v-if="loading" class="loading-wrap">
    <i class="pi pi-spin pi-spinner" />
  </div>

  <div v-else-if="deal" class="detail">
    <button class="back-btn" @click="back">
      <i class="pi pi-arrow-left" /> {{ $t('dealDetail.back') }}
    </button>

    <header class="dh surface-card">
      <div class="dh-top">
        <div>
          <div class="dh-merchant">{{ deal.merchant }}</div>
          <div class="dh-id font-mono">{{ formatDealNumber(deal.dealNumber) }}</div>
        </div>
        <StatusBadge :status="deal.status" />
      </div>
      <MonoAmount :value="deal.amount" size="xl" :gradient="true" />
      <div class="dh-meta">
        <span>{{ deal.tariffLabel }}</span>
        <span class="dot">·</span>
        <span>{{ deal.termMonths }} {{ $t('common.mo') }}</span>
        <span class="dot">·</span>
        <span>{{ $t('dealDetail.markup') }} {{ deal.markupPercent }}%</span>
      </div>
      <div class="dh-progress">
        <div class="dh-track">
          <div class="dh-fill" :style="{ width: `${(deal.paymentsMade / deal.paymentsTotal) * 100}%` }" />
        </div>
        <span class="dh-progress-label font-mono">{{ deal.paymentsMade }}/{{ deal.paymentsTotal }}</span>
      </div>
      <button v-if="deal.status !== 'closed'" class="btn-gradient dh-pay" @click="pay">
        {{ $t('dealDetail.payInstalment') }}
      </button>
    </header>

    <!-- tabs -->
    <nav class="tabs">
      <button v-for="t in tabs" :key="t.key" class="tab" :class="{ active: tab === t.key }" @click="tab = t.key">
        <i class="pi" :class="t.icon" />
        {{ $t(t.labelKey) }}
      </button>
    </nav>

    <!-- Schedule -->
    <section v-if="tab === 'schedule'" class="panel surface-card">
      <div class="sched-head">
        <span class="col-no">{{ $t('dealDetail.colNo') }}</span>
        <span class="col-date">{{ $t('dealDetail.colDate') }}</span>
        <span class="col-amt">{{ $t('dealDetail.colAmt') }}</span>
        <span class="col-st">{{ $t('dealDetail.colStatus') }}</span>
      </div>
      <div v-for="row in deal.schedule" :key="row.no" class="sched-row"
        :class="{ overdue: !row.paid && deal.status === 'overdue' && row.no === deal.paymentsMade + 1 }">
        <span class="col-no font-mono">{{ row.no }}</span>
        <span class="col-date font-mono">{{ formatDateLong(row.dueDate) }}</span>
        <span class="col-amt font-mono">{{ formatSomShort(row.amount) }}</span>
        <span class="col-st">
          <span v-if="row.paid" class="pill paid">
            <i class="pi pi-check" /> {{ $t('dealDetail.statusPaid') }}
          </span>
          <span v-else-if="row.paidAmount > 0" class="pill partial">
            <i class="pi pi-circle-fill" /> {{ $t('dealDetail.statusPartial') }}
          </span>
          <span v-else-if="!row.paid && deal.status === 'overdue' && row.no === deal.paymentsMade + 1"
            class="pill overdue">
            <i class="pi pi-exclamation-triangle" /> {{ $t('dealDetail.statusOverdue') }}
          </span>
          <span v-else class="pill upcoming">
            <i class="pi pi-clock" /> {{ $t('dealDetail.statusUpcoming') }}
          </span>
        </span>
      </div>
    </section>

    <!-- Payments -->
    <section v-else class="panel surface-card">
      <div v-if="!paidEntries.length" class="empty">
        {{ $t('dealDetail.noPayments') }}
      </div>
      <div v-for="p in paidEntries" :key="p.no" class="pay-row">
        <div class="pay-icon" :class="{ partial: !p.paid && p.paidAmount > 0 }">
          <i :class="p.paid ? 'pi pi-check-circle' : 'pi pi-circle-fill'" />
        </div>
        <div class="pay-mid">
          <span class="pay-date font-mono">{{ formatDateLong(p.paidAt ?? p.dueDate) }}</span>
          <span class="pay-label">{{ $t('dealDetail.instalmentNo', { no: p.no }) }}</span>
        </div>
        <div class="pay-right">
          <span class="pay-amt font-mono">{{ formatSomShort(p.paid ? p.amount : p.paidAmount) }} {{ $t('common.som') }}</span>
          <span v-if="!p.paid && p.paidAmount > 0" class="pay-partial-label">
            {{ $t('dealDetail.statusPartial') }}
          </span>
        </div>
      </div>
    </section>
  </div>

  <div v-else class="missing">
    <i class="pi pi-exclamation-circle" />
    <p>{{ $t('dealDetail.notFound') }}</p>
    <button class="btn-ghost" @click="router.push({ name: 'deals' })">
      {{ $t('dealDetail.backToDeals') }}
    </button>
  </div>
</template>

<style scoped>
.loading-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40vh;
  font-size: 2rem;
  color: var(--accent-1);
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  align-self: flex-start;
}

.back-btn:hover {
  color: var(--accent-2);
}

.dh {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dh-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.dh-merchant {
  font-size: 1.2rem;
  font-weight: 800;
}

.dh-id {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.dh-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.dh-meta .dot {
  opacity: 0.5;
}

.dh-progress {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.dh-track {
  flex: 1;
  height: 8px;
  background: var(--bg-surface);
  border-radius: 999px;
  overflow: hidden;
}

.dh-fill {
  height: 100%;
  background: var(--gradient-hero);
  border-radius: 999px;
}

.dh-progress-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent-2);
}

.dh-pay {
  width: 100%;
  margin-top: 0.3rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 0.35rem;
}

.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.7rem 0.5rem;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab.active {
  background: var(--gradient-hero);
  color: #fff;
}

.tab i {
  font-size: 0.85rem;
}

.panel {
  padding: 1.25rem;
}

.empty {
  color: var(--text-secondary);
  font-size: 0.9rem;
  text-align: center;
  padding: 1.5rem 0;
}

.sched-head {
  display: grid;
  grid-template-columns: 32px 1fr auto auto;
  gap: 0.6rem;
  padding: 0 0 0.7rem;
  border-bottom: 2px solid var(--border-subtle);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.sched-row {
  display: grid;
  grid-template-columns: 32px 1fr auto auto;
  gap: 0.6rem;
  align-items: center;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.85rem;
}

.sched-row:last-child {
  border-bottom: none;
}

.sched-row.overdue {
  color: var(--danger);
}

.col-no {
  color: var(--text-secondary);
}

.col-amt {
  font-weight: 700;
  text-align: right;
}

.col-st {
  text-align: right;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.pill.paid {
  background: var(--success-bg);
  color: var(--success);
}

.pill.partial {
  background: color-mix(in srgb, var(--accent-2) 12%, transparent);
  color: var(--accent-2);
}

.pill.upcoming {
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.pill.overdue {
  background: var(--danger-bg);
  color: var(--danger);
}

.pay-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.95rem 0;
  border-bottom: 1px solid var(--border-subtle);
}

.pay-row:first-child {
  padding-top: 0;
}

.pay-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.pay-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--success-bg);
  color: var(--success);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.pay-icon.partial {
  background: color-mix(in srgb, var(--accent-2) 12%, transparent);
  color: var(--accent-2);
}

.pay-mid {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
  min-width: 0;
}

.pay-date {
  font-size: 0.88rem;
  font-weight: 700;
}

.pay-label {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.pay-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
  flex-shrink: 0;
}

.pay-partial-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--accent-2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.pay-amt {
  font-size: 0.88rem;
  font-weight: 800;
}

.missing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  padding: 4rem 1rem;
  text-align: center;
  color: var(--text-secondary);
}

.missing i {
  font-size: 2.2rem;
  color: var(--danger);
}
</style>
