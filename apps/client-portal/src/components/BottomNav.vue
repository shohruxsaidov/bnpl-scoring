<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '@/stores/notifications'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const notifications = useNotificationsStore()

const unread = computed(() => notifications.unreadCount)

interface NavItem {
  name: string
  labelKey: string
  icon: string
  match: string[]
}

const items: NavItem[] = [
  { name: 'home', labelKey: 'nav.home', icon: 'pi-home', match: ['home'] },
  { name: 'deals', labelKey: 'nav.deals', icon: 'pi-credit-card', match: ['deals', 'deal-detail'] },
  { name: 'notifications', labelKey: 'nav.alerts', icon: 'pi-bell', match: ['notifications'] },
  { name: 'profile', labelKey: 'nav.profile', icon: 'pi-user', match: ['profile'] },
]

function isActive(item: NavItem): boolean {
  return item.match.includes(route.name as string)
}

function go(item: NavItem) {
  router.push({ name: item.name })
}
</script>

<template>
  <nav class="bottom-nav">
    <button
      v-for="item in items"
      :key="item.name"
      class="nav-item"
      :class="{ active: isActive(item) }"
      @click="go(item)"
    >
      <span class="icon-wrap">
        <i class="pi" :class="item.icon" />
        <span
          v-if="item.name === 'notifications' && unread > 0"
          class="nav-badge"
          >{{ unread }}</span
        >
      </span>
      <span class="nav-label">{{ t(item.labelKey) }}</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  background: var(--bg-base);
  border-top: 1px solid var(--border-subtle);
  padding: 0.5rem 0.5rem calc(0.5rem + env(safe-area-inset-bottom));
}
.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.15s ease;
}
.nav-item .icon-wrap {
  position: relative;
  font-size: 1.3rem;
  line-height: 1;
}
.nav-label {
  font-size: 0.7rem;
  font-weight: 700;
}
.nav-item.active {
  color: var(--accent-1);
}
.nav-item.active .icon-wrap i {
  background: var(--gradient-hero);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}
.nav-item.active .nav-label {
  background: var(--gradient-hero);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}
.nav-badge {
  position: absolute;
  top: -6px;
  right: -10px;
  background: var(--danger);
  color: #fff;
  font-size: 0.58rem;
  font-weight: 800;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  padding: 0 4px;
}
</style>
