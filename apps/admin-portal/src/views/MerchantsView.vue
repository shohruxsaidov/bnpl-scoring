<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { useMerchantsStore } from '@/stores/merchants'
import { formatDate } from '@/utils/money'
import type { Merchant } from '@/types'

const merchants = useMerchantsStore()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const showAdd = ref(false)
const saving = ref(false)

const schema = toTypedSchema(
  z.object({
    name: z.string().min(2, t('merchants.nameRequired')),
    legalName: z.string().min(2, t('merchants.legalNameRequired')),
    inn: z.string().min(1, t('merchants.innRequired')),
    phone: z.string().min(1, t('merchants.phoneRequired')),
    address: z.string().min(1, t('merchants.addressRequired')),
  }),
)

const { handleSubmit, errors, defineField, resetForm } = useForm({
  validationSchema: schema,
  initialValues: { name: '', legalName: '', inn: '', phone: '', address: '' },
})

const [name, nameAttrs] = defineField('name')
const [legalName, legalNameAttrs] = defineField('legalName')
const [inn, innAttrs] = defineField('inn')
const [phone, phoneAttrs] = defineField('phone')
const [address, addressAttrs] = defineField('address')

onMounted(() => {
  merchants.fetchAll().catch(() => {
    toast.add({
      severity: 'error',
      summary: t('merchants.loadFailed'),
      life: 3000,
    })
  })
})

const submitAdd = handleSubmit(async (values) => {
  saving.value = true
  try {
    await merchants.create(values)
    toast.add({
      severity: 'success',
      summary: t('merchants.merchantCreated'),
      detail: t('merchants.merchantAdded', { name: values.name }),
      life: 2500,
    })
    showAdd.value = false
    resetForm()
  } catch {
    toast.add({
      severity: 'error',
      summary: t('merchants.createFailed'),
      life: 3000,
    })
  } finally {
    saving.value = false
  }
})

function openAdd() {
  resetForm()
  showAdd.value = true
}

async function toggleStatus(merchant: Merchant) {
  try {
    await merchants.update(merchant.id, { active: !merchant.active })
    toast.add({
      severity: 'info',
      summary: merchant.active ? t('merchants.merchantSuspended') : t('merchants.merchantActivated'),
      detail: merchant.name,
      life: 2000,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: t('merchants.updateFailed'),
      life: 3000,
    })
  }
}
</script>

<template>
  <div class="merchants">
    <div class="head">
      <p class="muted count">
        {{ $t('merchants.summary', { total: merchants.merchants.length }) }}
      </p>
      <button class="btn-gradient" @click="openAdd">
        <i class="pi pi-plus" /> {{ $t('merchants.addMerchant') }}
      </button>
    </div>

    <div class="surface-card table-wrap">
      <DataTable
        :value="merchants.merchants"
        data-key="id"
        :loading="merchants.loading"
        paginator
        :rows="10"
        size="small"
      >
        <Column :header="$t('merchants.name')" sortable field="name">
          <template #body="{ data }">
            <span class="t-name">{{ data.name }}</span>
          </template>
        </Column>
        <Column :header="$t('merchants.inn')">
          <template #body="{ data }">
            <span class="font-mono muted">{{ data.inn }}</span>
          </template>
        </Column>
        <Column :header="$t('merchants.phone')">
          <template #body="{ data }">
            <span class="font-mono muted">{{ data.phone }}</span>
          </template>
        </Column>
        <Column :header="$t('merchants.active')">
          <template #body="{ data }">
            <ToggleSwitch
              :model-value="data.active"
              @update:model-value="toggleStatus(data)"
            />
          </template>
        </Column>
        <Column :header="$t('merchants.created')">
          <template #body="{ data }">
            <span class="font-mono muted">{{ formatDate(data.createdAt) }}</span>
          </template>
        </Column>
        <Column :header="$t('merchants.actions')">
          <template #body="{ data }">
            <div class="actions">
              <button
                class="icon-btn"
                :title="$t('merchants.view')"
                @click="router.push(`/merchants/${data.id}`)"
              >
                <i class="pi pi-eye" />
              </button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog
      v-model:visible="showAdd"
      modal
      :header="$t('merchants.addMerchantTitle')"
      :style="{ width: '460px' }"
    >
      <form id="add-merchant-form" @submit="submitAdd">
        <div class="field">
          <label class="field-label" for="m-name">{{ $t('merchants.businessName') }}</label>
          <InputText
            id="m-name"
            v-model="name"
            v-bind="nameAttrs"
            placeholder="TechShop Tashkent"
            :invalid="!!errors.name"
          />
          <span v-if="errors.name" class="field-error">{{ errors.name }}</span>
        </div>
        <div class="field">
          <label class="field-label" for="m-legal">{{ $t('merchants.legalName') }}</label>
          <InputText
            id="m-legal"
            v-model="legalName"
            v-bind="legalNameAttrs"
            placeholder='OOO "TechShop"'
            :invalid="!!errors.legalName"
          />
          <span v-if="errors.legalName" class="field-error">{{ errors.legalName }}</span>
        </div>
        <div class="field">
          <label class="field-label" for="m-inn">{{ $t('merchants.inn') }}</label>
          <InputText
            id="m-inn"
            v-model="inn"
            v-bind="innAttrs"
            placeholder="305123456"
            :invalid="!!errors.inn"
          />
          <span v-if="errors.inn" class="field-error">{{ errors.inn }}</span>
        </div>
        <div class="field">
          <label class="field-label" for="m-phone">{{ $t('merchants.phone') }}</label>
          <InputText
            id="m-phone"
            v-model="phone"
            v-bind="phoneAttrs"
            placeholder="+998 90 123 45 67"
            :invalid="!!errors.phone"
          />
          <span v-if="errors.phone" class="field-error">{{ errors.phone }}</span>
        </div>
        <div class="field">
          <label class="field-label" for="m-address">{{ $t('merchants.address') }}</label>
          <InputText
            id="m-address"
            v-model="address"
            v-bind="addressAttrs"
            placeholder="Tashkent, Amir Temur 1"
            :invalid="!!errors.address"
          />
          <span v-if="errors.address" class="field-error">{{ errors.address }}</span>
        </div>
      </form>
      <template #footer>
        <button class="btn-ghost" @click="showAdd = false">{{ $t('common.cancel') }}</button>
        <button type="submit" form="add-merchant-form" class="btn-gradient" :disabled="saving">
          {{ $t('merchants.createMerchant') }}
        </button>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.merchants {
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
.field {
  margin-bottom: 1rem;
}
</style>
