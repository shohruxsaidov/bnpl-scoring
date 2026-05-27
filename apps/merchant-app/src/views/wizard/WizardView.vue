<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWizardStore } from '@/stores/wizard'
import { useCatalogStore } from '@/stores/catalog'
import StepClient from './steps/StepClient.vue'
import StepKarta from './steps/StepKarta.vue'
import StepTarif from './steps/StepTarif.vue'
import StepMahsulot from './steps/StepMahsulot.vue'
import StepPaymentDay from './steps/StepPaymentDay.vue'
import StepVerification from './steps/StepVerification.vue'
import StepDone from './steps/StepDone.vue'

const wizard = useWizardStore()
const catalog = useCatalogStore()
const { t } = useI18n()

const STEP_LABEL_KEYS: Record<string, string> = {
  client: 'wizard.stepClient',
  karta: 'wizard.stepKarta',
  tarif: 'wizard.stepTarif',
  mahsulot: 'wizard.stepMahsulot',
  payment: 'wizard.stepPayment',
  verification: 'wizard.stepVerification',
  done: 'wizard.stepDone',
}

function stepLabel(key: string): string {
  return STEP_LABEL_KEYS[key] ? t(STEP_LABEL_KEYS[key]) : key
}

onMounted(() => {
  // Skip reset when returning from MyID callback (client already set in store).
  const resuming = sessionStorage.getItem('myid_callback_complete')
  if (resuming) {
    sessionStorage.removeItem('myid_callback_complete')
  } else {
    wizard.reset()
  }
  catalog.fetchAll()
})

function stepState(idx: number, key: string): 'done' | 'current' | 'todo' {
  if (wizard.completed[key as keyof typeof wizard.completed]) return 'done'
  if (idx === wizard.currentIndex) return 'current'
  return 'todo'
}
</script>

<template>
  <div class="wizard">
    <div class="stepper surface-card">
      <div
        v-for="(step, idx) in wizard.steps"
        :key="step.key"
        class="step"
        :class="stepState(idx, step.key)"
      >
        <div class="step-icon">
          <i
            v-if="stepState(idx, step.key) === 'done'"
            class="pi pi-check"
          />
          <i v-else :class="step.icon" />
        </div>
        <span class="step-label">{{ stepLabel(step.key) }}</span>
        <div v-if="idx < wizard.steps.length - 1" class="connector" />
      </div>
    </div>

    <div class="step-body">
      <StepClient v-if="wizard.currentStep === 'client'" />
      <StepKarta v-else-if="wizard.currentStep === 'karta'" />
      <StepTarif v-else-if="wizard.currentStep === 'tarif'" />
      <StepMahsulot v-else-if="wizard.currentStep === 'mahsulot'" />
      <StepPaymentDay v-else-if="wizard.currentStep === 'payment'" />
      <StepVerification v-else-if="wizard.currentStep === 'verification'" />
      <StepDone v-else-if="wizard.currentStep === 'done'" />
    </div>
  </div>
</template>

<style scoped>
.wizard {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
}
.stepper {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.5rem 1.8rem;
}
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  flex: 1;
}
.step-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--bg-surface);
  border: 2px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 1.05rem;
  z-index: 2;
  transition: all 0.2s ease;
}
.step.current .step-icon {
  background: var(--gradient-hero);
  border-color: transparent;
  color: #fff;
  box-shadow: var(--accent-glow);
}
.step.done .step-icon {
  background: var(--success);
  border-color: transparent;
  color: #fff;
}
.step-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
}
.step.current .step-label {
  color: var(--accent-2);
}
.step.done .step-label {
  color: var(--success);
}
.connector {
  position: absolute;
  top: 22px;
  left: calc(50% + 28px);
  right: calc(-50% + 28px);
  height: 2px;
  background: var(--border-subtle);
  z-index: 1;
}
.step.done .connector {
  background: var(--success);
}
.step-body {
  min-height: 400px;
}
</style>
