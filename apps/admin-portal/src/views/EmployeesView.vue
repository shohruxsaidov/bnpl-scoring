<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useEmployeesStore } from '@/stores/employees'
import { apiFetch } from '@/utils/apiFetch'
import { formatDateTime } from '@/utils/money'
import type { AdminUser } from '@/types'

const employees = useEmployeesStore()
const confirm = useConfirm()
const toast = useToast()
const { t } = useI18n()

onMounted(() => employees.fetchAll())

// ── Create dialog ──────────────────────────────────────────────────────────
interface RoleOption { id: string; name: string }

const showCreate = ref(false)
const saving = ref(false)
const roles = ref<RoleOption[]>([])
const form = ref({ fullName: '', email: '', password: '', roleId: '' })
const errors = ref({ fullName: false, email: false, password: false, roleId: false })

async function openCreate() {
  form.value = { fullName: '', email: '', password: '', roleId: '' }
  errors.value = { fullName: false, email: false, password: false, roleId: false }
  if (roles.value.length === 0) {
    const res = await apiFetch<{ roles: RoleOption[] }>('/admin/permissions/roles?platform=admin')
    roles.value = res.roles.filter((r) => !(r as any).isSuperadmin)
  }
  showCreate.value = true
}

async function submitCreate() {
  const f = form.value
  errors.value = {
    fullName: !f.fullName.trim(),
    email: !f.email.trim(),
    password: f.password.length < 8,
    roleId: !f.roleId,
  }
  if (Object.values(errors.value).some(Boolean)) return

  saving.value = true
  try {
    await employees.createUser({
      fullName: f.fullName.trim(),
      email: f.email.trim(),
      password: f.password,
      roleId: f.roleId,
    })
    toast.add({ severity: 'success', summary: t('employees.created'), life: 2000 })
    showCreate.value = false
  } catch (e: any) {
    const code = e?.message ?? 'error'
    toast.add({
      severity: 'error',
      summary: code === 'email_taken' ? t('employees.emailTaken') : t('employees.createFailed'),
      life: 3000,
    })
  } finally {
    saving.value = false
  }
}

// ── Toggle / block ─────────────────────────────────────────────────────────
async function toggleActive(u: AdminUser) {
  await employees.setActive(u.id, !u.active)
  toast.add({
    severity: 'info',
    summary: u.active ? t('employees.employeeBlocked') : t('employees.employeeReactivated'),
    detail: u.fullName,
    life: 2000,
  })
}

function confirmBlock(u: AdminUser) {
  confirm.require({
    header: t('employees.blockEmployee'),
    message: t('employees.blockConfirm', { name: u.fullName }),
    icon: 'pi pi-ban',
    acceptLabel: t('employees.block'),
    rejectLabel: t('common.cancel'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      await employees.setActive(u.id, false)
      toast.add({
        severity: 'warn',
        summary: t('employees.employeeBlocked'),
        detail: u.fullName,
        life: 2500,
      })
    },
  })
}
</script>

