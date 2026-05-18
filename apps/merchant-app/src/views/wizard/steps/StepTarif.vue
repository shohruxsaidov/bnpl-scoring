<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWizardStore } from '@/stores/wizard'
import { useCatalogStore } from '@/stores/catalog'
import MonoAmount from '@/components/MonoAmount.vue'
import type { Tariff } from '@/types'

const wizard = useWizardStore()
const catalog = useCatalogStore()

const score = computed(() => wizard.sessionData.cardScore?.score ?? 0)
const limit = computed(() => wizard.sessionData.cardScore?.limit ?? 0)

const selectedId = ref<string | null>(wizard.sessionData.tariff?.id ?? null)

function isAffordable(t: Tariff): boolean {
  // The approved limit must fall within the tariff's credit range.
  return limit.value >= t.creditMin && limit.value <= t.creditMax
}

function select(t: Tariff) {
  if (!isAffordable(t)) return
  selectedId.value = t.id
}

function next() {
  const t = catalog.activeTariffs.find((x) => x.id === selectedId.value)
  if (t) {
    wizard.setTariff(t)
    wizard.complete('tarif')
  }
}
</script>

<template>
  <div class="step-card surface-card">
    <header class="sc-head">
      <div>
        <h2>Tarif</h2>
        <p>Pick a credit plan. Plans outside the approved limit are disabled.</p>
      </div>
      <div class="score-pill">
        <div>
          <span class="sp-label">Score</span>
          <span class="sp-value font-mono text-gradient">{{ score }}</span>
        </div>
        <div class="sp-sep" />
        <div>
          <span class="sp-label">Approved limit</span>
          <MonoAmount :value="limit" size="md" />
        </div>
      </div>
    </header>

    <div class="tariffs">
      <button
        v-for="t in catalog.activeTariffs"
        :key="t.id"
        class="tariff-card"
        :class="{
          selected: selectedId === t.id,
          disabled: !isAffordable(t),
        }"
        :disabled="!isAffordable(t)"
        @click="select(t)"
      >
        <div class="tc-head">
          <span class="tc-name">{{ t.name }}</span>
          <i
            v-if="selectedId === t.id"
            class="pi pi-check-circle"
          />
        </div>
        <div class="tc-term">
          <i class="pi pi-calendar" /> {{ t.termMonths }} months
        </div>
        <div class="tc-markup">
          Ustama: <strong>{{ t.markupPercent }}%</strong>
        </div>
        <div class="tc-range">
          <span class="tcr-label">Credit range</span>
          <span class="font-mono tcr-val">
            {{ (t.creditMin / 100).toLocaleString('uz-UZ') }} –
            {{ (t.creditMax / 100).toLocaleString('uz-UZ') }}
          </span>
        </div>
        <span v-if="!isAffordable(t)" class="locked">
          <i class="pi pi-lock" /> Out of limit range
        </span>
      </button>
    </div>

    <footer class="sc-foot">
      <button class="btn-ghost" @click="wizard.back()">
        <i class="pi pi-arrow-left" /> Back
      </button>
      <button class="btn-gradient" :disabled="!selectedId" @click="next">
        Continue <i class="pi pi-arrow-right" />
      </button>
    </footer>
  </div>
</template>

<style scoped>
.step-card {
  padding: 2rem;
}
.sc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
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
.score-pill {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  background: var(--bg-surface);
  padding: 0.9rem 1.4rem;
  border-radius: 14px;
}
.sp-label {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
}
.sp-value {
  font-size: 1.4rem;
  font-weight: 800;
}
.sp-sep {
  width: 1px;
  height: 34px;
  background: var(--border-subtle);
}
.tariffs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.2rem;
  margin: 1.8rem 0;
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
  position: relative;
}
.tariff-card.selected {
  border-color: var(--accent-2);
  box-shadow: var(--accent-glow);
}
.tariff-card.disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
}
.tc-markup {
  font-size: 0.88rem;
}
.tc-markup strong {
  color: var(--accent-2);
}
.tc-range {
  margin-top: 0.4rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.tcr-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
}
.tcr-val {
  font-size: 0.8rem;
  font-weight: 700;
}
.locked {
  margin-top: 0.4rem;
  font-size: 0.74rem;
  color: var(--danger);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.4rem;
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
</style>
