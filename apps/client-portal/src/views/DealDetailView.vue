<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useDealsStore } from '@/stores/deals'
import StatusBadge from '@/components/StatusBadge.vue'
import MonoAmount from '@/components/MonoAmount.vue'
import { formatDateLong, formatSomShort } from '@/utils/money'

const route = useRoute()
const router = useRouter()
const deals = useDealsStore()
const toast = useToast()

const deal = computed(() => deals.byId(route.params.id as string))

type Tab = 'schedule' | 'payments' | 'contract'
const tab = ref<Tab>('schedule')

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'schedule', label: 'Schedule', icon: 'pi-calendar' },
  { key: 'payments', label: 'Payments', icon: 'pi-wallet' },
  { key: 'contract', label: 'Contract', icon: 'pi-file' },
]

function back() {
  router.back()
}

function downloadContract() {
  toast.add({
    severity: 'info',
    summary: 'Download started',
    detail: `Kontrakt ${deal.value?.contract.number}.pdf is being prepared`,
    life: 3000,
  })
}

function pay() {
  if (!deal.value) return
  toast.add({
    severity: 'success',
    summary: 'Payment started',
    detail: `Redirecting to pay for ${deal.value.merchant}`,
    life: 3000,
  })
}
</script>

<template>
  <div v-if="deal" class="detail">
    <button class="back-btn" @click="back">
      <i class="pi pi-arrow-left" /> Back
    </button>

    <header class="dh surface-card">
      <div class="dh-top">
        <div>
          <div class="dh-merchant">{{ deal.merchant }}</div>
          <div class="dh-id font-mono">{{ deal.id }}</div>
        </div>
        <StatusBadge :status="deal.status" />
      </div>
      <MonoAmount :value="deal.amount" size="xl" :gradient="true" />
      <div class="dh-meta">
        <span>{{ deal.tariffLabel }}</span>
        <span class="dot">·</span>
        <span>{{ deal.termMonths }} oy</span>
        <span class="dot">·</span>
        <span>Ustama {{ deal.markupPercent }}%</span>
      </div>
      <div class="dh-progress">
        <div class="dh-track">
          <div
            class="dh-fill"
            :style="{
              width: `${(deal.paymentsMade / deal.paymentsTotal) * 100}%`,
            }"
          />
        </div>
        <span class="dh-progress-label font-mono"
          >{{ deal.paymentsMade }}/{{ deal.paymentsTotal }}</span
        >
      </div>
      <button
        v-if="deal.status !== 'closed'"
        class="btn-gradient dh-pay"
        @click="pay"
      >
        Pay next instalment
      </button>
    </header>

    <!-- tabs -->
    <nav class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >
        <i class="pi" :class="t.icon" />
        {{ t.label }}
      </button>
    </nav>

    <!-- Schedule -->
    <section v-if="tab === 'schedule'" class="panel surface-card">
      <div class="sched-head">
        <span class="col-no">#</span>
        <span class="col-date">Date</span>
        <span class="col-amt">Amount</span>
        <span class="col-st">Status</span>
      </div>
      <div
        v-for="row in deal.schedule"
        :key="row.no"
        class="sched-row"
        :class="{ overdue: row.status === 'overdue' }"
      >
        <span class="col-no font-mono">{{ row.no }}</span>
        <span class="col-date font-mono">{{
          formatDateLong(row.dueDate)
        }}</span>
        <span class="col-amt font-mono">{{ formatSomShort(row.amount) }}</span>
        <span class="col-st">
          <span v-if="row.status === 'paid'" class="pill paid">
            <i class="pi pi-check" /> Paid
          </span>
          <span v-else-if="row.status === 'overdue'" class="pill overdue">
            <i class="pi pi-exclamation-triangle" /> Overdue
          </span>
          <span v-else class="pill upcoming">
            <i class="pi pi-clock" /> Upcoming
          </span>
        </span>
      </div>
    </section>

    <!-- Payments -->
    <section v-else-if="tab === 'payments'" class="panel surface-card">
      <div v-if="!deal.payments.length" class="empty">
        No payments recorded yet.
      </div>
      <div
        v-for="p in deal.payments"
        :key="p.id"
        class="pay-row"
      >
        <div class="pay-icon">
          <i class="pi pi-check-circle" />
        </div>
        <div class="pay-mid">
          <span class="pay-date font-mono">{{
            formatDateLong(p.date)
          }}</span>
          <span class="pay-txn font-mono">{{ p.txnId }}</span>
        </div>
        <div class="pay-right">
          <span class="pay-amt font-mono"
            >{{ formatSomShort(p.amount) }} so'm</span
          >
          <span class="pay-provider" :class="p.provider.toLowerCase()">{{
            p.provider
          }}</span>
        </div>
      </div>
    </section>

    <!-- Contract -->
    <section v-else class="panel surface-card contract">
      <div class="ct-doc">
        <div class="ct-icon"><i class="pi pi-file-pdf" /></div>
        <div class="ct-info">
          <div class="ct-title">
            Kontrakt {{ deal.contract.number }}
          </div>
          <div class="ct-sub">
            Signed {{ formatDateLong(deal.contract.signedAt) }}
          </div>
        </div>
        <span v-if="deal.contract.signed" class="pill paid">
          <i class="pi pi-check" /> Signed
        </span>
      </div>

      <div v-if="deal.contract.myIdVerified" class="ct-myid">
        <i class="pi pi-verified" />
        <div>
          <strong>MyID verified</strong>
          <span>Identity confirmed via MyID biometric check</span>
        </div>
      </div>

      <button class="btn-gradient ct-download" @click="downloadContract">
        <i class="pi pi-download" /> Download PDF
      </button>
    </section>
  </div>

  <div v-else class="missing">
    <i class="pi pi-exclamation-circle" />
    <p>Deal not found.</p>
    <button class="btn-ghost" @click="router.push({ name: 'deals' })">
      Back to deals
    </button>
  </div>
