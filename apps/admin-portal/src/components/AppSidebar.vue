<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import ThemeToggle from './ThemeToggle.vue'

const props = defineProps<{ collapsed: boolean; mobileOpen?: boolean; isMobile?: boolean }>()
const emit = defineEmits<{ (e: 'toggle'): void }>()

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()

interface NavItem {
  label: string
  icon: string
  to: string
  feature?: string
  superadmin?: boolean
}

const allNav = computed<NavItem[]>(() => [
  { label: t('nav.overview'), icon: 'pi pi-th-large', to: '/' },
  { label: t('nav.merchants'), icon: 'pi pi-building', to: '/merchants', feature: 'view_merchants' },
  { label: t('nav.clients'), icon: 'pi pi-users', to: '/clients', feature: 'view_clients' },
  { label: t('nav.onboarding'), icon: 'pi pi-user-plus', to: '/onboarding/new', feature: 'onboard_merchants' },
  { label: t('nav.allDeals'), icon: 'pi pi-credit-card', to: '/deals', feature: 'view_deals' },
  { label: t('nav.tariffs'), icon: 'pi pi-percentage', to: '/tariffs', feature: 'view_tariffs' },
  { label: t('nav.employees'), icon: 'pi pi-users', to: '/employees', feature: 'manage_employees' },
  { label: t('nav.settings'), icon: 'pi pi-cog', to: '/settings', feature: 'manage_settings' },
  { label: t('nav.blacklist'), icon: 'pi pi-ban', to: '/blacklist', feature: 'manage_blacklist' },
  { label: t('nav.buyout'), icon: 'pi pi-shopping-bag', to: '/buyout', feature: 'manage_buyout' },
  { label: t('nav.collectionBoard'), icon: 'pi pi-table', to: '/collection-board', feature: 'view_collection_board' },
  { label: t('nav.scoringHistory'), icon: 'pi pi-chart-line', to: '/scoring-history', feature: 'view_scoring_history' },
  { label: t('nav.payments'), icon: 'pi pi-credit-card', to: '/payments', feature: 'view_payments' },
  { label: t('nav.notifications'), icon: 'pi pi-send', to: '/notifications', feature: 'send_notifications' },
{ label: t('nav.permissions'), icon: 'pi pi-shield', to: '/permissions', feature: 'manage_roles' },
])

const nav = computed<NavItem[]>(() =>
  allNav.value.filter((item) => {
    if (item.superadmin) return auth.isSuperadmin
    if (item.feature) return auth.can(item.feature)
    return true
  }),
)

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: props.collapsed, 'mobile-open': props.mobileOpen, 'is-mobile': props.isMobile }">
    <div class="brand">
      <div class="logo-mark">S</div>
      <div v-if="!props.collapsed" class="brand-text">
        <span class="text-gradient brand-name">Scoring</span>
        <span class="badge-label">{{ $t('nav.platformAdmin') }}</span>
      </div>
      <button class="collapse-btn" :title="$t('nav.toggleSidebar')" @click="emit('toggle')">
        <i :class="props.collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'" />
      </button>
    </div>

    <nav class="nav">
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="nav-link"
        active-class="active"
        :exact-active-class="item.to === '/' ? 'active' : ''"
        :title="item.label"
      >
        <i :class="item.icon" />
        <span v-if="!props.collapsed">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="footer">
      <div v-if="!props.collapsed" class="user-block">
        <div class="avatar">{{ auth.initials }}</div>
        <div class="user-meta">
          <span class="user-name">{{ auth.admin?.fullName }}</span>
          <span class="role-chip">{{ $t('nav.platformAdmin') }}</span>
        </div>
      </div>
      <div v-else class="avatar solo">{{ auth.initials }}</div>

      <div class="footer-actions" :class="{ stacked: props.collapsed }">
        <button class="logout-btn" :title="$t('nav.logout')" @click="logout">
          <i class="pi pi-sign-out" />
          <span v-if="!props.collapsed">{{ $t('nav.logout') }}</span>
        </button>
        <ThemeToggle />
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
  height: 100vh;
  position: sticky;
  top: 0;
}
.sidebar.collapsed {
  width: 64px;
}

.sidebar.is-mobile {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  height: 100dvh;
  z-index: 50;
  transform: translateX(-100%);
  transition: transform 0.25s ease;
  width: 240px;
}

.sidebar.is-mobile.mobile-open {
  transform: translateX(0);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.18);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 1rem 0.85rem;
  position: relative;
}
.logo-mark {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: var(--gradient-hero);
  color: #fff;
  font-weight: 800;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  gap: 0.2rem;
}
.brand-name {
  font-weight: 800;
  font-size: 1.05rem;
}
.badge-label {
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 14%, transparent);
  padding: 0.12rem 0.4rem;
  border-radius: 6px;
  width: fit-content;
}
.collapse-btn {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
}
.collapsed .collapse-btn {
  position: absolute;
  right: -12px;
  top: 1.2rem;
  background: var(--bg-base);
  z-index: 5;
}

.nav {
  flex: 1;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  overflow-y: auto;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 9px;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.86rem;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.collapsed .nav-link {
  justify-content: center;
  padding: 0.6rem;
}
.nav-link i {
  font-size: 1rem;
}
.nav-link:hover {
  background: var(--bg-base);
  color: var(--text-primary);
}
.nav-link.active {
  background: var(--gradient-accent);
  color: #fff;
  box-shadow: var(--accent-glow);
}

.footer {
  padding: 0.75rem;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.user-block {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--gradient-hero);
  color: #fff;
  font-weight: 700;
  font-size: 0.78rem;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.avatar.solo {
  margin: 0 auto;
}
.user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  overflow: hidden;
}
.user-name {
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.role-chip {
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--accent-2);
}
.footer-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.footer-actions.stacked {
  flex-direction: column;
}
.logout-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 9px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.logout-btn:hover {
  color: var(--danger);
  border-color: var(--danger);
}
</style>
