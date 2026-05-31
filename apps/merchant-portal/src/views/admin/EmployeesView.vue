<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import SkeletonTable from '@/components/SkeletonTable.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { useCatalogStore } from '@/stores/catalog'
import type { Employee, EmployeeRole } from '@/types'

const catalog = useCatalogStore()
const toast = useToast()
const { t } = useI18n()

const search = ref('')
const filteredEmployees = computed(() => {
  if (!search.value.trim()) return catalog.employees
  const q = search.value.toLowerCase()
  return catalog.employees.filter(
    (e) => e.fullName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q),
  )
})

onMounted(() => Promise.all([catalog.fetchEmployees(), catalog.fetchBranches()]))

const ROLE_OPTIONS: { label: string; value: EmployeeRole }[] = [
  { label: 'Agent', value: 'agent' },
  { label: 'Merchant Admin', value: 'merchant_admin' },
]

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const form = reactive({
  email: '',
  password: '',
  fullName: '',
  branchId: '',
  roles: [] as EmployeeRole[],
})

function openNew() {
  editingId.value = null
  form.email = ''
  form.password = ''
  form.fullName = ''
  form.branchId = catalog.branches[0]?.id ?? ''
  form.roles = ['agent']
  dialogVisible.value = true
}

function openEdit(e: Employee) {
  editingId.value = e.id
  form.email = e.email
  form.password = ''
  form.fullName = e.fullName
  form.branchId = e.branchId
  form.roles = e.roles as EmployeeRole[]
  dialogVisible.value = true
}

async function save() {
  if (!form.fullName || !form.branchId || form.roles.length === 0) {
    toast.add({ severity: 'warn', summary: t('employees.missingFields'), life: 2500 })
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await catalog.updateEmployee(editingId.value, { fullName: form.fullName, branchId: form.branchId, roles: form.roles })
      toast.add({ severity: 'success', summary: t('employees.updated'), detail: form.fullName, life: 2000 })
    } else {
      if (!form.email || form.password.length < 8) {
        toast.add({ severity: 'warn', summary: t('employees.missingFields'), life: 2500 })
        return
      }
      await catalog.addEmployee({ email: form.email, password: form.password, fullName: form.fullName, branchId: form.branchId, roles: form.roles })
      toast.add({ severity: 'success', summary: t('employees.added'), detail: form.fullName, life: 2000 })
    }
    dialogVisible.value = false
  } catch {
    toast.add({ severity: 'error', summary: t('common.error'), life: 2500 })
  } finally {
    saving.value = false
  }
}

async function toggleActive(e: Employee) {
  await catalog.toggleEmployeeActive(e.id)
}

function roleLabel(r: EmployeeRole): string {
  return r === 'merchant_admin' ? t('employees.merchantAdmin') : t('employees.agent')
}
</script>

