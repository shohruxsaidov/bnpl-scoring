<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import ToggleSwitch from 'primevue/toggleswitch'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

const { t } = useI18n()
const toast = useToast()

type Platform = 'merchant' | 'admin'

interface Role {
  id: string
  key: string
  name: string
  platform: string
  isSuperadmin: boolean
  isSystem: boolean
  features: string[]
}

// A module groups its flat Features under a localized, icon-tagged row. Each
// Feature renders as its own labelled switcher chip (label derived from the
// action prefix), and the chips wrap. Features not referenced by any module
// fall into an auto "Other" row so a newly added Feature is never silently
// hidden.
interface ModuleDef {
  key: string
  icon: string
  features: string[]
}
interface ModuleRow extends ModuleDef {
  label: string
  isOther: boolean
}

const MODULE_CONFIG: Record<Platform, ModuleDef[]> = {
  merchant: [
    { key: 'dashboard', icon: 'chart-bar', features: ['view_dashboard'] },
    { key: 'deals', icon: 'file-edit', features: ['view_deals', 'create_deal'] },
    { key: 'products', icon: 'box', features: ['view_products', 'manage_products'] },
    { key: 'categories', icon: 'tags', features: ['manage_categories'] },
    { key: 'tariffs', icon: 'percentage', features: ['manage_tariffs'] },
    { key: 'branches', icon: 'building', features: ['manage_branches'] },
    { key: 'employees', icon: 'users', features: ['manage_employees'] },
    { key: 'collection', icon: 'exclamation-triangle', features: ['view_collection_board'] },
  ],
  admin: [
    { key: 'overview', icon: 'chart-bar', features: ['view_overview'] },
    { key: 'clients', icon: 'users', features: ['view_clients', 'send_client_push'] },
    { key: 'appRatings', icon: 'star', features: ['view_app_ratings'] },
    { key: 'banners', icon: 'images', features: ['manage_banners'] },
    { key: 'merchants', icon: 'building', features: ['view_merchants', 'manage_merchants', 'onboard_merchants'] },
    { key: 'deals', icon: 'file-edit', features: ['view_deals', 'create_deal_receipt'] },
    { key: 'employees', icon: 'users', features: ['manage_employees'] },
    { key: 'tariffs', icon: 'percentage', features: ['view_tariffs', 'manage_tariffs'] },
    { key: 'products', icon: 'box', features: ['manage_products'] },
    { key: 'categories', icon: 'tags', features: ['manage_categories'] },
    { key: 'blacklist', icon: 'ban', features: ['manage_blacklist'] },
    { key: 'collection', icon: 'exclamation-triangle', features: ['view_collection_board'] },
    { key: 'payments', icon: 'credit-card', features: ['view_payments', 'manage_payments'] },
    { key: 'buyout', icon: 'wallet', features: ['manage_buyout'] },
    { key: 'integrationLogs', icon: 'history', features: ['view_integration_logs'] },
    { key: 'settings', icon: 'cog', features: ['manage_settings'] },
    { key: 'roles', icon: 'shield', features: ['manage_roles'] },
    { key: 'admins', icon: 'user-edit', features: ['manage_admins'] },
  ],
}

// Maps a Feature key to its action label by prefix (view_/create_/manage_/send_).
function actionLabel(feature: string): string {
  const prefix = feature.split('_')[0]
  const key = { view: 'actView', create: 'actCreate', manage: 'actManage', send: 'actSend' }[prefix]
  return key ? t(`permissions.${key}`) : humanize(feature)
}

