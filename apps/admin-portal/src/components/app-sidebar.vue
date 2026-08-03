<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useStuckPaymentsStore } from '@/stores/stuck-payments'

const props = defineProps<{ collapsed: boolean; mobileOpen?: boolean; isMobile?: boolean }>()
const emit = defineEmits<{ (e: 'toggle'): void }>()

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const stuck = useStuckPaymentsStore()

// Stranded card payments are created by a background sweeper, at any hour, with
// nobody watching. The client notices immediately — their money is gone and
// their balance did not move — so the least this nav can do is carry the number
// to whoever logs in first.
onMounted(() => {
  if (auth.can('view_payments')) stuck.fetchCount()
})

/** Permission gate, identical on sections and on the links inside them. */
interface Gated {
  feature?: string
  /** Hub entries: shown when the admin holds ANY of these. Mirrors meta.anyFeature. */
  anyFeature?: string[]
  superadmin?: boolean
}

interface NavItem extends Gated {
  label: string
  icon: string
  to: string
  /** Rendered as a count chip; omitted or 0 shows nothing. */
  badge?: number
}

/**
 * One top-level row. `children` empty means it is a plain link and `to` is the
 * target; otherwise it is a section that expands and `to` is unused. Keeping a
 * single shape for both keeps the template free of type narrowing.
 */
interface NavEntry extends Gated {
  key: string
  label: string
  icon: string
  to: string
  children: NavItem[]
  /** Only meaningful on a plain link; a section rolls its children's up instead. */
  badge?: number
}

const allNav = computed<NavEntry[]>(() => [
  { key: 'overview', label: t('nav.overview'), icon: 'pi pi-th-large', to: '/', children: [] },

  { key: 'clients', label: t('nav.clients'), icon: 'pi pi-users', to: '/clients', feature: 'view_clients', children: [] },

  {
    key: 'counterparties',
    label: t('nav.groups.counterparties'),
    icon: 'pi pi-building',
    to: '',
    children: [
      { label: t('nav.merchants'), icon: 'pi pi-building', to: '/merchants', feature: 'view_merchants' },
      { label: t('nav.blacklist'), icon: 'pi pi-ban', to: '/blacklist', feature: 'manage_blacklist' },
    ],
  },
  {
    key: 'deals',
    label: t('nav.groups.deals'),
    icon: 'pi pi-credit-card',
    to: '',
    children: [
      { label: t('nav.allDeals'), icon: 'pi pi-credit-card', to: '/deals', feature: 'view_deals' },
      // { label: t('nav.tariffs'), icon: 'pi pi-percentage', to: '/tariffs', feature: 'view_tariffs' },
      { label: t('nav.buyout'), icon: 'pi pi-shopping-bag', to: '/buyout', feature: 'manage_buyout' },
      { label: t('nav.collectionBoard'), icon: 'pi pi-table', to: '/collection-board', feature: 'view_collection_board' },
    ],
  },
  { key: 'scorings', label: t('nav.scorings'), icon: 'pi pi-list-check', to: '/scorings', feature: 'view_scorings', children: [] },

  { key: 'payments', label: t('nav.payments'), icon: 'pi pi-wallet', to: '/payments', feature: 'view_payments', children: [] },
  // { key: 'stuckPayments', label: t('nav.stuckPayments'), icon: 'pi pi-exclamation-triangle', to: '/payments/stuck', feature: 'view_payments', badge: stuck.strandedCount, children: [] },

  // { key: 'banners', label: t('nav.banners'), icon: 'pi pi-images', to: '/banners', feature: 'manage_banners', children: [] },
  { key: 'categories', label: t('nav.categories'), icon: 'pi pi-tag', to: '/categories', feature: 'manage_global_categories', children: [] },

  {
    key: 'administration',
    label: t('nav.groups.administration'),
    icon: 'pi pi-cog',
    to: '',
    children: [
      { label: t('nav.employees'), icon: 'pi pi-users', to: '/employees', feature: 'manage_employees' },
      // { label: t('nav.permissions'), icon: 'pi pi-shield', to: '/permissions', feature: 'manage_roles' },
      { label: t('nav.scoringModel'), icon: 'pi pi-sliders-h', to: '/scoring-model', feature: 'manage_scoring_model' },
      { label: t('nav.settings'), icon: 'pi pi-cog', to: '/settings', anyFeature: ['manage_settings', 'manage_scoring_model', 'view_app_versions', 'manage_faqs'] },
    ],
  },
])

function isVisible(entry: Gated): boolean {
  if (entry.superadmin) return auth.isSuperadmin
  if (entry.anyFeature) return entry.anyFeature.some((f) => auth.can(f))
  if (entry.feature) return auth.can(entry.feature)
  return true
}

