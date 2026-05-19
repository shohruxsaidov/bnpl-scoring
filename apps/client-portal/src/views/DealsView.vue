<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDealsStore } from '@/stores/deals'
import StatusBadge from '@/components/StatusBadge.vue'
import MonoAmount from '@/components/MonoAmount.vue'
import { formatDateLong } from '@/utils/money'

const deals = useDealsStore()
const router = useRouter()

type Filter = 'all' | 'active' | 'closed'
const filter = ref<Filter>('all')

const list = computed(() => {
  if (filter.value === 'active') return deals.activeDeals
  if (filter.value === 'closed') return deals.closedDeals
  return deals.deals
})

function openDeal(id: string) {
  router.push({ name: 'deal-detail', params: { id } })
}
</script>

<template>
  <div class="deals">
    <header class="head">
      <h1>{{ $t('deals.title') }}</h1>
      <p class="sub">{{ $t('deals.subtitle') }}</p>
    </header>

    <div class="filters">
      <button
        v-for="f in (['all', 'active', 'closed'] as Filter[])"
        :key="f"
        class="filter-pill"
        :class="{ active: filter === f }"
        @click="filter = f"
      >
        {{ f === 'all' ? $t('deals.filterAll') : f === 'active' ? $t('deals.filterActive') : $t('deals.filterClosed') }}
      </button>
    </div>

    <div v-if="!list.length" class="empty">{{ $t('deals.empty') }}</div>

    <div
      v-for="deal in list"
      :key="deal.id"
      class="deal-card surface-card"
      @click="openDeal(deal.id)"
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
        <span class="dc-tariff">{{ deal.termMonths }} {{ $t('common.mo') }} · {{ deal.markupPercent }}%</span>
      </div>

      <div class="dc-foot">
        <div class="dc-track">
          <div
            class="dc-fill"
            :style="{ width: `${(deal.paymentsMade / deal.paymentsTotal) * 100}%` }"
          />
        </div>
        <span class="dc-foot-label">
          {{ $t('deals.paidOf', { paid: deal.paymentsMade, total: deal.paymentsTotal }) }}
        </span>
      </div>

      <div
        v-if="deal.nextPaymentDate"
        class="dc-next"
        :class="{ overdue: deal.status === 'overdue' }"
      >
        <i class="pi pi-calendar" />
        {{ $t('deals.next') }}
        <span class="font-mono">{{ formatDateLong(deal.nextPaymentDate) }}</span>
      </div>
      <div v-else class="dc-next done">
        <i class="pi pi-check-circle" /> {{ $t('deals.fullyPaid') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.deals {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.head h1 {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
}
.sub {
  margin: 0.3rem 0 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
.filters {
  display: flex;
  gap: 0.6rem;
}
.filter-pill {
  flex: 1;
  padding: 0.7rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.filter-pill.active {
  background: var(--gradient-hero);
  color: #fff;
  border-color: transparent;
}
.empty {
  color: var(--text-secondary);
  font-size: 0.9rem;
  padding: 2rem 0;
  text-align: center;
}
.deal-card {
  padding: 1.3rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.deal-card:hover {
  border-color: var(--accent-2);
  transform: translateY(-1px);
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
  gap: 0.3rem;
}
.dc-tariff {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.dc-foot {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.dc-track {
  flex: 1;
  height: 7px;
  background: var(--bg-surface);
  border-radius: 999px;
  overflow: hidden;
}
.dc-fill {
  height: 100%;
  background: var(--gradient-hero);
  border-radius: 999px;
}
.dc-foot-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  white-space: nowrap;
}
.dc-next {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.83rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.dc-next i {
  color: var(--accent-2);
}
.dc-next.overdue {
  color: var(--danger);
}
.dc-next.overdue i {
  color: var(--danger);
}
.dc-next.done i {
  color: var(--success);
}
</style>
