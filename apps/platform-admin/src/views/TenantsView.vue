<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()

const showAdd = ref(false)

const schema = toTypedSchema(
  z.object({
    name: z.string().min(2, t('tenants.nameRequired')),
    slug: z
      .string()
      .min(2, t('tenants.slugRequired'))
      .regex(/^[a-z0-9-]+$/, t('tenants.slugFormat')),
    contactEmail: z.string().min(1, t('tenants.emailRequired')).email(t('tenants.emailInvalid')),
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
    summary: t('tenants.tenantCreated'),
    detail: t('tenants.tenantAdded', { name: values.name }),
    life: 2500,
  })
  showAdd.value = false
  resetForm()
})

function openAdd() {
  resetForm()
  showAdd.value = true
}

function toggleStatus(tenant: Tenant) {
  tenants.toggleStatus(tenant.id)
  toast.add({
    severity: 'info',
    summary: tenant.status === 'active' ? t('tenants.tenantSuspended') : t('tenants.tenantActivated'),
    detail: tenant.name,
    life: 2000,
  })
}

function confirmDelete(tenant: Tenant) {
  confirm.require({
    header: t('tenants.deleteTenant'),
    message: t('tenants.deleteConfirm', { name: tenant.name }),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('common.delete'),
    rejectLabel: t('common.cancel'),
    acceptClass: 'p-button-danger',
    accept: () => {
      tenants.remove(tenant.id)
      toast.add({
        severity: 'warn',
        summary: t('tenants.tenantDeleted'),
        detail: tenant.name,
        life: 2500,
      })
    },
  })
}
</script>

<template>
  <div class="tenants">
    <div class="head">
      <p class="muted count">{{ $t('tenants.summary', { total: tenants.total, active: tenants.activeCount }) }}</p>
      <button class="btn-gradient" @click="openAdd">
        <i class="pi pi-plus" /> {{ $t('tenants.addTenant') }}
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
        <Column :header="$t('tenants.name')" sortable field="name">
          <template #body="{ data }">
            <span class="t-name">{{ data.name }}</span>
          </template>
        </Column>
        <Column :header="$t('tenants.slug')">
          <template #body="{ data }">
            <span class="font-mono muted">{{ data.slug }}</span>
          </template>
        </Column>
        <Column :header="$t('tenants.active')">
          <template #body="{ data }">
            <ToggleSwitch
              :model-value="data.status === 'active'"
              @update:model-value="toggleStatus(data)"
            />
          </template>
        </Column>
        <Column :header="$t('tenants.deals')" sortable field="dealCount">
          <template #body="{ data }">
            <span class="font-mono">{{ data.dealCount }}</span>
          </template>
        </Column>
        <Column :header="$t('tenants.employees')" sortable field="employeeCount">
          <template #body="{ data }">
            <span class="font-mono">{{ data.employeeCount }}</span>
          </template>
        </Column>
        <Column :header="$t('tenants.volume')" sortable field="volume">
          <template #body="{ data }">
            <MonoAmount :value="data.volume" size="sm" />
          </template>
        </Column>
        <Column :header="$t('tenants.created')">
          <template #body="{ data }">
            <span class="font-mono muted">{{ formatDate(data.createdAt) }}</span>
          </template>
        </Column>
        <Column :header="$t('tenants.actions')">
          <template #body="{ data }">
            <div class="actions">
              <button
                class="icon-btn"
                :title="$t('tenants.view')"
                @click="router.push(`/tenants/${data.id}`)"
              >
                <i class="pi pi-eye" />
              </button>
              <button
                class="icon-btn"
                :title="data.status === 'active' ? $t('tenants.suspend') : $t('tenants.activate')"
                @click="toggleStatus(data)"
              >
                <i :class="data.status === 'active' ? 'pi pi-ban' : 'pi pi-check'" />
              </button>
              <button class="icon-btn danger" :title="$t('tenants.delete')" @click="confirmDelete(data)">
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
      :header="$t('tenants.addTenantTitle')"
      :style="{ width: '440px' }"
    >
      <form id="add-tenant-form" @submit="submitAdd">
        <div class="field">
          <label class="field-label" for="t-name">{{ $t('tenants.businessName') }}</label>
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
          <label class="field-label" for="t-slug">{{ $t('tenants.slugLabel') }}</label>
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
          <label class="field-label" for="t-email">{{ $t('tenants.contactEmail') }}</label>
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
        <button class="btn-ghost" @click="showAdd = false">{{ $t('common.cancel') }}</button>
        <button type="submit" form="add-tenant-form" class="btn-gradient">
          {{ $t('tenants.createTenant') }}
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
