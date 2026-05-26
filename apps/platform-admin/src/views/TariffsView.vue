<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { useTariffsStore } from '@/stores/tariffs'
import type { Tariff } from '@/types'

const tariffs = useTariffsStore()
const toast = useToast()
const confirm = useConfirm()
const { t } = useI18n()

const showDialog = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const schema = toTypedSchema(
  z.object({
    name: z.string().min(1, t('tariffs.nameRequired')),
    termMonths: z.number().int().min(1).max(120),
    markupPercent: z.number().min(0).max(100),
    creditMinSom: z.number().min(0),
    creditMaxSom: z.number().min(0),
  }),
)

const { handleSubmit, errors, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
  initialValues: { name: '', termMonths: 6, markupPercent: 8, creditMinSom: 500000, creditMaxSom: 50000000 },
})

const [name, nameAttrs] = defineField('name')
const [termMonths, termMonthsAttrs] = defineField('termMonths')
const [markupPercent, markupPercentAttrs] = defineField('markupPercent')
const [creditMinSom, creditMinSomAttrs] = defineField('creditMinSom')
const [creditMaxSom, creditMaxSomAttrs] = defineField('creditMaxSom')

onMounted(() => {
  tariffs.fetchAll().catch(() => toast.add({ severity: 'error', summary: t('tariffs.loadFailed'), life: 3000 }))
})

function openNew() {
  editingId.value = null
  resetForm()
  showDialog.value = true
}

function openEdit(tariff: Tariff) {
  editingId.value = tariff.id
  setValues({
    name: tariff.name,
    termMonths: tariff.termMonths,
    markupPercent: tariff.markupPercent,
    creditMinSom: tariff.creditMin / 100,
    creditMaxSom: tariff.creditMax / 100,
  })
  showDialog.value = true
}

const submit = handleSubmit(async (values) => {
  saving.value = true
  try {
    const payload = {
      name: values.name,
      termMonths: values.termMonths,
      markupPercent: values.markupPercent,
      creditMin: Math.round(values.creditMinSom * 100),
      creditMax: Math.round(values.creditMaxSom * 100),
    }
    if (editingId.value) {
      await tariffs.update(editingId.value, payload)
      toast.add({ severity: 'success', summary: t('tariffs.updated'), life: 2000 })
    } else {
      await tariffs.create(payload)
      toast.add({ severity: 'success', summary: t('tariffs.created'), life: 2000 })
    }
    showDialog.value = false
  } catch {
    toast.add({ severity: 'error', summary: editingId.value ? t('tariffs.updateFailed') : t('tariffs.createFailed'), life: 3000 })
  } finally {
    saving.value = false
  }
})

function remove(tariff: Tariff) {
  confirm.require({
    message: t('tariffs.deleteConfirm', { name: tariff.name }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('common.delete'), severity: 'danger' },
    accept: async () => {
      try {
        await tariffs.remove(tariff.id)
        toast.add({ severity: 'info', summary: t('tariffs.deleted'), life: 2000 })
      } catch {
        toast.add({ severity: 'error', summary: t('tariffs.updateFailed'), life: 3000 })
      }
    },
  })
}

function fmt(tiyin: number) {
  return (tiyin / 100).toLocaleString('uz-UZ')
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ $t('tariffs.title') }}</h1>
        <p class="page-sub">{{ $t('tariffs.summary', { count: tariffs.tariffs.length }) }}</p>
      </div>
      <button class="btn-gradient" @click="openNew">
        <i class="pi pi-plus" /> {{ $t('tariffs.addTariff') }}
      </button>
    </div>

    <div class="surface-card table-wrap">
      <DataTable :value="tariffs.tariffs" :loading="tariffs.loading" data-key="id">
        <Column field="name" :header="$t('tariffs.name')" sortable>
          <template #body="{ data }">
            <span class="t-name">{{ data.name }}</span>
          </template>
        </Column>
        <Column :header="$t('tariffs.term')">
          <template #body="{ data }">
            <span class="font-mono">{{ data.termMonths }} {{ $t('tariffs.mo') }}</span>
          </template>
        </Column>
        <Column :header="$t('tariffs.markup')">
          <template #body="{ data }">
            <span class="markup font-mono">{{ data.markupPercent }}%</span>
          </template>
        </Column>
        <Column :header="$t('tariffs.creditRange')">
          <template #body="{ data }">
            <span class="font-mono range">
              {{ fmt(data.creditMin) }} – {{ fmt(data.creditMax) }} {{ $t('common.som') }}
            </span>
          </template>
        </Column>
        <Column :header="$t('tariffs.active')">
          <template #body="{ data }">
            <ToggleSwitch
              :model-value="data.active"
              @update:model-value="tariffs.update(data.id, { active: !data.active })"
            />
          </template>
        </Column>
        <Column header="" :style="{ width: '8rem' }">
          <template #body="{ data }">
            <div class="row-actions">
              <button class="ra-btn" :title="$t('common.edit')" @click="openEdit(data)">
                <i class="pi pi-pencil" />
              </button>
              <button class="ra-btn danger" :title="$t('common.delete')" @click="remove(data)">
                <i class="pi pi-trash" />
              </button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog
      v-model:visible="showDialog"
      modal
      :header="editingId ? $t('tariffs.editTariff') : $t('tariffs.addTariff')"
      :style="{ width: '480px' }"
    >
      <form class="form" @submit.prevent="submit">
        <div class="field">
          <label class="field-label">{{ $t('tariffs.name') }}</label>
          <InputText v-model="name" v-bind="nameAttrs" fluid :placeholder="$t('tariffs.namePlaceholder')" />
          <small v-if="errors.name" class="field-error">{{ errors.name }}</small>
        </div>
        <div class="grid2">
          <div class="field">
            <label class="field-label">{{ $t('tariffs.termMonths') }}</label>
            <InputNumber v-model="termMonths" v-bind="termMonthsAttrs" :min="1" :max="120" fluid />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('tariffs.markupPercent') }}</label>
            <InputNumber v-model="markupPercent" v-bind="markupPercentAttrs" :min="0" :max="100" :max-fraction-digits="2" fluid />
          </div>
        </div>
        <div class="grid2">
          <div class="field">
            <label class="field-label">{{ $t('tariffs.creditMin') }}</label>
            <InputNumber v-model="creditMinSom" v-bind="creditMinSomAttrs" :min="0" fluid />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('tariffs.creditMax') }}</label>
            <InputNumber v-model="creditMaxSom" v-bind="creditMaxSomAttrs" :min="0" fluid />
          </div>
        </div>
      </form>
      <template #footer>
        <button class="btn-ghost" @click="showDialog = false">{{ $t('common.cancel') }}</button>
        <button class="btn-gradient" :disabled="saving" @click="submit">
          {{ saving ? '…' : $t('common.save') }}
        </button>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.page-title {
  font-size: 1.4rem;
  font-weight: 800;
  margin: 0;
}
.page-sub {
  font-size: 0.84rem;
  color: var(--text-secondary);
  margin: 0.2rem 0 0;
}
.table-wrap {
  padding: 1.4rem;
}
.t-name {
  font-weight: 700;
}
.markup {
  color: var(--accent-2);
  font-weight: 700;
}
.range {
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.row-actions {
  display: flex;
  gap: 0.4rem;
}
.ra-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.15s ease;
}
.ra-btn:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}
.ra-btn.danger:hover {
  color: var(--danger);
  border-color: var(--danger);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.4rem;
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.field-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
}
.field-error {
  color: var(--danger);
  font-size: 0.78rem;
}
.form :deep(.p-inputnumber) {
  width: 100%;
}
</style>
