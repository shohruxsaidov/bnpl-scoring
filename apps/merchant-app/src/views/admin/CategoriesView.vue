<script setup lang="ts">
import { ref } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useCatalogStore } from '@/stores/catalog'
import type { Category } from '@/types'

const catalog = useCatalogStore()
const confirm = useConfirm()
const toast = useToast()

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
    toast.add({ severity: 'success', summary: 'Updated', life: 2000 })
  } else {
    catalog.addCategory(name.value.trim())
    toast.add({ severity: 'success', summary: 'Added', life: 2000 })
  }
  dialogVisible.value = false
}
function remove(c: Category) {
  confirm.require({
    message: `Delete category "${c.name}"?`,
    header: 'Confirm delete',
    icon: 'pi pi-trash',
    rejectProps: { label: 'Cancel', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Delete', severity: 'danger' },
    accept: () => {
      catalog.deleteCategory(c.id)
      toast.add({ severity: 'info', summary: 'Deleted', life: 2000 })
    },
  })
}
</script>

<template>
  <div class="admin-page">
    <div class="ap-head">
      <div>
        <h2>Categories</h2>
        <p>{{ catalog.categories.length }} categories</p>
      </div>
      <button class="btn-gradient" @click="openNew">
        <i class="pi pi-plus" /> Add Category
      </button>
    </div>

    <div class="surface-card list">
      <div v-for="c in catalog.categories" :key="c.id" class="cat-row">
        <div class="cat-left">
          <span class="cat-icon"><i class="pi pi-tag" /></span>
          <span class="cat-name">{{ c.name }}</span>
        </div>
        <div class="row-actions">
          <button class="ra-btn" title="Edit" @click="openEdit(c)">
            <i class="pi pi-pencil" />
          </button>
          <button class="ra-btn danger" title="Delete" @click="remove(c)">
            <i class="pi pi-trash" />
          </button>
        </div>
      </div>
    </div>

    <Dialog
      v-model:visible="dialogVisible"
      modal
      :header="editingId ? 'Edit category' : 'Add category'"
      :style="{ width: '400px' }"
    >
      <div class="field">
        <label class="field-label">Name</label>
        <InputText v-model="name" placeholder="Category name" @keyup.enter="save" />
      </div>
      <template #footer>
        <button class="btn-ghost" @click="dialogVisible = false">Cancel</button>
        <button class="btn-gradient" @click="save">Save</button>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 1.3rem;
}
.ap-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ap-head h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
}
.ap-head p {
  margin: 0.2rem 0 0;
  color: var(--text-secondary);
  font-size: 0.86rem;
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
