<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Select from 'primevue/select'
import { useCollectionBoardStore, type OverdueCard } from '@/stores/collectionBoard'
import { useMerchantsStore } from '@/stores/merchants'
import { formatSom, formatDateTime } from '@/utils/money'
import { useDealCommentsQuery, useAddDealComment } from '@/composables/useAdminDealsApi'

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
  '1-30':  { color: 'var(--warning)' },
  '31-60': { color: '#FF8C42' },
  '61-90': { color: 'var(--danger)' },
  '90+':   { color: '#B91C1C' },
}

// ── Comment panel ──────────────────────────────────────────────────────────

const selectedCard = ref<OverdueCard | null>(null)
const panelOpen = ref(false)

function openPanel(card: OverdueCard) {
  selectedCard.value = card
  panelOpen.value = true
  newComment.value = ''
}

function closePanel() {
  panelOpen.value = false
}

const selectedDealId = computed(() => selectedCard.value?.dealId ?? '')

const { data: comments, isLoading: commentsLoading } = useDealCommentsQuery(selectedDealId)
const { mutate: addComment, isPending: isSubmitting } = useAddDealComment(selectedDealId)
const newComment = ref('')

function submitComment() {
  const text = newComment.value.trim()
  if (!text) return
  addComment(text, { onSuccess: () => { newComment.value = '' } })
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
          <div
            v-for="card in bucket.cards"
            :key="card.dealId"
            class="card"
            @click="openPanel(card)"
          >
            <div class="card-top">
              <span class="card-client">{{ card.clientName }}</span>
              <span class="card-days" :style="{ color: BUCKET_META[bucket.key]?.color }">
                {{ $t('collectionBoard.daysOverdue', { days: card.daysOverdue }) }}
              </span>
            </div>
            <span class="font-mono card-deal-number">{{ card.dealNumber }}</span>
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

    <!-- ── Comment slide-over ──────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="overlay">
        <div v-if="panelOpen" class="overlay" @click.self="closePanel" />
      </Transition>
      <Transition name="panel">
        <aside v-if="panelOpen && selectedCard" class="comment-panel">
          <!-- Header -->
          <div class="panel-header">
            <div>
              <div class="panel-client">{{ selectedCard.clientName }}</div>
              <div class="panel-sub muted">{{ selectedCard.merchantName }} · {{ selectedCard.clientPhone }}</div>
            </div>
            <button class="close-btn" @click="closePanel">
              <i class="pi pi-times" />
            </button>
          </div>

          <!-- Deal stats -->
          <div class="panel-stats">
            <div class="stat">
              <span class="stat-label">{{ $t('collectionBoard.panelPrincipal') }}</span>
              <span class="stat-val font-mono">{{ formatSom(selectedCard.principal) }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">{{ $t('collectionBoard.panelMissed') }}</span>
              <span class="stat-val font-mono">{{ selectedCard.missedCount }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">{{ $t('collectionBoard.panelDays') }}</span>
              <span class="stat-val font-mono">{{ selectedCard.daysOverdue }}</span>
            </div>
          </div>

          <!-- Comments list -->
          <div class="panel-section-title">{{ $t('collectionBoard.panelComments') }}</div>
          <div class="comments-area">
            <div v-if="commentsLoading" class="comments-loading">
              <i class="pi pi-spin pi-spinner" />
            </div>
            <div v-else-if="!comments?.length" class="comments-empty">
              {{ $t('collectionBoard.commentsEmpty') }}
            </div>
            <div v-else class="comment-list">
              <div v-for="c in comments" :key="c.id" class="comment-item">
                <div class="comment-meta">
                  <span class="comment-author">{{ c.authorName }}</span>
                  <span class="muted font-mono comment-time">{{ formatDateTime(c.createdAt) }}</span>
                </div>
                <p class="comment-text">{{ c.text }}</p>
              </div>
            </div>
          </div>

          <!-- Compose -->
          <div class="compose">
            <textarea
              v-model="newComment"
              class="compose-textarea"
              :placeholder="$t('collectionBoard.commentPlaceholder')"
              rows="3"
              :disabled="isSubmitting"
              @keydown.ctrl.enter="submitComment"
            />
            <button
              class="compose-btn"
              :disabled="!newComment.trim() || isSubmitting"
              @click="submitComment"
            >
              <i class="pi pi-send" />
              {{ isSubmitting ? $t('collectionBoard.commentSubmitting') : $t('collectionBoard.commentSubmit') }}
            </button>
          </div>
        </aside>
      </Transition>
    </Teleport>
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
.card {
  display: flex; flex-direction: column; gap: 0.25rem; padding: 0.8rem;
  background: var(--bg-surface); border-radius: 10px; border: 1px solid var(--border-subtle);
  cursor: pointer; transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.card:hover { border-color: var(--accent-2); box-shadow: 0 2px 10px color-mix(in srgb, var(--accent-2) 15%, transparent); }
.card-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.card-client { font-weight: 700; font-size: 0.88rem; }
.card-days { font-weight: 800; font-size: 0.75rem; white-space: nowrap; }
.card-deal-number { font-size: 0.72rem; font-weight: 700; color: var(--accent-2); }
.card-merchant { font-size: 0.76rem; }
.card-phone { font-size: 0.76rem; }
.card-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 0.3rem; }
.card-amount { font-weight: 700; font-size: 0.85rem; }
.card-missed { font-size: 0.72rem; }
.muted { color: var(--text-secondary); }

.error-state { padding: 3rem 2rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-align: center; }
.error-state i { font-size: 2.2rem; color: var(--danger); }
.error-state p { margin: 0; font-weight: 600; color: var(--text-secondary); }

/* ── Slide-over panel ─────────────────────────────────────────────────────── */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 400;
  backdrop-filter: blur(2px);
}
.comment-panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: 380px; z-index: 401;
  background: var(--bg-elevated); border-left: 1px solid var(--border-subtle);
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: -8px 0 32px rgba(0,0,0,0.15);
}

.panel-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 1.2rem 1.2rem 1rem; border-bottom: 1px solid var(--border-subtle); flex-shrink: 0;
}
.panel-client { font-size: 1rem; font-weight: 800; }
.panel-sub { font-size: 0.78rem; margin-top: 0.2rem; }
.close-btn {
  background: transparent; border: none; color: var(--text-secondary);
  cursor: pointer; padding: 0.2rem; font-size: 1rem; line-height: 1; margin-top: 0.1rem;
  transition: color 0.15s;
}
.close-btn:hover { color: var(--text-primary); }

