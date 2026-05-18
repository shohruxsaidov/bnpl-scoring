<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

interface OverdueCard {
  dealId: string
  clientName: string
  clientPhone: string
  principal: number
  missedCount: number
  daysOverdue: number
}

interface AgingBucket {
  key: string
  label: string
  icon: string
  color: string
  cards: OverdueCard[]
  collapsed: boolean
}

const router = useRouter()

const buckets = ref<AgingBucket[]>([
  {
    key: '1-30',
    label: '1–30 дн.',
    icon: 'pi pi-clock',
    color: '#ffb02e',
    collapsed: false,
    cards: [
      { dealId: 'd1', clientName: 'Алишер Каримов', clientPhone: '+998 90 123 45 67', principal: 450000_00, missedCount: 1, daysOverdue: 8 },
      { dealId: 'd2', clientName: 'Нилуфар Юсупова', clientPhone: '+998 91 234 56 78', principal: 320000_00, missedCount: 1, daysOverdue: 22 },
    ],
  },
  {
    key: '31-60',
    label: '31–60 дн.',
    icon: 'pi pi-exclamation-triangle',
    color: '#ff8c42',
    collapsed: false,
    cards: [
      { dealId: 'd3', clientName: 'Бобур Рашидов', clientPhone: '+998 93 345 67 89', principal: 780000_00, missedCount: 2, daysOverdue: 45 },
    ],
  },
  {
    key: '61-90',
    label: '61–90 дн.',
    icon: 'pi pi-shield',
    color: '#f05c42',
    collapsed: false,
    cards: [],
  },
  {
    key: '90+',
    label: '90+ дн.',
    icon: 'pi pi-ban',
    color: '#ff5c5c',
    collapsed: false,
    cards: [],
  },
])

function refresh() {
  // TODO: call GET /api/collection-board
}

function openDeal(dealId: string) {
  router.push({ name: 'deal-detail', params: { id: dealId } })
}

function fmt(tiyin: number) {
  return (tiyin / 100).toLocaleString('uz-UZ') + ' so\'m'
}

const totalCount = buckets.value.reduce((s, b) => s + b.cards.length, 0)
</script>

<template>
  <div class="board-page">
    <!-- Refresh -->
    <div class="page-actions">
      <button class="btn-refresh" @click="refresh">
        <i class="pi pi-refresh" />
        Обновить
      </button>
    </div>

    <!-- Summary pills -->
    <div class="summary-pills">
      <div
        v-for="bucket in buckets"
        :key="bucket.key"
        class="pill"
      >
        <span class="pill-dot" :style="{ background: bucket.color }" />
        <span class="pill-label">{{ bucket.label }}</span>
        <span class="pill-count">{{ bucket.cards.length }}</span>
      </div>
    </div>

    <!-- Kanban columns -->
    <div class="kanban">
      <div
        v-for="bucket in buckets"
        :key="bucket.key"
        class="column"
      >
        <!-- Column header -->
        <div class="col-header" :style="{ '--bucket-color': bucket.color }">
          <div class="col-title">
            <i :class="bucket.icon" :style="{ color: bucket.color }" />
            <span>{{ bucket.label }}</span>
          </div>
          <button
            class="col-toggle"
            :title="bucket.collapsed ? 'Показать' : 'Скрыть'"
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
                {{ card.daysOverdue }} дн.
              </span>
            </div>
            <div class="client-phone">{{ card.clientPhone }}</div>
            <div class="card-meta">
              <span class="principal font-mono">{{ fmt(card.principal) }}</span>
              <span class="missed">
                <i class="pi pi-times-circle" />
                {{ card.missedCount }} платёж
              </span>
            </div>
          </button>

          <div v-if="bucket.cards.length === 0" class="empty-state">
            <i class="pi pi-check-circle" />
            <span>Пусто</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board-page {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  min-height: 100%;
}

/* Header */
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
.pill-label {
  color: var(--text-secondary);
}
.pill-count {
  color: var(--text-primary);
}

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
.col-title i {
  font-size: 0.95rem;
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
.missed i {
  font-size: 0.8rem;
}

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
.empty-state i {
  font-size: 1.4rem;
}
.empty-state span {
  font-size: 0.82rem;
  font-weight: 600;
}
</style>
