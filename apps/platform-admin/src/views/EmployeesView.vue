<script setup lang="ts">
import { computed, ref } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useEmployeesStore } from '@/stores/employees'
import { useTenantsStore } from '@/stores/tenants'
import { formatDateTime } from '@/utils/money'
import type { Employee } from '@/types'

const employees = useEmployeesStore()
const tenants = useTenantsStore()
const confirm = useConfirm()
const toast = useToast()

const tenantFilter = ref<string | null>(null)

const tenantOptions = computed(() => [
  { label: 'All tenants', value: null },
  ...tenants.options,
])

const filtered = computed<Employee[]>(() =>
  employees.employees.filter((e) => !tenantFilter.value || e.tenantId === tenantFilter.value),
)

function tenantName(id: string): string {
  return tenants.byId(id)?.name ?? '—'
}

function toggleActive(e: Employee) {
  employees.toggleActive(e.id)
  toast.add({
    severity: 'info',
    summary: e.active ? 'Employee blocked' : 'Employee re-activated',
    detail: e.fullName,
    life: 2000,
  })
}

function confirmBlock(e: Employee) {
  confirm.require({
    header: 'Block employee',
    message: `Block "${e.fullName}"? They will no longer be able to sign in.`,
    icon: 'pi pi-ban',
    acceptLabel: 'Block',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    accept: () => {
      employees.block(e.id)
      toast.add({
        severity: 'warn',
        summary: 'Employee blocked',
        detail: e.fullName,
        life: 2500,
      })
    },
  })
}
</script>

<template>
  <div class="employees">
    <div class="filters surface-card">
      <div class="filter">
        <span class="filter-label">Tenant</span>
        <Select
          v-model="tenantFilter"
          :options="tenantOptions"
          option-label="label"
          option-value="value"
          placeholder="All tenants"
        />
      </div>
      <span class="result-count muted">
        {{ filtered.length }} employees · {{ employees.activeCount }} active platform-wide
      </span>
    </div>

    <div class="surface-card table-wrap">
      <DataTable
        :value="filtered"
        data-key="id"
        paginator
        :rows="12"
        size="small"
      >
        <Column header="Name" sortable field="fullName">
          <template #body="{ data }">
            <span class="e-name">{{ data.fullName }}</span>
          </template>
        </Column>
        <Column header="Phone">
          <template #body="{ data }">
            <span class="font-mono muted">{{ data.phone }}</span>
          </template>
        </Column>
        <Column header="Email">
          <template #body="{ data }">
            <span class="font-mono muted">{{ data.email }}</span>
          </template>
        </Column>
        <Column header="Tenant">
          <template #body="{ data }">
            <span class="chip">{{ tenantName(data.tenantId) }}</span>
          </template>
        </Column>
        <Column header="Roles">
          <template #body="{ data }">
            <span v-for="r in data.roles" :key="r" class="chip role">
              {{ r === 'merchant_admin' ? 'Admin' : 'Agent' }}
            </span>
          </template>
        </Column>
        <Column header="Last login">
          <template #body="{ data }">
            <span class="font-mono muted">{{ formatDateTime(data.lastLogin) }}</span>
          </template>
        </Column>
        <Column header="Active">
          <template #body="{ data }">
            <ToggleSwitch
              :model-value="data.active"
              @update:model-value="toggleActive(data)"
            />
          </template>
        </Column>
        <Column header="Actions">
          <template #body="{ data }">
            <button
              class="icon-btn danger"
              :disabled="!data.active"
              title="Block"
              @click="confirmBlock(data)"
            >
              <i class="pi pi-ban" />
            </button>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.employees {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.filters {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  padding: 0.9rem 1.1rem;
}
.filter {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 240px;
}
.filter-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}
.result-count {
  margin-left: auto;
  font-size: 0.82rem;
  font-weight: 600;
  padding-bottom: 0.5rem;
}
.table-wrap {
  padding: 0;
  overflow: hidden;
}
.e-name {
  font-weight: 700;
  font-size: 0.85rem;
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
  margin-right: 0.3rem;
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
</style>
