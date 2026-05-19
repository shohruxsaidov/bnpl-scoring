<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore, type AppNotification, type NotificationType } from '@/stores/notifications'

const store = useNotificationsStore()
const router = useRouter()
const { t } = useI18n()

type Tab = 'all' | 'unread'
const tab = ref<Tab>('all')

const iconMap: Record<NotificationType, string> = {
  deal_approved: 'pi pi-check-circle',
  deal_declined: 'pi pi-times-circle',
  payment_received: 'pi pi-credit-card',
  overdue: 'pi pi-exclamation-triangle',
  scoring_complete: 'pi pi-chart-line',
  new_deal: 'pi pi-plus-circle',
}
const colorMap: Record<NotificationType, string> = {
  deal_approved: 'var(--success)',
  deal_declined: 'var(--danger)',
  payment_received: 'var(--accent-2)',
  overdue: '#f59e0b',
  scoring_complete: 'var(--accent-2)',
  new_deal: 'var(--success)',
}

const filtered = computed<AppNotification[]>(() =>
  tab.value === 'unread' ? store.unread : store.items,
)

function dayKey(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return '__today__'
  if (d.toDateString() === yesterday.toDateString()) return '__yesterday__'
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' })
}

function dayLabel(key: string): string {
  if (key === '__today__') return t('notifications.today')
  if (key === '__yesterday__') return t('notifications.yesterday')
  return key
}

interface Group {
  key: string
  items: AppNotification[]
}

const groups = computed<Group[]>(() => {
  const map = new Map<string, AppNotification[]>()
  for (const n of filtered.value) {
    const k = dayKey(n.createdAt)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(n)
  }
  return Array.from(map.entries()).map(([key, items]) => ({ key, items }))
})

function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
}

function open(n: AppNotification) {
  router.push(`/notifications/${n.id}`)
}
</script>

<template>
  <div class="notifications-page">
    <!-- header row -->
    <div class="page-top">
      <div class="tabs">
        <button
          class="tab-btn"
          :class="{ active: tab === 'all' }"
          @click="tab = 'all'"
        >
          {{ t('notifications.tabAll') }}
          <span class="tab-count">{{ store.items.length }}</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: tab === 'unread' }"
          @click="tab = 'unread'"
        >
          {{ t('notifications.tabUnread') }}
          <span v-if="store.unreadCount > 0" class="tab-count unread-count">
            {{ store.unreadCount }}
          </span>
        </button>
      </div>

      <div class="top-actions">
        <button
          v-if="store.unreadCount > 0"
          class="action-btn"
          @click="store.markAllRead()"
        >
          <i class="pi pi-check-square" />
          {{ t('notifications.markAllRead') }}
        </button>
        <button
          v-if="store.items.some((n) => n.read)"
          class="action-btn danger"
          @click="store.clearRead()"
        >
          <i class="pi pi-trash" />
          {{ t('notifications.clearRead') }}
        </button>
      </div>
    </div>

    <!-- empty state -->
    <div v-if="filtered.length === 0" class="empty surface-card">
      <i class="pi pi-bell-slash empty-icon" />
      <p class="empty-text">{{ t('notifications.empty') }}</p>
    </div>

    <!-- grouped list -->
    <template v-else>
      <div v-for="group in groups" :key="group.key" class="group">
        <div class="group-label">{{ dayLabel(group.key) }}</div>
        <div class="group-list surface-card">
          <div
            v-for="(n, idx) in group.items"
            :key="n.id"
            class="item"
            :class="{ unread: !n.read, last: idx === group.items.length - 1 }"
            @click="open(n)"
          >
            <div class="icon-wrap" :style="{ color: colorMap[n.type] }">
              <i :class="iconMap[n.type]" />
            </div>

            <div class="content">
              <div class="row-top">
                <span class="item-title">{{ t(n.titleKey) }}</span>
                <span class="item-time">{{ timeStr(n.createdAt) }}</span>
              </div>
              <div class="item-body">{{ t(n.bodyKey, n.params) }}</div>
              <div v-if="n.dealId" class="deal-tag">
                <i class="pi pi-file" />
                {{ n.dealId }}
              </div>
            </div>

            <span v-if="!n.read" class="dot" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.notifications-page {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  max-width: 760px;
}

.page-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.tabs {
  display: flex;
  gap: 0.25rem;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 0.25rem;
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 1rem;
  border-radius: 9px;
  border: none;
  background: transparent;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.tab-btn.active {
  background: var(--gradient-accent);
  color: #fff;
  box-shadow: var(--accent-glow);
}
.tab-count {
  font-size: 0.72rem;
  font-weight: 800;
  background: var(--bg-surface);
  color: var(--text-secondary);
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
  line-height: 1.4;
}
.tab-btn.active .tab-count {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}
.unread-count {
  background: var(--danger) !important;
  color: #fff !important;
}

.top-actions {
  display: flex;
  gap: 0.5rem;
}
.action-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.action-btn:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}
.action-btn.danger:hover {
  color: var(--danger);
  border-color: var(--danger);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 2rem;
}
.empty-icon {
  font-size: 2.5rem;
  color: var(--text-secondary);
  opacity: 0.3;
}
.empty-text {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.group-label {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  opacity: 0.65;
  padding: 0 0.2rem;
}
.group-list {
  border-radius: 14px;
  overflow: hidden;
}

.item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.2rem;
  cursor: pointer;
  position: relative;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.13s;
}
.item.last {
  border-bottom: none;
}
.item:hover {
  background: var(--bg-surface);
}
.item.unread {
  background: color-mix(in srgb, var(--accent-2) 5%, transparent);
}
.item.unread:hover {
  background: color-mix(in srgb, var(--accent-2) 9%, transparent);
}

.icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 1.1rem;
}
.item.unread .icon-wrap {
  background: color-mix(in srgb, currentColor 12%, var(--bg-surface));
}

.content {
  flex: 1;
  min-width: 0;
}
.row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}
.item-title {
  font-size: 0.88rem;
  font-weight: 700;
}
.item-time {
  font-size: 0.72rem;
  color: var(--text-secondary);
  opacity: 0.65;
  font-weight: 600;
  white-space: nowrap;
}
.item-body {
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.45;
  margin-bottom: 0.35rem;
}
.deal-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 10%, transparent);
  border-radius: 6px;
  padding: 0.15rem 0.5rem;
}
.deal-tag i {
  font-size: 0.65rem;
}

.dot {
  position: absolute;
  top: 50%;
  right: 1.1rem;
  transform: translateY(-50%);
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent-2);
  flex-shrink: 0;
}

@media (max-width: 600px) {
  .page-top {
    flex-direction: column;
    align-items: flex-start;
  }
  .item {
    padding: 0.85rem 0.9rem;
  }
  .row-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
  }
}
</style>
