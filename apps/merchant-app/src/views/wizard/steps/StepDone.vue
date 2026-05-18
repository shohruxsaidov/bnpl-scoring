<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWizardStore } from '@/stores/wizard'

const wizard = useWizardStore()
const router = useRouter()

const dealId = computed(() => wizard.sessionData.createdDealId ?? '—')

function newDeal() {
  wizard.reset()
}

function backToDashboard() {
  const id = wizard.sessionData.createdDealId
  wizard.reset()
  if (id) router.push(`/deals/${id}`)
  else router.push('/')
}

function downloadContract() {
  const blob = new Blob(
    [
      `KONTRAKT\n=========\nDeal ID: ${dealId.value}\nClient: ${wizard.sessionData.client?.fullName}\nTariff: ${wizard.sessionData.tariff?.name}\nGenerated: ${new Date().toISOString()}\n\n(Mock contract document)`,
    ],
    { type: 'text/plain' },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${dealId.value}-kontrakt.txt`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="step-card surface-card done">
    <div class="check-burst">
      <i class="pi pi-check" />
    </div>
    <h2>Готово!</h2>
    <p>The deal has been created and the contract is ready to sign.</p>

    <div class="deal-id-box">
      <span class="dib-label">Deal ID</span>
      <span class="dib-id font-mono text-gradient">{{ dealId }}</span>
    </div>

    <div class="actions">
      <button class="btn-ghost" @click="downloadContract">
        <i class="pi pi-download" /> Download Kontrakt
      </button>
      <button class="btn-ghost" @click="newDeal">
        <i class="pi pi-plus" /> New Deal
      </button>
      <button class="btn-gradient" @click="backToDashboard">
        <i class="pi pi-home" /> Back to Dashboard
      </button>
    </div>
  </div>
</template>

<style scoped>
.done {
  padding: 3.5rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.check-burst {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: var(--gradient-hero);
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 2.4rem;
  box-shadow: var(--accent-glow);
  margin-bottom: 1.6rem;
}
.done h2 {
  margin: 0 0 0.4rem;
  font-size: 1.8rem;
  font-weight: 800;
}
.done p {
  margin: 0 0 2rem;
  color: var(--text-secondary);
}
.deal-id-box {
  background: var(--bg-surface);
  border-radius: 16px;
  padding: 1.3rem 2.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 2.4rem;
}
.dib-label {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.dib-id {
  font-size: 1.8rem;
  font-weight: 800;
}
.actions {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  justify-content: center;
}
.btn-gradient,
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
