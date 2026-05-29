<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCollectionBoardQuery, useRefreshCollectionBoard } from '@/composables/useCollectionBoardApi'
import type { OverdueCard } from '@/composables/useCollectionBoardApi'

const router = useRouter()
const { t } = useI18n()

// ── Data ──────────────────────────────────────────────────────────────────

const { data: rawBuckets, isLoading, isError, error } = useCollectionBoardQuery()
const refresh = useRefreshCollectionBoard()

// ── Bucket metadata (static) ──────────────────────────────────────────────

interface BucketMeta {
  key: string
  label: string
  icon: string
  color: string
  collapsed: boolean
}

const meta: BucketMeta[] = [
  { key: '1-30',  label: t('collectionBoard.bucket1to30'),  icon: 'pi pi-clock',                color: '#ffb02e', collapsed: false },
  { key: '31-60', label: t('collectionBoard.bucket31to60'), icon: 'pi pi-exclamation-triangle',  color: '#ff8c42', collapsed: false },
  { key: '61-90', label: t('collectionBoard.bucket61to90'), icon: 'pi pi-shield',                color: '#f05c42', collapsed: false },
  { key: '90+',   label: t('collectionBoard.bucket90plus'), icon: 'pi pi-ban',                   color: '#ff5c5c', collapsed: false },
]

// ── Merged buckets (meta + real cards) ────────────────────────────────────

const buckets = computed(() =>
  meta.map((m) => ({
    ...m,
    cards: rawBuckets.value?.find((b) => b.key === m.key)?.cards ?? [],
  }))
)

// ── Actions ───────────────────────────────────────────────────────────────

function openDeal(dealId: string) {
  router.push({ name: 'deal-detail', params: { id: dealId } })
}

function fmt(tiyin: number) {
  return (tiyin / 100).toLocaleString('uz-UZ') + ' so\'m'
}
</script>

<template>
  <div class="board-page">

    <!-- ── Loading skeleton ─────────────────────────────────────────────── -->
    <template v-if="isLoading">
      <div class="page-actions skeleton-bar" />
      <div class="kanban">
        <div v-for="i in 4" :key="i" class="column skeleton-col" />
      </div>
    </template>

    <!-- ── Error ────────────────────────────────────────────────────────── -->
    <div v-else-if="isError" class="error-state surface-card">
      <i class="pi pi-exclamation-circle" />
      <p>{{ (error as Error)?.message || $t('common.error') }}</p>
      <button class="btn-refresh" @click="refresh()">
        <i class="pi pi-refresh" />
        {{ $t('collectionBoard.refresh') }}
      </button>
    </div>

    <template v-else>
      <!-- ── Toolbar ──────────────────────────────────────────────────── -->
      <div class="page-actions">
        <button class="btn-refresh" @click="refresh()">
          <i class="pi pi-refresh" />
          {{ $t('collectionBoard.refresh') }}
        </button>
      </div>

      <!-- ── Summary pills ────────────────────────────────────────────── -->
      <div class="summary-pills">
        <div v-for="bucket in buckets" :key="bucket.key" class="pill">
          <span class="pill-dot" :style="{ background: bucket.color }" />
          <span class="pill-label">{{ bucket.label }}</span>
          <span class="pill-count">{{ bucket.cards.length }}</span>
        </div>
      </div>

      <!-- ── Kanban columns ────────────────────────────────────────────── -->
      <div class="kanban">
        <div v-for="bucket in buckets" :key="bucket.key" class="column">
          <!-- Column header -->
          <div class="col-header" :style="{ '--bucket-color': bucket.color }">
            <div class="col-title">
              <i :class="bucket.icon" :style="{ color: bucket.color }" />
              <span>{{ bucket.label }}</span>
              <span class="col-count">{{ bucket.cards.length }}</span>
            </div>
            <button
              class="col-toggle"
              :title="bucket.collapsed ? $t('collectionBoard.show') : $t('collectionBoard.hide')"
              @click="bucket.collapsed = !bucket.collapsed"
            >
              <i :class="bucket.collapsed ? 'pi pi-eye-slash' : 'pi pi-eye'" />
            </button>
          </div>

          <!-- Cards -->
          <div v-if="!bucket.collapsed" class="col-body">
            <button
              v-for="card in bucket.cards"
              :key="card.dealId"
              class="deal-card"
              @click="openDeal(card.dealId)"
            >
              <div class="card-top">
                <span class="client-name">{{ card.clientName }}</span>
                <span class="days-badge" :style="{ background: bucket.color + '22', color: bucket.color }">
                  {{ card.daysOverdue }} {{ $t('collectionBoard.days') }}
                </span>
              </div>
              <div class="client-phone">{{ card.clientPhone }}</div>
              <div class="card-meta">
                <span class="principal font-mono">{{ fmt(card.principal) }}</span>
                <span class="missed">
                  <i class="pi pi-times-circle" />
                  {{ card.missedCount }} {{ $t('collectionBoard.payment') }}
                </span>
              </div>
            </button>

            <div v-if="bucket.cards.length === 0" class="empty-state">
              <i class="pi pi-check-circle" />
              <span>{{ $t('collectionBoard.empty') }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.board-page {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  min-height: 100%;
}

/* Toolbar */
.page-actions {
  display: flex;
  justify-content: flex-end;
}
.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.1rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-family: inherit;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-refresh:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}

/* Skeleton */
.skeleton-bar {
  height: 38px;
  border-radius: 10px;
  background: var(--bg-base);
  opacity: 0.5;
  animation: pulse 1.4s ease-in-out infinite;
  align-self: flex-end;
  width: 140px;
}
.skeleton-col {
  height: 280px;
  border-radius: 14px;
  background: var(--bg-base);
  opacity: 0.5;
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: .5 } 50% { opacity: .25 } }

/* Error */
.error-state {
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}
.error-state i { font-size: 2.2rem; color: var(--danger); }
.error-state p { margin: 0; color: var(--text-secondary); font-weight: 600; }

/* Summary pills */
.summary-pills {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  font-size: 0.82rem;
  font-weight: 700;
}
.pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pill-label { color: var(--text-secondary); }
.pill-count { color: var(--text-primary); }

/* Kanban */
.kanban {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  align-items: start;
}

/* Column */
.column {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;
}
.col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem 0.75rem;
  border-bottom: 2px solid var(--bucket-color);
}
.col-title {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 700;
  font-size: 0.9rem;
}
.col-title i { font-size: 0.95rem; }
.col-count {
  background: var(--border-subtle);
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 800;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  padding: 0 5px;
}
.col-toggle {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.15s ease;
}
.col-toggle:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}
.col-body {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-height: 120px;
}

/* Deal card */
.deal-card {
  width: 100%;
  text-align: left;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-family: inherit;
}
.deal-card:hover {
  border-color: var(--accent-2);
  box-shadow: var(--shadow-card);
  transform: translateY(-1px);
}
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}
.client-name {
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--text-primary);
}
.days-badge {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}
.client-phone {
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
}
.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.2rem;
}
.principal {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
}
.missed {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--danger);
}
.missed i { font-size: 0.8rem; }

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: var(--text-secondary);
  opacity: 0.5;
}
.empty-state i { font-size: 1.4rem; }
.empty-state span { font-size: 0.82rem; font-weight: 600; }

@media (max-width: 900px) {
  .kanban { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 580px) {
  .kanban { grid-template-columns: 1fr; }
}
</style>