</template>

<style scoped>
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

/* header card */
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

/* tabs */
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

/* panels */
.panel {
  padding: 1.25rem;
}
.empty {
  color: var(--text-secondary);
  font-size: 0.9rem;
  text-align: center;
  padding: 1.5rem 0;
}

/* schedule */
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
.pill.upcoming {
  background: var(--bg-surface);
  color: var(--text-secondary);
}
.pill.overdue {
  background: var(--danger-bg);
  color: var(--danger);
}

/* payments */
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
.pay-txn {
  font-size: 0.72rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pay-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.3rem;
  flex-shrink: 0;
}
.pay-amt {
  font-size: 0.88rem;
  font-weight: 800;
}
.pay-provider {
  font-size: 0.68rem;
  font-weight: 800;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.pay-provider.payme {
  background: color-mix(in srgb, #00bfa5 18%, transparent);
  color: #00bfa5;
}
.pay-provider.click {
  background: color-mix(in srgb, #4a7dff 18%, transparent);
  color: #4a7dff;
}

/* contract */
.contract {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.ct-doc {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}
.ct-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: var(--bg-surface);
  color: var(--accent-2);
  display: grid;
  place-items: center;
  font-size: 1.3rem;
  flex-shrink: 0;
}
.ct-info {
  flex: 1;
}
.ct-title {
  font-size: 0.98rem;
  font-weight: 800;
}
.ct-sub {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.15rem;
}
.ct-myid {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--success-bg);
  border-radius: 12px;
  padding: 0.9rem 1rem;
}
.ct-myid i {
  color: var(--success);
  font-size: 1.3rem;
}
.ct-myid strong {
  display: block;
  font-size: 0.88rem;
  color: var(--success);
}
.ct-myid span {
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.ct-download {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

/* missing */
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
