<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import ToggleSwitch from 'primevue/toggleswitch'

const { t } = useI18n()
const toast = useToast()

type Role = 'agent' | 'branch_admin' | 'merchant_admin'
type Feature = 'view_deals_list' | 'create_deal' | 'view_admin_panel'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const ROLES: Role[] = ['agent', 'branch_admin', 'merchant_admin']
const FEATURES: Feature[] = ['view_deals_list', 'create_deal', 'view_admin_panel']

const matrix = ref<Record<Role, Record<Feature, boolean>>>({
  agent:          { view_deals_list: true,  create_deal: true,  view_admin_panel: false },
  branch_admin:   { view_deals_list: true,  create_deal: false, view_admin_panel: true  },
  merchant_admin: { view_deals_list: true,  create_deal: false, view_admin_panel: true  },
})

const loading = ref(true)
const saving = ref<string | null>(null)

async function fetchPermissions() {
  loading.value = true
  try {
    const res = await fetch(`${API}/admin/permissions`, { credentials: 'include' })
    if (!res.ok) return
    const body = await res.json()
    matrix.value = body.permissions
  } finally {
    loading.value = false
  }
}

async function toggle(role: Role, feature: Feature, allowed: boolean) {
  const key = `${role}:${feature}`
  saving.value = key
  try {
    const res = await fetch(`${API}/admin/permissions/${role}/${feature}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ allowed }),
    })
    if (!res.ok) throw new Error()
    matrix.value[role][feature] = allowed
    toast.add({ severity: 'success', summary: t('permissions.saved'), life: 1800 })
  } catch {
    toast.add({ severity: 'error', summary: t('common.error'), life: 2500 })
  } finally {
    saving.value = null
  }
}

onMounted(fetchPermissions)
</script>

<template>
  <div class="permissions-page">
    <div class="page-header surface-card">
      <div>
        <h2>{{ $t('permissions.title') }}</h2>
        <p>{{ $t('permissions.subtitle') }}</p>
      </div>
    </div>

    <div class="surface-card matrix-card">
      <div v-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner" />
      </div>

      <table v-else class="matrix-table">
        <thead>
          <tr>
            <th class="role-col">{{ $t('permissions.role') }}</th>
            <th v-for="feature in FEATURES" :key="feature" class="feature-col">
              <span class="feature-label">{{ $t(`permissions.features.${feature}`) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="role in ROLES" :key="role" class="role-row">
            <td class="role-cell">
              <span class="role-chip" :class="role">{{ $t(`permissions.roles.${role}`) }}</span>
            </td>
            <td v-for="feature in FEATURES" :key="feature" class="toggle-cell">
              <ToggleSwitch
                :model-value="matrix[role][feature]"
                :disabled="saving === `${role}:${feature}`"
                @update:model-value="(val) => toggle(role, feature, val)"
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

.role-col { width: 180px; padding-left: 0 !important; }

.feature-col { text-align: center; }

.feature-label {
  display: inline-block;
  max-width: 120px;
  text-align: center;
  line-height: 1.3;
}

.role-row td {
  padding: 1rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.role-row:last-child td {
  border-bottom: none;
}

.role-cell { padding-left: 0 !important; }

.toggle-cell { text-align: center; }

.role-chip {
  display: inline-block;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 800;
}

.role-chip.merchant_admin {
  background: var(--success-bg);
  color: var(--success);
}

.role-chip.branch_admin {
  background: color-mix(in srgb, var(--accent-1) 15%, transparent);
  color: var(--accent-1);
}

.role-chip.agent {
  background: var(--warning-bg);
  color: var(--warning);
}
</style>
