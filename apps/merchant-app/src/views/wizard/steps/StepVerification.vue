<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWizardStore } from '@/stores/wizard'
import { useDealsStore } from '@/stores/deals'
import { useAuthStore } from '@/stores/auth'
import MonoAmount from '@/components/MonoAmount.vue'
import type { Deal } from '@/types'

const wizard = useWizardStore()
const deals = useDealsStore()
const auth = useAuthStore()

const sd = computed(() => wizard.sessionData)
const principal = computed(() => wizard.basketTotal)
const totalPayable = computed(() => {
  const t = sd.value.tariff
  if (!t) return principal.value
  return Math.round(principal.value * (1 + t.markupPercent / 100))
})

const submitting = ref(false)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: 'short',
  })
}

async function signSubmit() {
  submitting.value = true
  const id = deals.nextDealId()
  const deal: Deal = {
    id,
    clientName: sd.value.client?.fullName ?? 'Unknown',
    clientPinfl: sd.value.client?.pinfl ?? '',
    clientPhone: sd.value.client?.phone ?? '',
    status: 'approved',
    tariffId: sd.value.tariff?.id ?? '',
    tariffName: sd.value.tariff?.name ?? '',
    termMonths: sd.value.tariff?.termMonths ?? 0,
    amount: principal.value,
    totalPayable: totalPayable.value,
    score: sd.value.cardScore?.score ?? 0,
    decision: sd.value.cardScore?.decision ?? 'approved',
    agentId: auth.employee?.id ?? '',
    createdAt: new Date().toISOString(),
    paymentDay: sd.value.paymentDay,
    basket: sd.value.basket ?? [],
  }
  await new Promise((r) => setTimeout(r, 1000))
  deals.addDeal(deal)
  wizard.setCreatedDealId(id)
  submitting.value = false
  wizard.complete('verification')
}
</script>

<template>
  <div class="step-card surface-card">
    <header class="sc-head">
      <div>
        <h2>Верификация</h2>
        <p>Review every detail before signing the contract.</p>
      </div>
    </header>

    <div class="summary-grid">
      <section class="sum-block">
        <h4><i class="pi pi-user" /> Client</h4>
        <dl>
          <div><dt>Name</dt><dd>{{ sd.client?.fullName }}</dd></div>
          <div><dt>PINFL</dt><dd class="font-mono">{{ sd.client?.pinfl }}</dd></div>
          <div><dt>Phone</dt><dd>{{ sd.client?.phone }}</dd></div>
          <div><dt>Passport</dt><dd class="font-mono">{{ sd.client?.passportSerial }}</dd></div>
        </dl>
      </section>

      <section class="sum-block">
        <h4><i class="pi pi-credit-card" /> Card &amp; Score</h4>
        <dl>
          <div><dt>Card</dt><dd class="font-mono">{{ sd.selectedCard?.maskedPan }}</dd></div>
          <div><dt>Bank</dt><dd>{{ sd.selectedCard?.bank }}</dd></div>
          <div><dt>Score</dt><dd class="font-mono">{{ sd.cardScore?.score }}</dd></div>
          <div><dt>Decision</dt><dd>{{ sd.cardScore?.decision }}</dd></div>
        </dl>
      </section>

      <section class="sum-block">
        <h4><i class="pi pi-percentage" /> Tariff</h4>
        <dl>
          <div><dt>Plan</dt><dd>{{ sd.tariff?.name }}</dd></div>
          <div><dt>Term</dt><dd>{{ sd.tariff?.termMonths }} months</dd></div>
          <div><dt>Ustama</dt><dd>{{ sd.tariff?.markupPercent }}%</dd></div>
          <div><dt>Payment day</dt><dd class="font-mono">{{ sd.paymentDay }}</dd></div>
        </dl>
      </section>

      <section class="sum-block totals">
        <h4><i class="pi pi-wallet" /> Amounts</h4>
        <div class="amt-row">
          <span>Principal</span>
          <MonoAmount :value="principal" size="sm" :gradient="false" />
        </div>
        <div class="amt-row">
          <span>Total payable</span>
          <MonoAmount :value="totalPayable" size="md" />
        </div>
      </section>
    </div>

    <section class="basket-block">
      <h4><i class="pi pi-shopping-bag" /> Basket ({{ wizard.basketCount }} items)</h4>
      <div
        v-for="item in sd.basket"
        :key="item.product.id"
        class="basket-line"
      >
        <span>{{ item.product.name }}</span>
        <span class="font-mono qty">×{{ item.quantity }}</span>
        <MonoAmount
          :value="item.product.price * item.quantity"
          size="sm"
          :gradient="false"
        />
      </div>
    </section>

    <section class="sched-block">
      <h4><i class="pi pi-calendar" /> Schedule preview</h4>
      <div class="sched-strip">
        <div v-for="row in sd.schedule" :key="row.index" class="sched-chip">
          <span class="font-mono sc-date">{{ fmtDate(row.date) }}</span>
          <MonoAmount :value="row.amount" size="sm" :gradient="false" />
        </div>
      </div>
    </section>

    <footer class="sc-foot">
      <button class="btn-ghost" :disabled="submitting" @click="wizard.back()">
        <i class="pi pi-arrow-left" /> Back
      </button>
      <button class="btn-gradient sign" :disabled="submitting" @click="signSubmit">
        <i v-if="submitting" class="pi pi-spin pi-spinner" />
        <i v-else class="pi pi-verified" />
        {{ submitting ? 'Creating deal…' : 'Sign &amp; Submit' }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.step-card {
  padding: 2rem;
}
.sc-head h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
}
.sc-head p {
  margin: 0.3rem 0 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.1rem;
  margin: 1.8rem 0;
}
.sum-block {
  background: var(--bg-surface);
  border-radius: 14px;
  padding: 1.2rem;
}
.sum-block h4 {
  margin: 0 0 0.9rem;
  font-size: 0.82rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--accent-2);
}
.sum-block dl {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.sum-block dl div {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  gap: 0.5rem;
}
.sum-block dt {
  color: var(--text-secondary);
  font-weight: 600;
}
.sum-block dd {
  margin: 0;
  font-weight: 700;
  text-align: right;
}
.totals .amt-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 0.8rem;
}
.basket-block,
.sched-block {
  background: var(--bg-surface);
  border-radius: 14px;
  padding: 1.2rem;
  margin-bottom: 1.1rem;
}
.basket-block h4,
.sched-block h4 {
  margin: 0 0 0.9rem;
  font-size: 0.82rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--accent-2);
}
.basket-line {
  display: grid;
  grid-template-columns: 1fr 60px 1fr;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.84rem;
}
.basket-line:last-child {
  border-bottom: none;
}
.basket-line .qty {
  color: var(--text-secondary);
  text-align: center;
}
.basket-line :last-child {
  text-align: right;
}
.sched-strip {
  display: flex;
  gap: 0.7rem;
  overflow-x: auto;
  padding-bottom: 0.4rem;
}
.sched-chip {
  flex-shrink: 0;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 0.7rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  align-items: center;
}
.sc-date {
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-weight: 700;
}
.sc-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 1rem;
  padding-top: 1.4rem;
  border-top: 1px solid var(--border-subtle);
}
.btn-gradient,
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.sign {
  padding: 0.7rem 1.6rem;
}
</style>
