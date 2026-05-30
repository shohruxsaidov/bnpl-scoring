<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import ToggleSwitch from 'primevue/toggleswitch'

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

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const platform = ref<Platform>('merchant')
const catalog = ref<Record<Platform, string[]>>({ merchant: [], admin: [] })
const roles = ref<Role[]>([])
const loading = ref(true)
const saving = ref<string | null>(null)

const newKey = ref('')
const newName = ref('')
const creating = ref(false)

const features = computed<string[]>(() => catalog.value[platform.value] ?? [])

// Turns a Feature key like 'manage_employees' into 'Manage employees'.
function humanize(key: string): string {
  const s = key.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function roleHas(role: Role, feature: string): boolean {
  return role.isSuperadmin || role.features.includes(feature)
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
  await fetchRoles()
}

async function toggle(role: Role, feature: string, allowed: boolean) {
  if (role.isSuperadmin) return
  const next = allowed
    ? [...new Set([...role.features, feature])]
    : role.features.filter((f) => f !== feature)
  const key = `${role.id}:${feature}`
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
    toast.add({ severity: 'success', summary: t('permissions.saved'), life: 1500 })
  } catch {
    role.features = prev
    toast.add({ severity: 'error', summary: t('common.error'), life: 2500 })
  } finally {
    saving.value = null
  }
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

    <div class="surface-card create-card">
      <input v-model="newKey" class="role-input" :placeholder="$t('permissions.newRoleKey')" />
      <input v-model="newName" class="role-input" :placeholder="$t('permissions.newRoleName')" />
      <button class="btn-create" :disabled="creating || !newKey || !newName" @click="createRole">
        <i class="pi pi-plus" /> {{ $t('permissions.addRole') }}
      </button>
    </div>

    <div class="surface-card matrix-card">
      <div v-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner" />
      </div>

      <table v-else class="matrix-table">
        <thead>
          <tr>
            <th class="feature-col">{{ $t('permissions.feature') }}</th>
            <th v-for="role in roles" :key="role.id" class="role-col">
              <div class="role-head">
                <span class="role-chip" :class="{ super: role.isSuperadmin }">{{ role.name }}</span>
                <button
                  v-if="!role.isSystem && !role.isSuperadmin"
                  class="del-btn"
                  :title="$t('permissions.deleteRole')"
                  @click="deleteRole(role)"
                >
                  <i class="pi pi-trash" />
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="feature in features" :key="feature" class="feature-row">
            <td class="feature-cell">{{ humanize(feature) }}</td>
            <td v-for="role in roles" :key="role.id" class="toggle-cell">
              <ToggleSwitch
                :model-value="roleHas(role, feature)"
                :disabled="role.isSuperadmin || saving === `${role.id}:${feature}`"
                @update:model-value="(val: boolean) => toggle(role, feature, val)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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
  font-size: 0.83rem;
  color: var(--text-secondary);
}

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

.create-card {
  padding: 1rem 1.4rem;
  display: flex;
  gap: 0.7rem;
  align-items: center;
  flex-wrap: wrap;
}

.role-input {
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--border-subtle, #e2e2e6);
  border-radius: 8px;
  font-size: 0.85rem;
  min-width: 180px;
}

.btn-create {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1rem;
  border: none;
  border-radius: 8px;
  background: var(--accent-1, #4f46e5);
  color: #fff;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-create:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.matrix-card {
  padding: 1.4rem;
  overflow-x: auto;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
  color: var(--text-secondary);
  font-size: 1.5rem;
}

.matrix-table {
  width: 100%;
  border-collapse: collapse;
}

.matrix-table th {
  text-align: left;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  padding: 0 1rem 0.9rem;
  border-bottom: 1px solid var(--border-subtle);
}

.feature-col { min-width: 200px; padding-left: 0 !important; }

.role-col { text-align: center; }

.role-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

.feature-row td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.feature-row:last-child td { border-bottom: none; }

.feature-cell {
  padding-left: 0 !important;
  font-size: 0.85rem;
  font-weight: 600;
}

.toggle-cell { text-align: center; }

.role-chip {
  display: inline-block;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  background: color-mix(in srgb, var(--accent-1) 14%, transparent);
  color: var(--accent-1);
}

.role-chip.super {
  background: var(--success-bg);
  color: var(--success);
}

.del-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 6px;
}

.del-btn:hover { color: var(--danger, #dc2626); }
</style>
