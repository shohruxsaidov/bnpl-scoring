<script setup lang="ts">
import { onMounted } from 'vue'
import SkeletonTable from '@/components/skeleton-table.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useCatalogStore } from '@/stores/catalog'

const catalog = useCatalogStore()

onMounted(() => catalog.fetchTariffs())
</script>

<template>
  <div class="admin-page">
    <SkeletonTable v-if="catalog.loading" :rows="7" :cols="4" :has-header="true" />
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
