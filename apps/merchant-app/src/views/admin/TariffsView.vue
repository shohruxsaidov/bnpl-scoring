<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SkeletonTable from '@/components/SkeletonTable.vue'
import { usePageLoad } from '@/composables/usePageLoad'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { useCatalogStore } from '@/stores/catalog'

const catalog = useCatalogStore()
const { loading } = usePageLoad()
const toast = useToast()
const { t } = useI18n()

const toggling = ref<Set<string>>(new Set())

async function toggle(id: string, currentlySelected: boolean) {
  if (toggling.value.has(id)) return
  toggling.value.add(id)
  try {
    if (currentlySelected) {
      await catalog.deselectTariff(id)
    } else {
      await catalog.selectTariff(id)
    }
  } catch {
    toast.add({ severity: 'error', summary: t('tariffs.toggleFailed'), life: 2000 })
  } finally {
    toggling.value.delete(id)
  }
}
</script>

<template>
  <div class="admin-page">
    <SkeletonTable v-if="loading" :rows="7" :cols="5" :has-actions="true" :has-header="true" />
    <template v-else>
      <div class="page-hint">
        <i class="pi pi-info-circle" />
        {{ $t('tariffs.hint') }}
      </div>

      <div class="surface-card table-wrap">
        <DataTable :value="catalog.tariffs" data-key="id" :empty-message="$t('tariffs.noTariffs')">
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
          <Column :header="$t('tariffs.selected')" :style="{ width: '120px' }">
            <template #body="{ data }">
              <ToggleSwitch
                :model-value="data.selected"
                :disabled="toggling.has(data.id)"
                @update:model-value="toggle(data.id, data.selected)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </div>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 1.3rem;
}
.page-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.84rem;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--accent-2) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-2) 20%, transparent);
  border-radius: 10px;
  padding: 0.65rem 1rem;
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
</style>
