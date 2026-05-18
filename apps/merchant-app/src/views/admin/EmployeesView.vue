<script setup lang="ts">
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ToggleSwitch from 'primevue/toggleswitch'
import { useCatalogStore } from '@/stores/catalog'
import type { EmployeeRole } from '@/types'

const catalog = useCatalogStore()

function roleLabel(r: EmployeeRole): string {
  return r === 'merchant_admin' ? 'Merchant Admin' : 'Agent'
}
</script>

<template>
  <div class="admin-page">
    <div class="ap-head">
      <div>
        <h2>Employees</h2>
        <p>{{ catalog.employees.length }} staff members</p>
      </div>
    </div>

    <div class="surface-card table-wrap">
      <DataTable :value="catalog.employees" data-key="id">
        <Column header="Name" sortable field="fullName">
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
        <Column header="Phone">
          <template #body="{ data }">
            <span class="font-mono phone">{{ data.phone }}</span>
          </template>
        </Column>
        <Column header="Roles">
          <template #body="{ data }">
            <div class="roles">
              <span
                v-for="r in data.roles"
                :key="r"
                class="role-chip"
                :class="r"
              >
                {{ roleLabel(r) }}
              </span>
            </div>
          </template>
        </Column>
        <Column header="Active">
          <template #body="{ data }">
            <ToggleSwitch
              :model-value="data.active"
              @update:model-value="catalog.toggleEmployeeActive(data.id)"
            />
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 1.3rem;
}
.ap-head h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
}
.ap-head p {
  margin: 0.2rem 0 0;
  color: var(--text-secondary);
  font-size: 0.86rem;
}
.table-wrap {
  padding: 1.4rem;
}
.emp-cell {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.emp-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--gradient-accent);
  color: #fff;
  font-weight: 700;
  display: grid;
  place-items: center;
}
.emp-name {
  font-weight: 700;
  font-size: 0.9rem;
}
.emp-email {
  font-size: 0.74rem;
  color: var(--text-secondary);
}
.phone {
  font-size: 0.84rem;
  color: var(--text-secondary);
}
.roles {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.role-chip {
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
}
.role-chip.merchant_admin {
  background: var(--success-bg);
  color: var(--success);
}
.role-chip.agent {
  background: var(--warning-bg);
  color: var(--warning);
}
</style>