.panel-stats {
  display: flex; gap: 0; border-bottom: 1px solid var(--border-subtle); flex-shrink: 0;
}
.stat { flex: 1; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.2rem; }
.stat + .stat { border-left: 1px solid var(--border-subtle); }
.stat-label { font-size: 0.68rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
.stat-val { font-size: 0.9rem; font-weight: 800; }

.panel-section-title {
  padding: 0.75rem 1.2rem 0.5rem; font-size: 0.72rem; font-weight: 700;
  color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;
  flex-shrink: 0;
}

.comments-area { flex: 1; overflow-y: auto; padding: 0 1.2rem; }
.comments-loading { display: flex; justify-content: center; padding: 2rem; color: var(--text-secondary); }
.comments-empty { color: var(--text-secondary); font-size: 0.85rem; padding: 1.5rem 0; text-align: center; }

.comment-list { display: flex; flex-direction: column; }
.comment-item { padding: 0.75rem 0; border-bottom: 1px solid var(--border-subtle); }
.comment-item:last-child { border-bottom: none; }
.comment-meta { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; }
.comment-author { font-size: 0.78rem; font-weight: 700; }
.comment-time { font-size: 0.72rem; }
.comment-text { margin: 0; font-size: 0.85rem; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }

.compose {
  padding: 0.9rem 1.2rem; border-top: 1px solid var(--border-subtle);
  display: flex; flex-direction: column; gap: 0.6rem; flex-shrink: 0;
}
.compose-textarea {
  width: 100%; padding: 0.6rem 0.75rem; font-size: 0.85rem; font-family: inherit;
  background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px;
  color: var(--text-primary); resize: none; outline: none; box-sizing: border-box;
  transition: border-color 0.15s;
}
.compose-textarea:focus { border-color: var(--accent-2); }
.compose-textarea:disabled { opacity: 0.6; }
.compose-btn {
  align-self: flex-end; display: inline-flex; align-items: center; gap: 0.4rem;
  background: var(--gradient-hero); color: #fff; border: none; border-radius: 8px;
  padding: 0.45rem 1rem; font-size: 0.82rem; font-weight: 700; font-family: inherit;
  cursor: pointer; transition: opacity 0.15s;
}
.compose-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Transitions ──────────────────────────────────────────────────────────── */
.overlay-enter-active, .overlay-leave-active { transition: opacity 0.22s ease; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }

.panel-enter-active, .panel-leave-active { transition: transform 0.25s cubic-bezier(0.4,0,0.2,1); }
.panel-enter-from, .panel-leave-to { transform: translateX(100%); }

@media (max-width: 1100px) { .board { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) {
  .board { grid-template-columns: 1fr; }
  .comment-panel { width: 100%; }
}
@media (max-width: 450px) {
  .filter-select { width: 100%; }
}
</style>
