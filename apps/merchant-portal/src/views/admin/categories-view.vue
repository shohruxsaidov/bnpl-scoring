<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Skeleton from 'primevue/skeleton'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useCatalogStore } from '@/stores/catalog'
import type { Category } from '@/types'

const catalog = useCatalogStore()
const confirm = useConfirm()
const toast = useToast()
const { t } = useI18n()

onMounted(() => catalog.fetchCategories())

function remove(c: Category) {
  confirm.require({
    message: t('categories.deleteConfirm', { name: c.name }),
    header: t('categories.confirmDelete'),
    icon: 'pi pi-trash',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('common.delete'), severity: 'danger' },
    accept: async () => {
      await catalog.disableCategory(c.id)
      toast.add({ severity: 'info', summary: t('categories.deleted'), life: 2000 })
    },
  })
}
</script>

<template>
  <div class="admin-page">
    <template v-if="catalog.loading">
      <div class="surface-card list sk-list">
        <div v-for="i in 6" :key="i" class="sk-cat-row">
          <div class="sk-left">
            <Skeleton shape="circle" size="1.5rem" />
            <Skeleton width="8rem" height="0.85rem" border-radius="4px" />
          </div>
          <Skeleton width="1.8rem" height="1.8rem" border-radius="6px" />
        </div>
      </div>
    </template>

    <template v-else>
      <div class="surface-card list">
        <div v-for="c in catalog.categories" :key="c.id" class="cat-row">
          <div class="cat-left">
            <span class="cat-icon"><i class="pi pi-tag" /></span>
            <span class="cat-name">{{ c.name }}</span>
          </div>
          <div class="row-actions">
            <button class="ra-btn danger" :title="$t('common.delete')" @click="remove(c)">
              <i class="pi pi-trash" />
            </button>
          </div>
        </div>
        <div v-if="!catalog.categories.length" class="empty-state">
          {{ $t('categories.empty') }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sk-list {
  padding: 0.8rem;
}

.sk-cat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
}

.sk-cat-row:last-child {
  border-bottom: none;
}

.sk-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.admin-page {
  display: flex;
  flex-direction: column;
  gap: 1.3rem;
}

.list {
  padding: 0.8rem;
}

.cat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  transition: background 0.15s ease;
}

.cat-row:hover {
  background: var(--bg-surface);
}

.cat-left {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.cat-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--bg-surface);
  color: var(--accent-2);
  display: grid;
  place-items: center;
}

.cat-name {
  font-weight: 700;
  font-size: 0.92rem;
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
  background: var(--bg-base);
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

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
</style>
