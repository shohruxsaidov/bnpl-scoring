<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWizardStore } from '@/stores/wizard'
import MonoAmount from '@/components/MonoAmount.vue'
import type { ScheduleRow } from '@/types'

const wizard = useWizardStore()

const day = ref(wizard.sessionData.paymentDay)
const days = Array.from({ length: 28 }, (_, i) => i + 1)

const tariff = computed(() => wizard.sessionData.tariff)
const principal = computed(() => wizard.basketTotal)

const totalPayable = computed(() => {
  const t = tariff.value
  if (!t) return principal.value
  return Math.round(principal.value * (1 + t.markupPercent / 100))
})

const schedule = computed<ScheduleRow[]>(() => {
  const t = tariff.value
  if (!t) return []
  const months = t.termMonths
  const perMonth = Math.round(totalPayable.value / months)
  const rows: ScheduleRow[] = []
  const start = new Date()
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i + 1, day.value)
    const amount =
      i === months - 1
        ? totalPayable.value - perMonth * (months - 1)
        : perMonth
    rows.push({ index: i + 1, date: d.toISOString(), amount })
  }
  return rows
})

function next() {
  wizard.setPaymentDay(day.value)
  wizard.setSchedule(schedule.value)
  wizard.complete('payment')
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="step-card surface-card">
    <header class="sc-head">
      <div>
        <h2>To'lov kuni</h2>
        <p>Choose the monthly payment day and preview the schedule.</p>
      </div>
    </header>

    <div class="day-section">
      <label class="field-label">Payment day of month</label>
      <div class="day-grid">
        <button
          v-for="d in days"
          :key="d"
          class="day-btn font-mono"
          :class="{ active: day === d }"
          @click="day = d"
        >
          {{ d }}
        </button>
      </div>
    </div>

    <div class="schedule">
      <div class="sch-head">
        <h3>Installment schedule</h3>
        <div class="sch-total">
          <span>Total payable</span>
          <MonoAmount :value="totalPayable" size="md" />
        </div>
      </div>

      <div class="sch-table">
        <div class="sch-row sch-head-row">
          <span>#</span>
          <span>Month</span>
          <span>Due date</span>
          <span class="ta-right">Amount</span>
        </div>
        <div v-for="row in schedule" :key="row.index" class="sch-row">
          <span class="font-mono">{{ row.index }}</span>
          <span>Month {{ row.index }}</span>
          <span class="font-mono">{{ fmtDate(row.date) }}</span>
          <span class="ta-right">
            <MonoAmount :value="row.amount" size="sm" :gradient="false" />
          </span>
        </div>
      </div>
    </div>

    <footer class="sc-foot">
      <button class="btn-ghost" @click="wizard.back()">
        <i class="pi pi-arrow-left" /> Back
      </button>
      <button class="btn-gradient" @click="next">
        Continue <i class="pi pi-arrow-right" />
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
.day-section {
  margin: 1.8rem 0;
}
.day-grid {
  display: grid;
  grid-template-columns: repeat(14, 1fr);
  gap: 0.5rem;
  margin-top: 0.6rem;
}
.day-btn {
  aspect-ratio: 1;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
.day-btn:hover {
  border-color: var(--accent-2);
  color: var(--accent-2);
}
.day-btn.active {
  background: var(--gradient-hero);
  color: #fff;
  border-color: transparent;
  box-shadow: var(--accent-glow);
}
.schedule {
  background: var(--bg-surface);
  border-radius: 16px;
  padding: 1.4rem;
}
.sch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.sch-head h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}
.sch-total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.sch-total span {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
}
.sch-table {
  display: flex;
  flex-direction: column;
}
.sch-row {
  display: grid;
  grid-template-columns: 50px 1fr 1.4fr 1fr;
  padding: 0.7rem 0.6rem;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.84rem;
  align-items: center;
}
.sch-row:last-child {
  border-bottom: none;
}
.sch-head-row {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--text-secondary);
  text-transform: uppercase;
}
.ta-right {
  text-align: right;
}
.sc-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2rem;
  padding-top: 1.4rem;
  border-top: 1px solid var(--border-subtle);
}
.btn-gradient,
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
