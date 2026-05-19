<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { useAuthStore } from '@/stores/auth'
import { useDealsStore } from '@/stores/deals'
import StatusBadge from '@/components/StatusBadge.vue'
import MonoAmount from '@/components/MonoAmount.vue'
import { formatDateShort, formatDateLong } from '@/utils/money'
import type { Deal } from '@/types'

const auth = useAuthStore()
const deals = useDealsStore()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const firstName = computed(() => auth.client?.fullName.split(' ')[0] ?? '')

const activeDeals = computed(() => deals.activeDeals)
const closedDeals = computed(() => deals.closedDeals)
const overdueDeals = computed(() => deals.overdueDeals)

const nextDate = computed(() => {
  const d = deals.nextPaymentDate
  return d ? formatDateShort(d) : '—'
})

const bannerDismissed = ref(false)
const showClosed = ref(false)

function openDeal(id: string) {
  router.push({ name: 'deal-detail', params: { id } })
}

function pay(deal: Deal) {
  toast.add({
    severity: 'success',
    summary: t('home.payStarted'),
    detail: t('home.payDetail', { merchant: deal.merchant }),
    life: 3000,
  })
}
</script>

<template>
  <div class="home">
    <!-- greeting -->
    <header class="greeting">
      <h1>{{ $t('home.greeting', { name: firstName }) }} <span class="wave">👋</span></h1>
      <p class="greet-sub">{{ $t('home.greetSub') }}</p>
    </header>

    <!-- overdue alert banner -->
    <transition name="slide">
      <div
        v-if="overdueDeals.length && !bannerDismissed"
        class="overdue-banner"
      >
        <i class="pi pi-exclamation-triangle" />
        <div class="ob-text">
          <strong>{{ $t('home.overdueTitle') }}</strong>
          <span>{{ $t('home.overdueBody', { count: overdueDeals.length }) }}</span>
        </div>
        <button class="ob-close" @click="bannerDismissed = true">
          <i class="pi pi-times" />
        </button>
      </div>
    </transition>

    <!-- summary bar -->
    <section class="summary">
      <div class="stat-card">
        <span class="stat-label">{{ $t('home.activeDeals') }}</span>
        <span class="stat-value">{{ activeDeals.length }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">{{ $t('home.totalPaid') }}</span>
        <MonoAmount :value="deals.totalPaid" size="md" :gradient="true" />
      </div>
      <div class="stat-card">
        <span class="stat-label">{{ $t('home.nextPayment') }}</span>
        <span class="stat-value font-mono accent">{{ nextDate }}</span>
      </div>
    </section>

    <!-- active deals -->
    <section class="deals-section">
      <h2 class="section-title">{{ $t('home.activeSection') }}</h2>

      <div v-if="!activeDeals.length" class="empty">
        {{ $t('home.noActive') }}
      </div>

      <div
        v-for="deal in activeDeals"
        :key="deal.id"
        class="deal-card surface-card"
      >
        <div class="dc-top">
          <div>
            <div class="dc-merchant">{{ deal.merchant }}</div>
            <div class="dc-id font-mono">{{ deal.id }}</div>
          </div>
          <StatusBadge :status="deal.status" />
        </div>

        <div class="dc-amount">
          <MonoAmount :value="deal.amount" size="lg" :gradient="true" />
          <span class="dc-tariff">
            {{ deal.tariffLabel }} · {{ deal.termMonths }} {{ $t('common.mo') }} · {{ deal.markupPercent }}%
          </span>
        </div>

        <div class="dc-progress">
          <div class="dc-progress-head">
            <span class="dc-progress-label">
              {{ $t('home.paymentsMade', { made: deal.paymentsMade, total: deal.paymentsTotal }) }}
            </span>
            <span class="dc-progress-pct font-mono">
              {{ Math.round((deal.paymentsMade / deal.paymentsTotal) * 100) }}%
            </span>
          </div>
          <div class="dc-track">
            <div
              class="dc-fill"
              :style="{ width: `${(deal.paymentsMade / deal.paymentsTotal) * 100}%` }"
            />
          </div>
        </div>

        <div class="dc-next" :class="{ overdue: deal.status === 'overdue' }">
          <i :class="deal.status === 'overdue' ? 'pi pi-exclamation-circle' : 'pi pi-calendar'" />
          <span class="dc-next-label">
            {{ deal.status === 'overdue' ? $t('home.overdueSince') : $t('home.nextPaymentLabel') }}
          </span>
          <span class="dc-next-date font-mono">
            {{ deal.nextPaymentDate ? formatDateLong(deal.nextPaymentDate) : '—' }}
          </span>
          <span class="dc-next-amt font-mono">
            {{ (deal.nextPaymentAmount / 100).toLocaleString('en-US') }} {{ $t('common.som') }}
          </span>
        </div>

        <div class="dc-actions">
          <button class="btn-ghost dc-btn" @click="openDeal(deal.id)">
            {{ $t('home.details') }}
          </button>
          <button class="btn-gradient dc-btn" @click="pay(deal)">{{ $t('home.pay') }}</button>
        </div>
      </div>
    </section>

    <!-- closed deals -->
    <section v-if="closedDeals.length" class="deals-section">
      <button class="toggle-closed" @click="showClosed = !showClosed">
        <i class="pi" :class="showClosed ? 'pi-chevron-down' : 'pi-chevron-right'" />
        {{ $t(showClosed ? 'home.hideClosed' : 'home.showClosed', { count: closedDeals.length }) }}
      </button>

      <transition name="slide">
        <div v-if="showClosed" class="closed-list">
          <div
            v-for="deal in closedDeals"
            :key="deal.id"
            class="closed-card surface-card"
            @click="openDeal(deal.id)"
          >
            <div>
              <div class="dc-merchant">{{ deal.merchant }}</div>
              <div class="dc-id font-mono">{{ deal.id }}</div>
            </div>
            <div class="closed-right">
              <MonoAmount :value="deal.amount" size="sm" :gradient="false" />
              <StatusBadge :status="deal.status" />
            </div>
          </div>
        </div>
      </transition>
    </section>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.greeting h1 {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.wave {
  display: inline-block;
}
.greet-sub {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.overdue-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  background: var(--danger-bg);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
  border-radius: 16px;
  padding: 1rem 1.1rem;
}
.overdue-banner > i {
  color: var(--danger);
  font-size: 1.1rem;
  margin-top: 0.1rem;
}
.ob-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.ob-text strong {
  color: var(--danger);
  font-size: 0.92rem;
}
.ob-text span {
  font-size: 0.82rem;
  color: var(--text-secondary);
}
.ob-close {
  background: transparent;
  border: none;
  color: var(--danger);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.1rem;
}

.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
.stat-card {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  box-shadow: var(--shadow-card);
  padding: 1rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}
.stat-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}
.stat-value {
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1;
}
.stat-value.accent {
  color: var(--accent-2);
  font-size: 1.15rem;
}

.section-title {
  margin: 0 0 0.9rem;
  font-size: 1.05rem;
  font-weight: 800;
}
.deals-section {
  display: flex;
  flex-direction: column;
}
.empty {
  color: var(--text-secondary);
  font-size: 0.9rem;
  padding: 1.5rem 0;
  text-align: center;
}

.deal-card {
  padding: 1.3rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.deal-card:last-child {
  margin-bottom: 0;
}
.dc-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}
.dc-merchant {
  font-size: 1.05rem;
  font-weight: 800;
}
.dc-id {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
}
.dc-amount {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.dc-tariff {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.dc-progress {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.dc-progress-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.dc-progress-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.dc-progress-pct {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent-2);
}
.dc-track {
  height: 8px;
  background: var(--bg-surface);
  border-radius: 999px;
  overflow: hidden;
}
.dc-fill {
  height: 100%;
  background: var(--gradient-hero);
  border-radius: 999px;
  transition: width 0.3s ease;
}
.dc-next {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  background: var(--bg-surface);
  border-radius: 12px;
  padding: 0.85rem 1rem;
  font-size: 0.85rem;
}
.dc-next > i {
  color: var(--accent-2);
}
.dc-next-label {
  color: var(--text-secondary);
  font-weight: 600;
}
.dc-next-date {
  font-weight: 700;
}
.dc-next-amt {
  margin-left: auto;
  font-weight: 800;
  color: var(--accent-2);
}
.dc-next.overdue {
  background: var(--danger-bg);
}
.dc-next.overdue > i,
.dc-next.overdue .dc-next-date,
.dc-next.overdue .dc-next-amt {
  color: var(--danger);
}
.dc-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.7rem;
}
.dc-btn {
  width: 100%;
  padding: 0.8rem 1rem;
}

.toggle-closed {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0.5rem 0;
}
.toggle-closed:hover {
  color: var(--accent-2);
}
.toggle-closed i {
  font-size: 0.75rem;
}
.closed-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin-top: 0.6rem;
}
.closed-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.15rem;
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.closed-card:hover {
  border-color: var(--accent-2);
}
.closed-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
