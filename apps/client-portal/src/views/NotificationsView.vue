<script setup lang="ts">
import { computed } from 'vue'
import { useNotificationsStore } from '@/stores/notifications'
import { relativeTime } from '@/utils/money'
import type { NotificationKind } from '@/types'

const store = useNotificationsStore()

const list = computed(() => store.sorted)
const hasUnread = computed(() => store.unreadCount > 0)

const ICON: Record<NotificationKind, string> = {
  overdue: 'pi-exclamation-triangle',
  payment: 'pi-check-circle',
  deal: 'pi-file',
  message: 'pi-megaphone',
}

function onClick(id: string) {
  store.markRead(id)
}
</script>

<template>
  <div class="notifications">
    <header class="head">
      <h1>{{ $t('notifications.title') }}</h1>
      <p class="sub">
        {{ $t('notifications.unreadOf', { count: store.unreadCount, total: store.items.length }) }}
      </p>
      <button
        class="mark-all"
        :disabled="!hasUnread"
        @click="store.markAllRead()"
      >
        {{ $t('notifications.markAllRead') }}
      </button>
    </header>

    <div class="list">
      <button
        v-for="n in list"
        :key="n.id"
        class="ntf surface-card"
        :class="[n.kind, { unread: !n.read }]"
        @click="onClick(n.id)"
      >
        <span class="ntf-icon" :class="n.kind">
          <i class="pi" :class="ICON[n.kind]" />
        </span>
        <div class="ntf-body">
          <div class="ntf-top">
            <span class="ntf-title">{{ n.title }}</span>
            <span v-if="!n.read" class="ntf-dot" />
          </div>
          <p class="ntf-text">{{ n.body }}</p>
          <span class="ntf-time font-mono">{{ relativeTime(n.createdAt) }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.notifications {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.head {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.head h1 {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
}
.sub {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
}
.mark-all {
  align-self: flex-start;
  margin-top: 0.5rem;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 0.55rem 1rem;
  color: var(--accent-2);
  font-weight: 700;
  font-size: 0.82rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}
.mark-all:hover:not(:disabled) {
  border-color: var(--accent-2);
}
.mark-all:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.ntf {
  display: flex;
  gap: 0.9rem;
  padding: 1.1rem;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.ntf:hover {
  border-color: var(--accent-2);
}
.ntf.unread {
  background: color-mix(in srgb, var(--accent-1) 5%, var(--bg-base));
}
.ntf-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}
.ntf-icon.overdue {
  background: var(--danger-bg);
  color: var(--danger);
}
.ntf-icon.payment {
  background: var(--success-bg);
  color: var(--success);
}
.ntf-icon.deal {
  background: var(--bg-surface);
  color: var(--accent-2);
}
.ntf-icon.message {
  background: color-mix(in srgb, var(--accent-2) 12%, var(--bg-surface));
  color: var(--accent-2);
}
.ntf-body {
  flex: 1;
  min-width: 0;
}
.ntf-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.ntf-title {
  font-size: 0.95rem;
  font-weight: 800;
}
.ntf.overdue .ntf-title {
  color: var(--danger);
}
.ntf-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-1);
  flex-shrink: 0;
}
.ntf-text {
  margin: 0.3rem 0 0.5rem;
  font-size: 0.83rem;
  color: var(--text-secondary);
  line-height: 1.5;
}
.ntf-time {
  font-size: 0.72rem;
  color: var(--text-secondary);
  opacity: 0.75;
}
</style>