// A section has no permission of its own: it exists only as far as its links do,
// so an admin who can reach none of them never learns the section is there.
const nav = computed<NavEntry[]>(() =>
  allNav.value.flatMap((entry) => {
    if (!entry.children.length) return isVisible(entry) ? [entry] : []
    const children = entry.children.filter(isVisible)
    return children.length ? [{ ...entry, children }] : []
  }),
)

const STORAGE_KEY = 'admin.sidebar.groups'

function loadExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

const expanded = ref<Record<string, boolean>>(loadExpanded())

watch(
  expanded,
  (value) => {
    // Private-mode Safari throws on setItem; a lost preference is not worth a crash.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      /* ignore */
    }
  },
  { deep: true },
)

function toggleGroup(key: string) {
  expanded.value[key] = !expanded.value[key]
}

/** Same prefix rule RouterLink uses for `active-class`, so header and link agree. */
function matchesRoute(to: string, path: string): boolean {
  if (to === '/') return path === '/'
  return path === to || path.startsWith(`${to}/`)
}

const activeGroupKey = computed<string | null>(() => {
  for (const entry of nav.value) {
    if (!entry.children.length) continue
    if (entry.children.some((child) => matchesRoute(child.to, route.path))) return entry.key
  }
  return null
})

// Landing on a deep link must not leave the admin staring at a collapsed section
// with no clue where they are. Only the section that owns the route is forced
// open; everything else keeps whatever the admin last chose.
watch(
  activeGroupKey,
  (key) => {
    if (key) expanded.value[key] = true
  },
  { immediate: true },
)

function groupBadge(entry: NavEntry): number {
  return entry.children.reduce((sum, child) => sum + (child.badge ?? 0), 0)
}

// --- Collapsed-rail flyout -------------------------------------------------
// `.nav` scrolls, so an absolutely positioned submenu would be clipped by it.
// The panel is teleported to <body> and placed from the trigger's screen rect.
const flyout = ref<{ key: string; top: number; left: number } | null>(null)
let closeTimer: ReturnType<typeof setTimeout> | undefined

const flyoutPanel = computed(() => {
  if (!props.collapsed || !flyout.value) return null
  const group = nav.value.find((entry) => entry.key === flyout.value?.key)
  if (!group || !group.children.length) return null
  return { group, top: flyout.value.top, left: flyout.value.left }
})

function openFlyout(target: EventTarget | null, entry: NavEntry) {
  if (!props.collapsed || !entry.children.length || !(target instanceof HTMLElement)) return
  clearTimeout(closeTimer)
  const rect = target.getBoundingClientRect()
  const height = 34 + entry.children.length * 38
  flyout.value = {
    key: entry.key,
    left: rect.right + 8,
    top: Math.max(8, Math.min(rect.top, window.innerHeight - height - 12)),
  }
}

function scheduleClose() {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => (flyout.value = null), 140)
}

function cancelClose() {
  clearTimeout(closeTimer)
}

function closeFlyout() {
  clearTimeout(closeTimer)
  flyout.value = null
}

function onGroupClick(event: MouseEvent, entry: NavEntry) {
  if (!props.collapsed) {
    toggleGroup(entry.key)
    return
  }
  if (flyout.value?.key === entry.key) closeFlyout()
  else openFlyout(event.currentTarget, entry)
}

