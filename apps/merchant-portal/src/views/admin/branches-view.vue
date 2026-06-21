<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import SkeletonTable from '@/components/skeleton-table.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { useCatalogStore } from '@/stores/catalog'
import { useRegions } from '@/composables/use-regions'
import type { Branch } from '@/types'

const catalog = useCatalogStore()
const { regionOptions, districtOptions, onRegionChange } = useRegions()

onMounted(() => catalog.fetchBranches())

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const form = reactive({ name: '', address: '', phone: '', regionId: null as number | null })
const selectedRegion = ref<number | null>(null)

function openNew() {
  editingId.value = null
  form.name = ''
  form.address = ''
  form.phone = ''
  form.regionId = null
  selectedRegion.value = null
  dialogVisible.value = true
}

function openEdit(b: Branch) {
  editingId.value = b.id
  form.name = b.name
  form.address = b.address
  form.phone = b.phone
  form.regionId = b.regionId ?? null
  selectedRegion.value = null
  dialogVisible.value = true
}

async function save() {
  if (!form.name || !form.address || !form.phone) return
  saving.value = true
  try {
    if (editingId.value) {
      await catalog.updateBranch(editingId.value, {
        name: form.name,
        address: form.address,
        phone: form.phone,
        regionId: form.regionId ?? undefined,
      })
    } else {
      await catalog.addBranch({
        name: form.name,
        address: form.address,
        phone: form.phone,
        regionId: form.regionId ?? undefined,
      })
    }
    dialogVisible.value = false
  } catch {} finally {
    saving.value = false
  }
}

async function toggleActive(b: Branch) {
  await catalog.updateBranch(b.id, { active: !b.active })
}
</script>

<template>
  <div class="admin-page">
    <SkeletonTable v-if="catalog.loading" :rows="5" :cols="3" :has-actions="true" :has-header="true" />

    <template v-else>
      <div class="page-actions">
        <button class="btn-gradient" @click="openNew">
          <i class="pi pi-plus" /> {{ $t('branches.addBranch') }}
        </button>
      </div>

      <div class="surface-card table-wrap">
        <DataTable :value="catalog.branches" data-key="id" paginator :rows="10">
          <Column field="name" :header="$t('branches.name')" sortable :style="{ minWidth: '180px' }" />
          <Column :header="$t('branches.address')">
            <template #body="{ data }">
              <span class="muted">{{ data.address }}</span>
            </template>
          </Column>
          <Column :header="$t('branches.phone')" :style="{ width: '160px' }">
            <template #body="{ data }">
              <span class="font-mono">{{ data.phone }}</span>
            </template>
          </Column>
          <Column :header="$t('branches.active')" :style="{ width: '80px' }">
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
        :header="editingId ? $t('branches.editBranch') : $t('branches.addBranchTitle')"
        :style="{ width: '440px' }"
      >
        <div class="form">
          <div class="field">
            <label class="field-label">{{ $t('branches.name') }}</label>
            <InputText v-model="form.name" :placeholder="$t('branches.namePlaceholder')" />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('branches.address') }}</label>
            <InputText v-model="form.address" :placeholder="$t('branches.addressPlaceholder')" />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('branches.phone') }}</label>
            <InputText v-model="form.phone" placeholder="+998 90 123 45 67" />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('branches.region') }}</label>
            <Select v-model="selectedRegion" :options="regionOptions" option-label="label" option-value="value"
              :placeholder="$t('branches.selectRegion')" filter show-clear
              @change="onRegionChange(selectedRegion, (v) => { form.regionId = v })" />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('branches.district') }}</label>
            <Select v-model="form.regionId" :options="districtOptions" option-label="label" option-value="value"
              :placeholder="$t('branches.selectDistrict')" filter show-clear :disabled="!selectedRegion" />
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
.muted { color: var(--text-secondary); font-size: 0.86rem; }
.ra-btn {
  width: 32px; height: 32px; border-radius: 8px;
  border: 1px solid var(--border-subtle); background: var(--bg-surface);
  color: var(--text-secondary); cursor: pointer; display: grid;
  place-items: center; transition: all 0.15s ease;
}
.ra-btn:hover { color: var(--accent-2); border-color: var(--accent-2); }
.form { display: flex; flex-direction: column; gap: 1rem; padding-top: 0.4rem; }
</style>
