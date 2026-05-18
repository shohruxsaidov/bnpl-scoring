<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { useTenantsStore } from '@/stores/tenants'
import MonoAmount from '@/components/MonoAmount.vue'
import { formatDate } from '@/utils/money'
import type { Tenant } from '@/types'

const tenants = useTenantsStore()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()

const showAdd = ref(false)

const schema = toTypedSchema(
  z.object({
    name: z.string().min(2, 'Name is required'),
    slug: z
      .string()
      .min(2, 'Slug is required')
      .regex(/^[a-z0-9-]+$/, 'Lowercase letters, digits and dashes only'),
    contactEmail: z.string().min(1, 'Email is required').email('Invalid email'),
  }),
)

const { handleSubmit, errors, defineField, resetForm } = useForm({
  validationSchema: schema,
  initialValues: { name: '', slug: '', contactEmail: '' },
})

const [name, nameAttrs] = defineField('name')
const [slug, slugAttrs] = defineField('slug')
const [contactEmail, contactEmailAttrs] = defineField('contactEmail')

const submitAdd = handleSubmit((values) => {
  tenants.add(values)
  toast.add({
    severity: 'success',
    summary: 'Tenant created',
    detail: `${values.name} added`,
    life: 2500,
  })
  showAdd.value = false
  resetForm()
})

function openAdd() {
  resetForm()
  showAdd.value = true
}

function toggleStatus(t: Tenant) {
  tenants.toggleStatus(t.id)
  toast.add({
    severity: 'info',
    summary: t.status === 'active' ? 'Tenant suspended' : 'Tenant activated',
    detail: t.name,
    life: 2000,
  })
}

function confirmDelete(t: Tenant) {
  confirm.require({
    header: 'Delete tenant',
    message: `Permanently delete "${t.name}"? This cannot be undone.`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    accept: () => {
      tenants.remove(t.id)
      toast.add({
        severity: 'warn',
        summary: 'Tenant deleted',
        detail: t.name,
        life: 2500,
      })
    },
  })
}
</script>

<template>
  <div class="tenants">
    <div class="head">
      <p class="muted count">{{ tenants.total }} tenants · {{ tenants.activeCount }} active</p>
      <button class="btn-gradient" @click="openAdd">
        <i class="pi pi-plus" /> Add Tenant
      </button>
    </div>

    <div class="surface-card table-wrap">
      <DataTable
        :value="tenants.tenants"
        data-key="id"
        paginator
        :rows="10"
        size="small"
      >
        <Column header="Name" sortable field="name">
          <template #body="{ data }">
            <span class="t-name">{{ data.name }}</span>
          </template>
        </Column>
        <Column header="Slug">
          <template #body="{ data }">
            <span class="font-mono muted">{{ data.slug }}</span>
          </template>
        </Column>
        <Column header="Active">
          <template #body="{ data }">
            <ToggleSwitch
              :model-value="data.status === 'active'"
              @update:model-value="toggleStatus(data)"
            />
          </template>
        </Column>
        <Column header="Deals" sortable field="dealCount">
          <template #body="{ data }">
            <span class="font-mono">{{ data.dealCount }}</span>
          </template>
        </Column>
        <Column header="Employees" sortable field="employeeCount">
          <template #body="{ data }">
            <span class="font-mono">{{ data.employeeCount }}</span>
          </template>
        </Column>
        <Column header="Volume" sortable field="volume">
          <template #body="{ data }">
            <MonoAmount :value="data.volume" size="sm" />
          </template>
        </Column>
        <Column header="Created">
          <template #body="{ data }">
            <span class="font-mono muted">{{ formatDate(data.createdAt) }}</span>
          </template>
        </Column>
        <Column header="Actions">
          <template #body="{ data }">
            <div class="actions">
              <button
                class="icon-btn"
                title="View"
                @click="router.push(`/tenants/${data.id}`)"
              >
                <i class="pi pi-eye" />
              </button>
              <button
                class="icon-btn"
                :title="data.status === 'active' ? 'Suspend' : 'Activate'"
                @click="toggleStatus(data)"
              >
                <i :class="data.status === 'active' ? 'pi pi-ban' : 'pi pi-check'" />
              </button>
              <button class="icon-btn danger" title="Delete" @click="confirmDelete(data)">
                <i class="pi pi-trash" />
              </button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog
      v-model:visible="showAdd"
      modal
      header="Add Tenant"
      :style="{ width: '440px' }"
    >
      <form id="add-tenant-form" @submit="submitAdd">
        <div class="field">
          <label class="field-label" for="t-name">Business name</label>
          <InputText
            id="t-name"
            v-model="name"
            v-bind="nameAttrs"
            placeholder="TechShop Tashkent"
            :invalid="!!errors.name"
          />
          <span v-if="errors.name" class="field-error">{{ errors.name }}</span>
        </div>
        <div class="field">
          <label class="field-label" for="t-slug">Slug</label>
          <InputText
            id="t-slug"
            v-model="slug"
            v-bind="slugAttrs"
            placeholder="techshop"
            :invalid="!!errors.slug"
          />
          <span v-if="errors.slug" class="field-error">{{ errors.slug }}</span>
        </div>
        <div class="field">
          <label class="field-label" for="t-email">Contact email</label>
          <InputText
            id="t-email"
            v-model="contactEmail"
            v-bind="contactEmailAttrs"
            placeholder="ceo@techshop.uz"
            :invalid="!!errors.contactEmail"
          />
          <span v-if="errors.contactEmail" class="field-error">{{ errors.contactEmail }}</span>
        </div>
      </form>
      <template #footer>
        <button class="btn-ghost" @click="showAdd = false">Cancel</button>
        <button type="submit" form="add-tenant-form" class="btn-gradient">
          Create tenant
        </button>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.tenants {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.count {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 600;
}
.table-wrap {
  padding: 0;
  overflow: hidden;
}
.t-name {
  font-weight: 700;
  font-size: 0.86rem;
}
.actions {
  display: flex;
  gap: 0.35rem;
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
.icon-btn:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}
.icon-btn.danger:hover {
  color: var(--danger);
  border-color: var(--danger);
}
.field {
  margin-bottom: 1rem;
}
</style>
