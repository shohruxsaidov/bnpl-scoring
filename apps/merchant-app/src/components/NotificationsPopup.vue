<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore, type AppNotification, type NotificationType } from '@/stores/notifications'

const emit = defineEmits<{ (e: 'close'): void }>()
const store = useNotificationsStore()
const router = useRouter()
const { t } = useI18n()

const root = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) {
    emit('close')
  }
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocClick))

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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('notifications.justNow')
  if (m < 60) return t('notifications.minutesAgo', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('notifications.hoursAgo', { n: h })
  return t('notifications.daysAgo', { n: Math.floor(h / 24) })
}

function open(n: AppNotification) {
  router.push(`/notifications/${n.id}`)
  emit('close')
}

function goAll() {
  router.push('/notifications')
  emit('close')
}
</script>

<template>
  <div ref="root" class="popup">
    <div class="popup-header">
      <span class="popup-title">{{ t('notifications.title') }}</span>
      <div class="popup-actions">
        <button
          v-if="store.unreadCount > 0"
          class="mark-all-btn"
          @click="store.markAllRead()"
        >
          {{ t('notifications.markAllRead') }}
        </button>
      </div>
    </div>

    <div v-if="store.recent.length === 0" class="empty">
      <i class="pi pi-bell-slash" />
      <span>{{ t('notifications.empty') }}</span>
    </div>

    <ul v-else class="list">
      <li
        v-for="n in store.recent"
        :key="n.id"
        class="item"
        :class="{ unread: !n.read }"
        @click="open(n)"
      >
        <div class="icon-wrap" :style="{ color: colorMap[n.type] }">
          <i :class="iconMap[n.type]" />
        </div>
        <div class="body">
          <div class="item-title">{{ t(n.titleKey) }}</div>
          <div class="item-body">{{ t(n.bodyKey, n.params) }}</div>
          <div class="item-time">{{ timeAgo(n.createdAt) }}</div>
        </div>
        <span v-if="!n.read" class="dot" />
      </li>
    </ul>

    <div class="popup-footer">
      <button class="view-all-btn" @click="goAll()">
        {{ t('notifications.viewAll') }}
        <i class="pi pi-arrow-right" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.popup {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 360px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  z-index: 100;
  overflow: hidden;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.1rem 0.7rem;
  border-bottom: 1px solid var(--border-subtle);
}
.popup-title {
  font-weight: 800;
  font-size: 0.95rem;
}
.popup-actions {
  display: flex;
  gap: 0.5rem;
}
.mark-all-btn {
  background: transparent;
  border: none;
  color: var(--accent-2);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 6px;
  transition: background 0.15s;
}
.mark-all-btn:hover {
  background: var(--bg-surface);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}
.empty i {
  font-size: 1.8rem;
  opacity: 0.35;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0.4rem 0;
  max-height: 340px;
  overflow-y: auto;
}

.item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1.1rem;
  cursor: pointer;
  transition: background 0.13s;
  position: relative;
}
.item:hover {
  background: var(--bg-surface);
}
.item.unread {
  background: color-mix(in srgb, var(--accent-2) 6%, transparent);
}
.item.unread:hover {
  background: color-mix(in srgb, var(--accent-2) 10%, transparent);
}

.icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--bg-surface);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 1rem;
  border: 1px solid var(--border-subtle);
}
.item.unread .icon-wrap {
  background: color-mix(in srgb, currentColor 12%, var(--bg-surface));
}

.body {
  flex: 1;
  min-width: 0;
}
.item-title {
  font-size: 0.83rem;
  font-weight: 700;
  margin-bottom: 0.2rem;
}
.item-body {
  font-size: 0.77rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.item-time {
  font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.65;
  font-weight: 600;
}

.dot {
  position: absolute;
  top: 50%;
  right: 1rem;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-2);
  flex-shrink: 0;
}

.popup-footer {
  border-top: 1px solid var(--border-subtle);
  padding: 0.65rem 1.1rem;
}
.view-all-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  background: transparent;
  border: none;
  color: var(--accent-2);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0.35rem;
  border-radius: 8px;
  transition: background 0.15s;
}
.view-all-btn:hover {
  background: var(--bg-surface);
}
.view-all-btn i {
  font-size: 0.72rem;
}

@media (max-width: 420px) {
  .popup {
    width: calc(100vw - 2rem);
    right: -0.5rem;
  }
}
</style>
