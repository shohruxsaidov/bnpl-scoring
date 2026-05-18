<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import ThemeToggle from './ThemeToggle.vue'
import { useNotificationsStore } from '@/stores/notifications'

const router = useRouter()
const notifications = useNotificationsStore()

const unread = computed(() => notifications.unreadCount)

function goNotifications() {
  router.push({ name: 'notifications' })
}
</script>

<template>
  <header class="topbar">
    <div class="brand" @click="router.push({ name: 'home' })">
      <span class="logo-mark">S</span>
      <span class="brand-name">Scoring</span>
    </div>

    <div class="right">
      <button class="bell" title="Notifications" @click="goNotifications">
        <i class="pi pi-bell" />
        <span v-if="unread > 0" class="badge">{{ unread }}</span>
      </button>
      <ThemeToggle />
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  background: var(--bg-base);
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 20;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
}
.logo-mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--gradient-hero);
  display: grid;
  place-items: center;
  font-size: 1rem;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}
.brand-name {
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.right {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.bell {
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.15s ease;
}
.bell:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}
.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--danger);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 800;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  padding: 0 4px;
}
</style>