<template>
  <div class="employees">
    <div class="toolbar surface-card">
      <span class="result-count muted">
        {{ $t('employees.summary', { count: employees.users.length, active: employees.activeCount }) }}
      </span>
      <button class="btn-gradient" @click="openCreate">
        <i class="pi pi-plus" /> {{ $t('employees.addAdmin') }}
      </button>
    </div>

    <div class="surface-card table-wrap">
      <DataTable
        :value="employees.users"
        :loading="employees.loading"
        data-key="id"
        paginator
        :rows="15"
        size="small"
      >
        <Column :header="$t('employees.name')" sortable field="fullName">
          <template #body="{ data }">
            <span class="e-name">{{ data.fullName }}</span>
            <span v-if="data.isSuperadmin" class="chip superadmin">Superadmin</span>
          </template>
        </Column>
        <Column :header="$t('employees.email')">
          <template #body="{ data }">
            <span class="font-mono muted">{{ data.email }}</span>
          </template>
        </Column>
        <Column :header="$t('employees.role')">
          <template #body="{ data }">
            <span v-if="data.roleName" class="chip role">{{ data.roleName }}</span>
            <span v-else class="muted">—</span>
          </template>
        </Column>
        <Column :header="$t('employees.createdAt')">
          <template #body="{ data }">
            <span class="font-mono muted">{{ formatDateTime(data.createdAt) }}</span>
          </template>
        </Column>
        <Column :header="$t('employees.active')">
          <template #body="{ data }">
            <ToggleSwitch
              :model-value="data.active"
              :disabled="data.isSuperadmin"
              @update:model-value="toggleActive(data)"
            />
          </template>
        </Column>
        <Column :header="$t('employees.actions')">
          <template #body="{ data }">
            <button
              class="icon-btn danger"
              :disabled="!data.active || data.isSuperadmin"
              :title="$t('employees.block')"
              @click="confirmBlock(data)"
            >
              <i class="pi pi-ban" />
            </button>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>

  <!-- Create admin dialog -->
  <Dialog
    v-model:visible="showCreate"
    :header="$t('employees.addAdmin')"
    modal
    :style="{ width: '420px' }"
  >
    <div class="form-body">
      <div class="field">
        <label class="field-label">{{ $t('employees.name') }}</label>
        <InputText
          v-model="form.fullName"
          :class="{ 'p-invalid': errors.fullName }"
          :placeholder="$t('employees.namePlaceholder')"
          class="w-full"
        />
        <small v-if="errors.fullName" class="error-msg">{{ $t('employees.fieldRequired') }}</small>
      </div>

      <div class="field">
        <label class="field-label">{{ $t('employees.email') }}</label>
        <InputText
          v-model="form.email"
          type="email"
          :class="{ 'p-invalid': errors.email }"
          placeholder="admin@company.com"
          class="w-full"
        />
        <small v-if="errors.email" class="error-msg">{{ $t('employees.fieldRequired') }}</small>
      </div>

      <div class="field">
        <label class="field-label">{{ $t('employees.password') }}</label>
        <InputText
          v-model="form.password"
          type="password"
          :class="{ 'p-invalid': errors.password }"
          :placeholder="$t('employees.passwordHint')"
          class="w-full"
        />
        <small v-if="errors.password" class="error-msg">{{ $t('employees.passwordMin') }}</small>
      </div>

      <div class="field">
        <label class="field-label">{{ $t('employees.role') }}</label>
        <Select
          v-model="form.roleId"
          :options="roles"
          option-label="name"
          option-value="id"
          :class="{ 'p-invalid': errors.roleId }"
          :placeholder="$t('employees.selectRole')"
          class="w-full"
        />
        <small v-if="errors.roleId" class="error-msg">{{ $t('employees.fieldRequired') }}</small>
      </div>
    </div>

    <template #footer>
      <button class="btn-ghost" @click="showCreate = false">{{ $t('common.cancel') }}</button>
      <button class="btn-gradient" :disabled="saving" @click="submitCreate">
        <i v-if="saving" class="pi pi-spin pi-spinner" />
        {{ $t('employees.create') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.employees {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.1rem;
}
.result-count {
  font-size: 0.82rem;
  font-weight: 600;
  margin-right: auto;
}
.table-wrap {
  padding: 0;
  overflow: hidden;
}
.e-name {
  font-weight: 700;
  font-size: 0.85rem;
  margin-right: 0.4rem;
}
.chip {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
}
.chip.role {
  color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 12%, transparent);
  border: none;
}
.chip.superadmin {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 12%, transparent);
  border: none;
}
.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 0.78rem;
  transition: all 0.12s ease;
}
.icon-btn.danger:hover:not(:disabled) {
  color: var(--danger);
  border-color: var(--danger);
}
.icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Dialog form */
.form-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.25rem 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.field-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}
.error-msg {
  color: var(--danger);
  font-size: 0.72rem;
}
.w-full {
  width: 100%;
}
</style>
