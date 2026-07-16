<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import InputNumber from 'primevue/inputnumber'
import MonoAmount from '@/components/mono-amount.vue'
import { apiFetch as api } from '@/utils/apiFetch'
import { formatSomShort } from '@/utils/money'
import type { TariffQuote } from '@/types'

const amountSom = ref<number | null>(null)
const quotes = ref<TariffQuote[]>([])
const loading = ref(false)
const error = ref(false)
const expandedId = ref<string | null>(null)

/** The amount (som) the current quotes were computed for. */
const quotedAmount = ref<number | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let requestSeq = 0

watch(amountSom, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (value == null || value <= 0) {
    quotes.value = []
    quotedAmount.value = null
    return
  }
  debounceTimer = setTimeout(() => fetchQuotes(Math.round(value)), 350)
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

async function fetchQuotes(amountSom: number) {
  const seq = ++requestSeq
  loading.value = true
  error.value = false
  try {
    const body = await api<{ amount: number; quotes: TariffQuote[] }>(
      `/merchant/tariffs/quote?amount=${amountSom}`,
    )
    if (seq !== requestSeq) return
    quotes.value = body.quotes
    quotedAmount.value = body.amount
    if (expandedId.value && !body.quotes.some((q) => q.tariffId === expandedId.value && q.inRange)) {
      expandedId.value = null
    }
  } catch {
    if (seq !== requestSeq) return
    error.value = true
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function toggle(q: TariffQuote) {
  if (!q.inRange) return
  expandedId.value = expandedId.value === q.tariffId ? null : q.tariffId
}

const expanded = computed(() => quotes.value.find((q) => q.tariffId === expandedId.value) ?? null)

function rangeHint(q: TariffQuote): string {
  const min = q.minAmount != null ? formatSomShort(q.minAmount) : null
  const max = q.maxAmount != null ? formatSomShort(q.maxAmount) : null
  if (min && max) return `${min} – ${max}`
  if (min) return `≥ ${min}`
  if (max) return `≤ ${max}`
  return ''
}
</script>

<template>
  <div class="calc-page">
    <div class="surface-card head-card">
      <div class="head-text">
        <h2>{{ $t('calculator.title') }}</h2>
        <p>{{ $t('calculator.subtitle') }}</p>
      </div>
      <div class="amount-field">
        <label class="amount-label" for="calc-amount">{{ $t('calculator.amountLabel') }}</label>
        <InputNumber
          v-model="amountSom"
          input-id="calc-amount"
          :min="0"
          :max-fraction-digits="0"
          :placeholder="$t('calculator.amountPlaceholder')"
          suffix=" so'm"
          fluid
        />
      </div>
    </div>

    <div v-if="error" class="surface-card state-card">
      <i class="pi pi-exclamation-triangle" />
      {{ $t('calculator.loadFailed') }}
    </div>

    <div v-else-if="quotedAmount == null && !loading" class="surface-card state-card">
      <i class="pi pi-calculator" />
      {{ $t('calculator.empty') }}
    </div>

    <template v-else>
      <div class="tariffs" :class="{ dimmed: loading }">
        <button
          v-for="q in quotes"
          :key="q.tariffId"
          class="tariff-card"
          :class="{ selected: expandedId === q.tariffId, disabled: !q.inRange }"
          @click="toggle(q)"
        >
          <div class="tc-head">
            <span class="tc-name">{{ q.name }}</span>
            <i v-if="expandedId === q.tariffId" class="pi pi-check-circle" />
          </div>
          <div class="tc-term">
            <i class="pi pi-calendar" /> {{ q.termMonths }} {{ $t('calculator.months') }}
            <span class="tc-sep">·</span>
            {{ $t('calculator.ustama') }} <strong>{{ q.markupPercent }}%</strong>
          </div>

          <template v-if="q.inRange">
            <div class="tc-monthly">
              <span class="tcl-label">{{ $t('calculator.monthly') }}</span>
              <MonoAmount :value="q.monthlyAmount" size="lg" />
            </div>
            <div class="tc-rows">
              <div class="tc-row">
                <span>{{ $t('calculator.total') }}</span>
                <MonoAmount :value="q.totalPayable" size="sm" :gradient="false" />
              </div>
              <div class="tc-row">
                <span>{{ $t('calculator.ustamaAmount') }}</span>
                <MonoAmount :value="q.ustamaAmount" size="sm" :gradient="false" />
              </div>
            </div>
          </template>
          <div v-else class="tc-out">
            <i class="pi pi-ban" />
            <span>{{ $t('calculator.outOfRange') }}</span>
            <span class="tc-range font-mono">{{ rangeHint(q) }}</span>
          </div>
        </button>
      </div>

      <div v-if="expanded" class="surface-card breakdown">
        <h3>{{ $t('calculator.breakdownTitle', { name: expanded.name }) }}</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ $t('calculator.thNum') }}</th>
              <th>{{ $t('calculator.thMonth') }}</th>
              <th class="amount-col">{{ $t('calculator.thAmount') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(amt, i) in expanded.installments" :key="i">
              <td class="font-mono muted">{{ i + 1 }}</td>
              <td>{{ $t('calculator.monthN', { n: i + 1 }) }}</td>
              <td class="amount-col">
                <MonoAmount :value="amt" size="sm" :gradient="false" />
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" class="total-label">{{ $t('calculator.total') }}</td>
              <td class="amount-col">
                <MonoAmount :value="expanded.totalPayable" size="md" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p class="disclaimer">
        <i class="pi pi-info-circle" /> {{ $t('calculator.disclaimer') }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.calc-page {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  max-width: 1100px;
}

.head-card {
  padding: 1.8rem 2rem;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
}

.head-text h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
}

.head-text p {
  margin: 0.3rem 0 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.amount-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 280px;
}

.amount-label {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--accent-2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.amount-field :deep(.p-inputnumber-input) {
  font-weight: 700;
  font-size: 1.05rem;
}

.state-card {
  padding: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.state-card i {
  font-size: 1.2rem;
}

.tariffs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.2rem;
  transition: opacity 0.15s ease;
}

.tariffs.dimmed {
  opacity: 0.55;
  pointer-events: none;
}

.tariff-card {
  text-align: left;
  border: 2px solid var(--border-subtle);
  background: var(--bg-surface);
  border-radius: 16px;
  padding: 1.4rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  transition: all 0.15s ease;
}

.tariff-card.selected {
  border-color: var(--accent-2);
  box-shadow: var(--accent-glow);
}

.tariff-card.disabled {
  cursor: default;
  opacity: 0.6;
}

.tc-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tc-name {
  font-size: 1.1rem;
  font-weight: 800;
}

.tc-head i {
  color: var(--accent-2);
}

.tc-term {
  font-size: 0.84rem;
  color: var(--text-secondary);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.tc-term strong {
  color: var(--accent-2);
}

.tc-sep {
  opacity: 0.5;
}

.tc-monthly {
  margin-top: 0.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.tcl-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.tc-rows {
  padding-top: 0.7rem;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.tc-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.tc-out {
  margin-top: 0.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.tc-out i {
  color: var(--danger);
}

.tc-range {
  font-size: 0.78rem;
}

.breakdown {
  padding: 1.6rem 2rem;
}

.breakdown h3 {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  font-weight: 800;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.data-table th {
  text-align: left;
  padding: 0.55rem 0.9rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
}

.data-table td {
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table .muted {
  color: var(--text-secondary);
}

.amount-col {
  text-align: right;
}

.data-table tfoot td {
  border-bottom: none;
  border-top: 1px solid var(--border-subtle);
  padding: 0.85rem 0.9rem;
}

.total-label {
  font-weight: 700;
  color: var(--text-secondary);
}

.disclaimer {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

@media (max-width: 700px) {
  .head-card {
    flex-direction: column;
    align-items: stretch;
  }

  .amount-field {
    min-width: 0;
  }
}
</style>
