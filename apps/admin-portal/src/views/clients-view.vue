<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useClientsStore } from '@/stores/clients'
import { formatDate } from '@/utils/money'

const store = useClientsStore()
const router = useRouter()

onMounted(() => store.fetchAll())

function openClient(event: { data: { id: string } }) {
  router.push(`/clients/${event.data.id}`)
}

const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return store.clients
  return store.clients.filter(
    (c) =>
      c.fullName.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.pinfl.includes(q),
  )
})
</script>

<template>
  <div class="clients-page">
    <div class="toolbar surface-card">
      <div class="search-wrap">
        <i class="pi pi-search search-icon" />
        <input
          v-model="search"
          class="search-input"
          :placeholder="$t('clients.searchPlaceholder')"
          type="text"
        />
      </div>
      <span class="count muted">
        {{ $t('clients.count', { count: filtered.length }) }}
      </span>
    </div>

    <div class="surface-card table-wrap">
      <DataTable
        :value="filtered"
        :loading="store.loading"
        data-key="id"
        paginator
        :rows="20"
        size="small"
        sort-field="fullName"
        :sort-order="1"
        selection-mode="single"
        class="clickable-rows"
        @row-click="openClient"
      >
        <Column :header="$t('clients.fullName')" sortable field="fullName">
          <template #body="{ data }">
            <span class="name">{{ data.fullName }}</span>
            <span v-if="data.middleName" class="middle-name muted"> {{ data.middleName }}</span>
          </template>
        </Column>
        <Column :header="$t('clients.phone')">
          <template #body="{ data }">
            <span class="font-mono">{{ data.phone }}</span>
          </template>
        </Column>
        <Column :header="$t('clients.pinfl')" sortable field="pinfl">
          <template #body="{ data }">
            <span class="font-mono muted">{{ data.pinfl }}</span>
          </template>
        </Column>
        <Column :header="$t('clients.birthDate')" sortable field="birthDate">
          <template #body="{ data }">
            <span class="font-mono muted">{{ formatDate(data.birthDate) }}</span>
          </template>
        </Column>
        <Column :header="$t('clients.createdAt')" sortable field="createdAt">
          <template #body="{ data }">
            <span class="font-mono muted">{{ formatDate(data.createdAt) }}</span>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.clients-page {
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
.search-wrap {
  position: relative;
  flex: 1;
  max-width: 380px;
}
.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  font-size: 0.82rem;
}
.search-input {
  width: 100%;
  padding: 0.45rem 0.75rem 0.45rem 2rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 0.84rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}
.search-input:focus {
  border-color: var(--accent-2);
}
.count {
  font-size: 0.82rem;
  font-weight: 600;
  margin-left: auto;
}
.table-wrap {
  padding: 0;
  overflow: hidden;
}
:deep(.clickable-rows .p-datatable-tbody > tr) {
  cursor: pointer;
}
:deep(.clickable-rows .p-datatable-tbody > tr:hover td) {
  background: var(--bg-surface);
}
.name {
  font-weight: 700;
  font-size: 0.88rem;
}
.middle-name {
  font-size: 0.78rem;
}
</style>