// Deterministic per-role icon tile — derived from the key, no schema column.
const PALETTE = ['#7b68ee', '#9d4edd', '#00d4aa', '#ffb02e', '#ff5c5c', '#4e9cff', '#c77dff', '#14b8a6']
const ROLE_ICONS: Record<string, string> = {
  superadmin: 'shield',
  admin: 'shield',
  agent: 'user',
  merchant_admin: 'briefcase',
  operator: 'headphones',
  accountant: 'calculator',
  sales_manager: 'chart-line',
}
function hashKey(k: string): number {
  let h = 0
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}
function colorFor(key: string): string {
  return PALETTE[hashKey(key) % PALETTE.length]
}
function iconFor(key: string): string {
  return ROLE_ICONS[key] ?? 'shield'
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const platform = ref<Platform>('merchant')
const catalog = ref<Record<Platform, string[]>>({ merchant: [], admin: [] })
const roles = ref<Role[]>([])
const loading = ref(true)
const saving = ref<string | null>(null)
const expanded = ref<Set<string>>(new Set())

const showCreate = ref(false)
const newKey = ref('')
const newName = ref('')
const creating = ref(false)

// Turns a Feature key like 'manage_employees' into 'Manage employees'.
function humanize(key: string): string {
  const s = key.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const modules = computed<ModuleRow[]>(() => {
  const cfg = MODULE_CONFIG[platform.value] ?? []
  const mapped = new Set<string>()
  const rows: ModuleRow[] = cfg.map((m) => {
    for (const f of m.features) mapped.add(f)
    return { ...m, label: t(`permissions.mod.${m.key}`), isOther: false }
  })
  for (const f of catalog.value[platform.value] ?? []) {
    if (mapped.has(f)) continue
    rows.push({ key: f, icon: 'circle', features: [f], label: humanize(f), isOther: true })
  }
  return rows
})

function roleHas(role: Role, feature: string): boolean {
  return role.isSuperadmin || role.features.includes(feature)
}

function featureCount(role: Role): number {
  return role.isSuperadmin ? (catalog.value[role.platform as Platform]?.length ?? 0) : role.features.length
}

function toggleExpand(id: string) {
  const next = new Set(expanded.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expanded.value = next
}

async function fetchCatalog() {
  const res = await fetch(`${API}/admin/permissions/catalog`, { credentials: 'include' })
  if (res.ok) catalog.value = (await res.json()).catalog
}

async function fetchRoles() {
  loading.value = true
  try {
    const res = await fetch(`${API}/admin/permissions/roles?platform=${platform.value}`, {
      credentials: 'include',
    })
    if (res.ok) roles.value = (await res.json()).roles
  } finally {
    loading.value = false
  }
}

async function selectPlatform(p: Platform) {
  if (platform.value === p) return
  platform.value = p
  expanded.value = new Set()
  await fetchRoles()
}

// Optimistic write of the role's whole Feature array, with rollback on failure.
async function persist(role: Role, next: string[], key: string) {
  saving.value = key
  const prev = role.features
  role.features = next
  try {
    const res = await fetch(`${API}/admin/permissions/roles/${role.id}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ features: next }),
    })
    if (!res.ok) throw new Error()
    toast.add({ severity: 'success', summary: t('permissions.saved'), life: 1200 })
  } catch {
    role.features = prev
    toast.add({ severity: 'error', summary: t('common.error'), life: 2500 })
  } finally {
    saving.value = null
  }
}

function toggleFeature(role: Role, feature: string, allowed: boolean) {
  if (role.isSuperadmin) return
  const next = allowed
    ? [...new Set([...role.features, feature])]
    : role.features.filter((f) => f !== feature)
  persist(role, next, `${role.id}:${feature}`)
}

async function createRole() {
  if (!newKey.value || !newName.value) return
  creating.value = true
  try {
    const res = await fetch(`${API}/admin/permissions/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ platform: platform.value, key: newKey.value, name: newName.value }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.code ?? 'error')
    }
    newKey.value = ''
    newName.value = ''
    showCreate.value = false
    await fetchRoles()
    toast.add({ severity: 'success', summary: t('permissions.roleCreated'), life: 1800 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: e.message ?? t('common.error'), life: 2500 })
  } finally {
    creating.value = false
  }
}

async function deleteRole(role: Role) {
  if (role.isSystem || role.isSuperadmin) return
  const res = await fetch(`${API}/admin/permissions/roles/${role.id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (res.ok) {
    roles.value = roles.value.filter((r) => r.id !== role.id)
    toast.add({ severity: 'success', summary: t('permissions.roleDeleted'), life: 1800 })
  } else {
    const body = await res.json().catch(() => ({}))
    toast.add({ severity: 'error', summary: body.code ?? t('common.error'), life: 2500 })
  }
}

onMounted(async () => {
  await fetchCatalog()
  await fetchRoles()
})
</script>

<template>
  <div class="permissions-page">
    <div class="page-header surface-card">
      <div>
        <h2>{{ $t('permissions.title') }}</h2>
        <p>{{ $t('permissions.subtitle') }}</p>
      </div>
      <div class="platform-tabs">
        <button :class="{ active: platform === 'merchant' }" @click="selectPlatform('merchant')">
          {{ $t('permissions.platformMerchant') }}
        </button>
        <button :class="{ active: platform === 'admin' }" @click="selectPlatform('admin')">
          {{ $t('permissions.platformAdmin') }}
        </button>
      </div>
    </div>

    <div class="toolbar">
      <span class="count-badge">{{ $t('permissions.rolesCount', { n: roles.length }) }}</span>
      <button class="btn-create" @click="showCreate = true">
        <i class="pi pi-plus" /> {{ $t('permissions.newRole') }}
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner" />
    </div>

    <div v-else class="roles-grid">
      <div v-for="role in roles" :key="role.id" class="role-card surface-card"
        :class="{ expanded: expanded.has(role.id) }">
        <div class="role-card__head">
          <div class="role-icon" :style="{ background: colorFor(role.key) }">
            <i :class="`pi pi-${iconFor(role.key)}`" />
          </div>
          <div class="role-meta">
            <div class="role-name-row">
              <span class="role-name">{{ role.name }}</span>
              <span v-if="role.isSystem" class="sys-badge">{{ $t('permissions.system') }}</span>
            </div>
            <div class="role-key">{{ role.key }}</div>
          </div>
          <button v-if="!role.isSystem && !role.isSuperadmin" class="del-btn" :title="$t('permissions.deleteRole')"
            @click="deleteRole(role)">
            <i class="pi pi-trash" />
          </button>
        </div>

        <div class="role-count">
          <i class="pi pi-key" />
          {{ $t('permissions.permCount', { n: featureCount(role) }) }}
        </div>

        <button class="matrix-toggle" @click="toggleExpand(role.id)">
          <i class="pi" :class="expanded.has(role.id) ? 'pi-chevron-up' : 'pi-chevron-down'" />
          {{ $t('permissions.permissionMatrix') }}
        </button>

        <div v-if="expanded.has(role.id)" class="matrix">
          <div v-for="m in modules" :key="m.key" class="matrix-row">
            <span class="mod-name">
              <i :class="`pi pi-${m.icon}`" />
              {{ m.label }}
            </span>
            <div class="actions">
              <div v-for="f in m.features" :key="f" class="action-chip">
                <span class="action-label">{{ actionLabel(f) }}</span>
                <ToggleSwitch :model-value="roleHas(role, f)"
                  :disabled="role.isSuperadmin || saving === `${role.id}:${f}`"
                  @update:model-value="(v: boolean) => toggleFeature(role, f, v)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Dialog v-model:visible="showCreate" modal :header="$t('permissions.newRole')" :style="{ width: '420px' }">
      <form id="create-role-form" @submit.prevent="createRole">
        <div class="field">
          <label class="field-label" for="r-key">{{ $t('permissions.newRoleKey') }}</label>
          <InputText id="r-key" v-model="newKey" placeholder="cashier" />
        </div>
        <div class="field">
          <label class="field-label" for="r-name">{{ $t('permissions.newRoleName') }}</label>
          <InputText id="r-name" v-model="newName" placeholder="Cashier" />
        </div>
      </form>
      <template #footer>
        <button class="btn-ghost" @click="showCreate = false">{{ $t('common.cancel') }}</button>
        <button type="submit" form="create-role-form" class="btn-create" :disabled="creating || !newKey || !newName">
          {{ $t('permissions.create') }}
        </button>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.permissions-page {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.page-header {
  padding: 1.2rem 1.4rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.page-header h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
}

.page-header p {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* Platform switcher — theme-token driven so it adapts to light/dark. */
.platform-tabs {
  display: inline-flex;
  background: var(--bg-deep);
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  padding: 0.25rem;
}

.platform-tabs button {
  border: none;
  background: transparent;
  padding: 0.45rem 1.1rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color var(--t-fast, 120ms) ease, background var(--t-fast, 120ms) ease;
}

.platform-tabs button:hover:not(.active) {
  color: var(--text-primary);
}

.platform-tabs button.active {
  background: var(--bg-surface);
  color: var(--text-primary);
  box-shadow: var(--sh-sm);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.count-badge {
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  background: var(--bg-input);
  border: 1px solid var(--border-subtle);
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.btn-create {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1rem;
  border: none;
  border-radius: 8px;
  background: var(--accent-1);
  color: #fff;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-create:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-ghost {
  padding: 0.55rem 1rem;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
  color: var(--text-secondary);
  font-size: 1.5rem;
}

.roles-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.role-card {
  padding: 1.1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.role-card__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.role-icon {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 1.05rem;
  flex-shrink: 0;
}

.role-meta {
  flex: 1;
  min-width: 0;
}

.role-name-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.role-name {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary);
}

.sys-badge {
  padding: 0.1rem 0.45rem;
  border-radius: 6px;
  background: var(--warning-bg);
  color: var(--warning);
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.role-key {
  font-size: 0.78rem;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}

.del-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.35rem;
  border-radius: 6px;
}

.del-btn:hover {
  color: var(--danger);
  background: var(--danger-bg);
}

.role-count {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.matrix-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: none;
  background: transparent;
  color: var(--text-accent);
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0;
  align-self: flex-start;
}

.matrix {
  border-top: 1px solid var(--border-subtle);
  padding-top: 0.5rem;
}

.matrix-row {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-subtle);
}

.matrix-row:last-child {
  border-bottom: none;
}

.mod-name {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  width: 200px;
  flex-shrink: 0;
  padding-top: 0.9rem;
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--text-primary);
}

.mod-name i {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 0.85rem;
}

.action-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-input);
  min-width: 92px;
}

.action-label {
  font-size: 0.66rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  text-align: center;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.9rem;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.field :deep(.p-inputtext) {
  width: 100%;
}
</style>