<template>
  <div class="admin-page">
    <SkeletonTable v-if="catalog.loading" :rows="6" :cols="4" :has-actions="true" :has-header="true" />

    <template v-else>
      <div class="surface-card table-toolbar">
        <div class="tt-search">
          <i class="pi pi-search tt-icon" />
          <input v-model="search" class="tt-input" :placeholder="$t('employees.searchPlaceholder')" type="text" />
        </div>
        <span class="tt-count">{{ filteredEmployees.length }} {{ $t('employees.employeesCount') }}</span>
        <button class="btn-gradient" style="margin-left: auto" @click="openNew">
          <i class="pi pi-plus" /> {{ $t('employees.addEmployee') }}
        </button>
      </div>

      <div class="surface-card table-wrap">
        <DataTable :value="filteredEmployees" data-key="id" paginator :rows="10">
          <Column :header="$t('employees.name')" sortable field="fullName">
            <template #body="{ data }">
              <div class="emp-cell">
                <div class="emp-avatar">{{ data.fullName.charAt(0) }}</div>
                <div>
                  <div class="emp-name">{{ data.fullName }}</div>
                  <div class="emp-email">{{ data.email }}</div>
                </div>
              </div>
            </template>
          </Column>
          <Column :header="$t('employees.branch')" :style="{ width: '160px' }">
            <template #body="{ data }">
              <span class="branch-chip">{{ catalog.branchName(data.branchId) }}</span>
            </template>
          </Column>
          <Column :header="$t('employees.roles')" :style="{ width: '200px' }">
            <template #body="{ data }">
              <div class="roles">
                <span v-for="r in data.roles" :key="r" class="role-chip" :class="r">
                  {{ roleLabel(r) }}
                </span>
              </div>
            </template>
          </Column>
          <Column :header="$t('employees.active')" :style="{ width: '80px' }">
            <template #body="{ data }">
              <ToggleSwitch :model-value="data.active" @update:model-value="toggleActive(data)" />
            </template>
          </Column>
          <Column header="" :style="{ width: '60px' }">
            <template #body="{ data }">
              <button class="ra-btn" :title="$t('common.edit')" @click="openEdit(data)">
                <i class="pi pi-pencil" />
              </button>
            </template>
          </Column>
        </DataTable>
      </div>

      <Dialog
        v-model:visible="dialogVisible"
        modal
        :header="editingId ? $t('employees.editEmployee') : $t('employees.addEmployeeTitle')"
        :style="{ width: '460px' }"
      >
        <div class="form">
          <div class="field">
            <label class="field-label">{{ $t('employees.fullName') }}</label>
            <InputText v-model="form.fullName" :placeholder="$t('employees.fullNamePlaceholder')" />
          </div>
          <template v-if="!editingId">
            <div class="field">
              <label class="field-label">{{ $t('employees.email') }}</label>
              <InputText v-model="form.email" type="email" placeholder="agent@merchant.uz" />
            </div>
            <div class="field">
              <label class="field-label">{{ $t('employees.password') }}</label>
              <InputText v-model="form.password" type="password" :placeholder="$t('employees.passwordPlaceholder')" />
            </div>
          </template>
          <div class="field">
            <label class="field-label">{{ $t('employees.branch') }}</label>
            <Select
              v-model="form.branchId"
              :options="catalog.branches"
              option-label="name"
              option-value="id"
              :placeholder="$t('employees.selectBranch')"
            />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('employees.roles') }}</label>
            <MultiSelect
              v-model="form.roles"
              :options="ROLE_OPTIONS"
              option-label="label"
              option-value="value"
              :placeholder="$t('employees.selectRoles')"
            />
          </div>
        </div>
        <template #footer>
          <button class="btn-ghost" @click="dialogVisible = false">{{ $t('common.cancel') }}</button>
          <button class="btn-gradient" :disabled="saving" @click="save">{{ $t('common.save') }}</button>
        </template>
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.admin-page { display: flex; flex-direction: column; gap: 1.3rem; }
.page-actions { display: flex; justify-content: flex-end; }
.btn-gradient { display: inline-flex; align-items: center; gap: 0.5rem; }
.table-wrap { padding: 0; overflow: hidden; }
.emp-cell { display: flex; align-items: center; gap: 0.7rem; }
.emp-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--gradient-accent); color: #fff;
  font-weight: 700; display: grid; place-items: center; flex-shrink: 0;
}
.emp-name { font-weight: 700; font-size: 0.9rem; }
.emp-email { font-size: 0.74rem; color: var(--text-secondary); }
.branch-chip {
  background: var(--bg-surface); padding: 0.2rem 0.55rem;
  border-radius: 8px; font-size: 0.78rem; font-weight: 600;
}
.roles { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.role-chip { padding: 0.25rem 0.65rem; border-radius: 999px; font-size: 0.72rem; font-weight: 800; }
.role-chip.merchant_admin { background: var(--success-bg); color: var(--success); }
.role-chip.agent { background: var(--warning-bg); color: var(--warning); }
.ra-btn {
  width: 32px; height: 32px; border-radius: 8px;
  border: 1px solid var(--border-subtle); background: var(--bg-surface);
  color: var(--text-secondary); cursor: pointer; display: grid;
  place-items: center; transition: all 0.15s ease;
}
.ra-btn:hover { color: var(--accent-2); border-color: var(--accent-2); }
.form { display: flex; flex-direction: column; gap: 1rem; padding-top: 0.4rem; }
.form :deep(.p-select), .form :deep(.p-multiselect) { width: 100%; }
</style>