watch(() => route.path, closeFlyout)
watch(() => props.collapsed, closeFlyout)
onUnmounted(() => clearTimeout(closeTimer))

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="sidebar"
    :class="{ collapsed: props.collapsed, 'mobile-open': props.mobileOpen, 'is-mobile': props.isMobile }">
    <div class="brand">
      <div v-if="!props.collapsed" class="brand-text">
        <span class="badge-label" style="padding: 20px ">{{ $t('nav.platformAdmin') }}</span>
      </div>
      <button class="collapse-btn" :title="$t('nav.toggleSidebar')" @click="emit('toggle')">
        <i :class="props.collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'" />
      </button>
    </div>

    <nav class="nav">
      <template v-for="entry in nav" :key="entry.key">
        <RouterLink v-if="!entry.children.length" :to="entry.to" class="nav-link" active-class="active"
          :exact-active-class="entry.to === '/' ? 'active' : ''" :title="entry.label">
          <i :class="entry.icon" />
          <span v-if="!props.collapsed" class="nav-label">{{ entry.label }}</span>
          <span v-if="entry.badge" class="nav-badge">{{ entry.badge }}</span>
        </RouterLink>

        <div v-else class="nav-group">
          <button type="button" class="nav-link group-header"
            :class="{ active: props.collapsed && activeGroupKey === entry.key, 'has-active': activeGroupKey === entry.key }"
            :aria-expanded="props.collapsed ? flyout?.key === entry.key : !!expanded[entry.key]"
            :aria-controls="`nav-group-${entry.key}`" :title="entry.label" @click="onGroupClick($event, entry)"
            @mouseenter="openFlyout($event.currentTarget, entry)" @mouseleave="scheduleClose()">
            <i :class="entry.icon" />
            <span v-if="!props.collapsed" class="nav-label">{{ entry.label }}</span>
            <!-- Money nobody has dealt with yet must survive the section being shut. -->
            <span v-if="groupBadge(entry) && (props.collapsed || !expanded[entry.key])" class="nav-badge">
              {{ groupBadge(entry) }}
            </span>
            <i v-if="!props.collapsed" class="pi pi-chevron-down chevron" :class="{ open: expanded[entry.key] }" />
          </button>

          <div :id="`nav-group-${entry.key}`" class="group-children-wrap"
            :class="{ open: !props.collapsed && expanded[entry.key] }">
            <div class="group-children">
              <RouterLink v-for="child in entry.children" :key="child.to" :to="child.to" class="nav-link child"
                active-class="active" :title="child.label">
                <i :class="child.icon" />
                <span class="nav-label">{{ child.label }}</span>
                <span v-if="child.badge" class="nav-badge">{{ child.badge }}</span>
              </RouterLink>
            </div>
          </div>
        </div>
      </template>
    </nav>

    <Teleport to="body">
      <div v-if="flyoutPanel" class="nav-flyout" :style="{ top: `${flyoutPanel.top}px`, left: `${flyoutPanel.left}px` }"
        @mouseenter="cancelClose()" @mouseleave="closeFlyout()">
        <div class="flyout-title">{{ flyoutPanel.group.label }}</div>
        <RouterLink v-for="child in flyoutPanel.group.children" :key="child.to" :to="child.to" class="nav-link child"
          active-class="active" @click="closeFlyout()">
          <i :class="child.icon" />
          <span class="nav-label">{{ child.label }}</span>
          <span v-if="child.badge" class="nav-badge">{{ child.badge }}</span>
        </RouterLink>
      </div>
    </Teleport>

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

/* Money nobody has dealt with yet. Sits on the danger colour deliberately — it
   is not a count of things to read, it is a count of clients owed money. */
.nav-badge {
  margin-left: auto;
  min-width: 20px;
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  background: var(--danger);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 800;
  text-align: center;
}

/* Collapsed the label is gone, so the chip rides the icon instead of a row end. */
.collapsed .nav-badge {
  position: absolute;
  transform: translate(0.7rem, -0.7rem);
  margin-left: 0;
}

.collapsed .nav-link {
  position: relative;
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

.nav-group {
  display: flex;
  flex-direction: column;
}

.group-header {
  width: 100%;
  border: 0;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.group-header .nav-label {
  margin-right: auto;
}

.group-header .nav-badge {
  margin-left: 0;
  margin-right: 0.35rem;
}

/* A shut section still has to say "you are in here" — the label alone cannot. */
.group-header.has-active i:first-child {
  color: var(--accent-2);
}

.chevron {
  font-size: 0.7rem !important;
  transition: transform 0.18s ease;
}

.chevron.open {
  transform: rotate(180deg);
}

/* grid 0fr→1fr animates to the children's natural height without measuring it. */
.group-children-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.2s ease;
}

.group-children-wrap.open {
  grid-template-rows: 1fr;
}

.group-children {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

/* Zero-height links stay tabbable without this — visibility takes them out. */
.group-children-wrap:not(.open) .group-children {
  visibility: hidden;
}

.group-children-wrap.open .group-children {
  margin: 0.15rem 0 0.25rem;
  padding-left: 0.6rem;
  margin-left: 1.15rem;
  border-left: 1px solid var(--border-subtle);
}

.nav-link.child {
  font-size: 0.82rem;
  padding: 0.45rem 0.65rem;
}

.nav-link.child i {
  font-size: 0.9rem;
}

/* Collapsed rail: the submenu escapes `.nav`'s scroll container via <Teleport>,
   so it is positioned in viewport coordinates by the trigger's rect. */
.nav-flyout {
  position: fixed;
  z-index: 60;
  min-width: 210px;
  padding: 0.35rem;
  border-radius: 11px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-sidebar);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.flyout-title {
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-secondary);
  padding: 0.3rem 0.65rem 0.4rem;
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
