<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Select from 'primevue/select'
import { useCollectionBoardStore } from '@/stores/collectionBoard'
import { useMerchantsStore } from '@/stores/merchants'
import { formatSom } from '@/utils/money'

const store = useCollectionBoardStore()
const merchantsStore = useMerchantsStore()
const { t } = useI18n()

const merchantFilter = ref<string | null>(null)

onMounted(() => {
  store.fetchBoard()
  if (merchantsStore.merchants.length === 0) merchantsStore.fetchAll().catch(() => {})
})

watch(merchantFilter, (id) => store.fetchBoard(id ?? undefined))

const merchantOptions = computed(() => [
  { label: t('collectionBoard.allMerchants'), value: null },
  ...merchantsStore.merchants.map((m) => ({ label: m.name, value: m.id })),
])

const BUCKET_META: Record<string, { color: string }> = {
  '1-30': { color: 'var(--warning)' },
  '31-60': { color: '#FF8C42' },
  '61-90': { color: 'var(--danger)' },
  '90+': { color: '#B91C1C' },
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ $t('routeTitle.collectionBoard') }}</h1>
        <p class="page-sub">{{ $t('collectionBoard.count', { count: store.totalCards }) }}</p>
      </div>
      <Select
        v-model="merchantFilter"
        :options="merchantOptions"
        option-label="label"
        option-value="value"
        :placeholder="$t('collectionBoard.allMerchants')"
        class="filter-select"
      />
    </div>

    <div v-if="store.loading && store.buckets.length === 0" class="board">
      <div v-for="i in 4" :key="i" class="surface-card skeleton-col" />
    </div>

    <div v-else-if="store.error" class="surface-card error-state">
      <i class="pi pi-exclamation-circle" />
      <p>{{ store.error }}</p>
      <button class="btn-ghost" @click="store.fetchBoard(merchantFilter ?? undefined)">{{ $t('common.retry') }}</button>
    </div>

    <div v-else class="board">
      <div v-for="bucket in store.buckets" :key="bucket.key" class="bucket surface-card">
        <header class="bucket-head" :style="{ borderColor: BUCKET_META[bucket.key]?.color }">
          <span class="bucket-title">
            {{ $t('collectionBoard.bucket', { range: bucket.key }) }}
          </span>
          <span class="bucket-count" :style="{ background: BUCKET_META[bucket.key]?.color }">
            {{ bucket.cards.length }}
          </span>
        </header>

        <div v-if="bucket.cards.length === 0" class="bucket-empty">{{ $t('common.noData') }}</div>

        <div v-else class="cards">
          <div v-for="card in bucket.cards" :key="card.dealId" class="card">
            <div class="card-top">
              <span class="card-client">{{ card.clientName }}</span>
              <span class="card-days" :style="{ color: BUCKET_META[bucket.key]?.color }">
                {{ $t('collectionBoard.daysOverdue', { days: card.daysOverdue }) }}
              </span>
            </div>
            <span class="card-merchant muted">{{ card.merchantName }}</span>
            <span class="card-phone font-mono muted">{{ card.clientPhone }}</span>
            <div class="card-bottom">
              <span class="font-mono card-amount">{{ formatSom(card.principal) }}</span>
              <span class="card-missed muted">{{ $t('collectionBoard.missed', { count: card.missedCount }) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.4rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.page-title { margin: 0 0 0.2rem; font-size: 1.55rem; font-weight: 800; }
.page-sub { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }
.filter-select { width: 220px; flex-shrink: 0; }

.board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; align-items: start; }
.skeleton-col { height: 360px; opacity: 0.5; animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity:.5 } 50% { opacity:.25 } }

.bucket { padding: 1rem; display: flex; flex-direction: column; gap: 0.8rem; }
.bucket-head {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 0.7rem; border-bottom: 2px solid var(--border-subtle);
}
.bucket-title { font-weight: 800; font-size: 0.9rem; }
.bucket-count { color: #fff; font-weight: 800; font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 999px; min-width: 22px; text-align: center; }
.bucket-empty { color: var(--text-secondary); font-size: 0.82rem; padding: 1rem 0; text-align: center; }

.cards { display: flex; flex-direction: column; gap: 0.6rem; }
.card { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.8rem; background: var(--bg-surface); border-radius: 10px; border: 1px solid var(--border-subtle); }
.card-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.card-client { font-weight: 700; font-size: 0.88rem; }
.card-days { font-weight: 800; font-size: 0.75rem; white-space: nowrap; }
.card-merchant { font-size: 0.76rem; }
.card-phone { font-size: 0.76rem; }
.card-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 0.3rem; }
.card-amount { font-weight: 700; font-size: 0.85rem; }
.card-missed { font-size: 0.72rem; }
.muted { color: var(--text-secondary); }

.error-state { padding: 3rem 2rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-align: center; }
.error-state i { font-size: 2.2rem; color: var(--danger); }
.error-state p { margin: 0; font-weight: 600; color: var(--text-secondary); }

@media (max-width: 1100px) { .board { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .board { grid-template-columns: 1fr; } }
</style>
