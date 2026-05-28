<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Skeleton from 'primevue/skeleton'
import { usePageLoad } from '@/composables/usePageLoad'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useCatalogStore } from '@/stores/catalog'
import type { Category } from '@/types'

const catalog = useCatalogStore()
const confirm = useConfirm()
const { loading } = usePageLoad()
const toast = useToast()
const { t } = useI18n()

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const name = ref('')

function openNew() {
  editingId.value = null
  name.value = ''
  dialogVisible.value = true
}
function openEdit(c: Category) {
  editingId.value = c.id
  name.value = c.name
  dialogVisible.value = true
}
function save() {
  if (!name.value.trim()) return
  if (editingId.value) {
    catalog.updateCategory(editingId.value, name.value.trim())
    toast.add({ severity: 'success', summary: t('categories.updated'), life: 2000 })
  } else {
    catalog.addCategory(name.value.trim())
    toast.add({ severity: 'success', summary: t('categories.added'), life: 2000 })
  }
  dialogVisible.value = false
}
function remove(c: Category) {
  confirm.require({
    message: t('categories.deleteConfirm', { name: c.name }),
    header: t('categories.confirmDelete'),
    icon: 'pi pi-trash',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('common.delete'), severity: 'danger' },
    accept: () => {
      catalog.deleteCategory(c.id)
      toast.add({ severity: 'info', summary: t('categories.deleted'), life: 2000 })
    },
  })
}
</script>

<template>
  <div class="admin-page">
    <!-- skeleton -->
    <template v-if="loading">
      <div class="page-actions">
        <Skeleton width="10rem" height="2.2rem" border-radius="10px" />
      </div>
      <div class="surface-card list sk-list">
        <div v-for="i in 6" :key="i" class="sk-cat-row">
          <div class="sk-left">
            <Skeleton shape="circle" size="1.5rem" />
            <Skeleton width="8rem" height="0.85rem" border-radius="4px" />
          </div>
          <div class="sk-actions">
            <Skeleton width="1.8rem" height="1.8rem" border-radius="6px" />
            <Skeleton width="1.8rem" height="1.8rem" border-radius="6px" />
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="page-actions">
        <button class="btn-gradient" @click="openNew">
          <i class="pi pi-plus" /> {{ $t('categories.addCategory') }}
        </button>
      </div>

      <div class="surface-card list">
        <div v-for="c in catalog.categories" :key="c.id" class="cat-row">
          <div class="cat-left">
            <span class="cat-icon"><i class="pi pi-tag" /></span>
            <span class="cat-name">{{ c.name }}</span>
          </div>
          <div class="row-actions">
            <button class="ra-btn" :title="$t('common.edit')" @click="openEdit(c)">
              <i class="pi pi-pencil" />
            </button>
            <button class="ra-btn danger" :title="$t('common.delete')" @click="remove(c)">
              <i class="pi pi-trash" />
            </button>
          </div>
        </div>
      </div>

      <Dialog v-model:visible="dialogVisible" modal
        :header="editingId ? $t('categories.editCategory') : $t('categories.addCategoryTitle')"
        :style="{ width: '400px' }">
        <div class="field">
          <label class="field-label">{{ $t('categories.name') }}</label>
          <InputText v-model="name" :placeholder="$t('categories.categoryName')" @keyup.enter="save" />
        </div>
        <template #footer>
          <button class="btn-ghost" @click="dialogVisible = false">{{ $t('common.cancel') }}</button>
          <button class="btn-gradient" @click="save">{{ $t('common.save') }}</button>
        </template>
      </Dialog>
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

.sk-actions {
  display: flex;
  gap: 0.4rem;
}

.admin-page {
  display: flex;
  flex-direction: column;
  gap: 1.3rem;
}

.page-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-gradient {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
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

.field {
  padding-top: 0.4rem;
}
</style>
