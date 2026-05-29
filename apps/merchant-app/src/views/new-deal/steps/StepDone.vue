<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDealStore } from '@/stores/deal'
import { useClientScoringStore } from '@/stores/clientScoring'
import { fetchContractPdfUrl } from '@/composables/useDealsApi'

const deal = useDealStore()
const scoring = useClientScoringStore()
const router = useRouter()

const dealId = computed(() => deal.sessionData.createdDealId ?? '—')
const downloading = ref(false)
const downloadError = ref<string | null>(null)

function newDeal() {
  deal.reset()
  scoring.reset()
}

function backToDashboard() {
  const id = deal.sessionData.createdDealId
  deal.reset()
  scoring.reset()
  if (id) router.push(`/deals/${id}`)
  else router.push('/')
}

async function downloadContract() {
  const id = deal.sessionData.createdDealId
  if (!id) return

  downloading.value = true
  downloadError.value = null

  try {
    const url = await fetchContractPdfUrl(id)
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.download = `${id}-kontrakt.pdf`
    a.click()
  } catch {
    downloadError.value = 'Не удалось загрузить документ. Попробуйте ещё раз.'
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div class="step-card surface-card done">
    <div class="check-burst">
      <i class="pi pi-check" />
    </div>
    <h2>{{ $t('stepDone.title') }}</h2>
    <p>{{ $t('stepDone.subtitle') }}</p>

    <div class="deal-id-box">
      <span class="dib-label">{{ $t('stepDone.dealId') }}</span>
      <span class="dib-id font-mono text-gradient">{{ dealId }}</span>
    </div>

    <div class="actions">
      <button class="btn-ghost" :disabled="downloading" @click="downloadContract">
        <i :class="downloading ? 'pi pi-spin pi-spinner' : 'pi pi-download'" />
        {{ downloading ? $t('stepDone.downloading') : $t('stepDone.downloadContract') }}
      </button>
      <button class="btn-ghost" @click="newDeal">
        <i class="pi pi-plus" /> {{ $t('stepDone.newDeal') }}
      </button>
      <button class="btn-gradient" @click="backToDashboard">
        <i class="pi pi-home" /> {{ $t('stepDone.backToDashboard') }}
      </button>
    </div>
    <p v-if="downloadError" class="download-error">{{ downloadError }}</p>
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
.btn-ghost:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.download-error {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: var(--danger);
}
</style>
