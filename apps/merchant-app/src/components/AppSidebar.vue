<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ (e: 'toggle'): void }>()

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()

interface NavItem {
  label: string
  icon: string
  to: string
  show: boolean
}

const mainNav = computed<NavItem[]>(() => [
  { label: t('nav.dashboard'), icon: 'pi pi-th-large', to: '/', show: true },
  { label: t('nav.newDeal'), icon: 'pi pi-plus-circle', to: '/wizard', show: auth.isAgent },
])

const adminNav = computed<NavItem[]>(() => [
  { label: t('nav.products'), icon: 'pi pi-box', to: '/admin/products', show: true },
  { label: t('nav.categories'), icon: 'pi pi-tags', to: '/admin/categories', show: true },
  { label: t('nav.tariffs'), icon: 'pi pi-percentage', to: '/admin/tariffs', show: true },
  { label: t('nav.employees'), icon: 'pi pi-users', to: '/admin/employees', show: true },
  { label: t('nav.collectionBoard'), icon: 'pi pi-table', to: '/admin/collection-board', show: true },
  { label: t('nav.scoringHistory'), icon: 'pi pi-chart-line', to: '/admin/scoring-history', show: true },
  { label: t('nav.buyout'), icon: 'pi pi-shopping-bag', to: '/admin/buyout', show: true },
  { label: t('nav.payments'), icon: 'pi pi-credit-card', to: '/admin/payments', show: true },
])

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: props.collapsed }">
    <div class="brand">
      <div class="logo-mark">S</div>
      <div v-if="!props.collapsed" class="brand-text">
        <span class="text-gradient brand-name">Scoring</span>
        <span class="tenant">{{ auth.tenant.name }}</span>
      </div>
      <button class="collapse-btn" :title="$t('nav.toggleSidebar')" @click="emit('toggle')">
        <i :class="props.collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'" />
      </button>
    </div>

    <nav class="nav">
      <template v-for="item in mainNav" :key="item.to">
        <RouterLink
          v-if="item.show"
          :to="item.to"
          class="nav-link"
          active-class="active"
          :title="item.label"
        >
          <i :class="item.icon" />
          <span v-if="!props.collapsed">{{ item.label }}</span>
        </RouterLink>
      </template>

      <div v-if="auth.isAdmin" class="divider">
        <span v-if="!props.collapsed">{{ $t('nav.admin') }}</span>
        <span v-else class="dot-divider" />
      </div>

      <template v-if="auth.isAdmin">
        <RouterLink
          v-for="item in adminNav"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          active-class="active"
          :title="item.label"
        >
          <i :class="item.icon" />
          <span v-if="!props.collapsed">{{ item.label }}</span>
        </RouterLink>
      </template>
    </nav>

    <div class="footer">
      <div v-if="!props.collapsed" class="user-block">
        <div class="avatar">{{ auth.employee?.fullName.charAt(0) }}</div>
        <div class="user-meta">
          <span class="user-name">{{ auth.employee?.fullName }}</span>
          <span class="role-chip">{{ auth.roleLabel }}</span>
        </div>
      </div>
      <div v-else class="avatar solo">{{ auth.employee?.fullName.charAt(0) }}</div>

      <button class="logout-btn" :title="$t('nav.logout')" @click="logout">
        <i class="pi pi-sign-out" />
        <span v-if="!props.collapsed">{{ $t('nav.logout') }}</span>
      </button>
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

.brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 1.1rem 0.9rem;
  position: relative;
}
.logo-mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
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
  line-height: 1.1;
}
.brand-name {
  font-weight: 800;
  font-size: 1.05rem;
}
.tenant {
  font-size: 0.7rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.collapse-btn {
  margin-left: auto;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
}
.collapsed .collapse-btn {
  position: absolute;
  right: -13px;
  top: 1.3rem;
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
  gap: 0.8rem;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.collapsed .nav-link {
  justify-content: center;
  padding: 0.65rem;
}
.nav-link i {
  font-size: 1.05rem;
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
.divider {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  padding: 0.9rem 0.8rem 0.4rem;
  opacity: 0.6;
}
.dot-divider {
  display: block;
  height: 1px;
  background: var(--border-subtle);
  margin: 0.4rem 0.4rem;
}

.footer {
  padding: 0.8rem;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.user-block {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--gradient-hero);
  color: #fff;
  font-weight: 700;
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
  font-size: 0.85rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.role-chip {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--accent-2);
}
.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.55rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.logout-btn:hover {
  color: var(--danger);
  border-color: var(--danger);
}
</style>
