<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { useCategoriesStore } from '@/stores/categories'

const { t } = useI18n()
const toast = useToast()
const store = useCategoriesStore()

onMounted(() => {
  store.fetchAll().catch(() => toast.add({ severity: 'error', summary: t('categories.loadFailed'), life: 3000 }))
})

// ── Search ──────────────────────────────────────────────────────────────────
const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return store.categories
  return store.categories.filter((c) => c.name.toLowerCase().includes(q))
})

// ── Add dialog ──────────────────────────────────────────────────────────────
const dialogMode = ref<'add' | 'edit'>('add')
const dialogOpen = ref(false)
const saving = ref(false)
const formName = ref('')
const formError = ref('')
const editingId = ref<string | null>(null)

function openAdd() {
  dialogMode.value = 'add'
  formName.value = ''
  formError.value = ''
  editingId.value = null
  dialogOpen.value = true
}

function openEdit(id: string, name: string) {
  dialogMode.value = 'edit'
  formName.value = name
  formError.value = ''
  editingId.value = id
  dialogOpen.value = true
}

function closeDialog() { dialogOpen.value = false }

async function save() {
  const name = formName.value.trim()
  if (!name) { formError.value = t('categories.nameRequired'); return }
  if (
    store.categories.some(
      (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== editingId.value,
    )
  ) {
    formError.value = t('categories.duplicate')
    return
  }

  saving.value = true
  try {
    if (dialogMode.value === 'add') {
      await store.create(name)
      toast.add({ severity: 'success', summary: t('categories.created'), life: 2500 })
    } else {
      await store.update(editingId.value!, { name })
      toast.add({ severity: 'success', summary: t('categories.updated'), life: 2500 })
    }
    dialogOpen.value = false
  } catch {
    toast.add({ severity: 'error', summary: t('categories.saveFailed'), life: 3000 })
  } finally {
    saving.value = false
  }
}

// ── Toggle active ────────────────────────────────────────────────────────────
async function toggleActive(id: string, current: boolean) {
  try {
    await store.update(id, { active: !current })
  } catch {
    toast.add({ severity: 'error', summary: t('categories.saveFailed'), life: 3000 })
  }
}
</script>

<template>
  <div class="cat-page">

    <!-- ── Skeleton ────────────────────────────────────────────────────────── -->
    <template v-if="store.loading">
      <div class="page-actions sk-actions">
        <Skeleton width="10rem" height="2rem" border-radius="10px" />
        <Skeleton width="7rem" height="2rem" border-radius="10px" />
      </div>
      <div class="surface-card panel">
        <div class="panel-head">
          <Skeleton width="8rem" height="0.85rem" border-radius="4px" />
          <Skeleton width="3rem" height="0.75rem" border-radius="4px" />
        </div>
        <div v-for="i in 6" :key="i" class="sk-row">
          <Skeleton width="3rem" height="1.5rem" border-radius="999px" />
          <Skeleton width="10rem" height="0.9rem" border-radius="4px" />
          <div class="sk-row-right">
            <Skeleton width="2rem" height="1.5rem" border-radius="999px" />
            <Skeleton width="1.8rem" height="1.8rem" border-radius="6px" />
          </div>
        </div>
      </div>
    </template>

    <!-- ── Content ────────────────────────────────────────────────────────── -->
    <template v-else>
      <div class="page-actions">
        <div class="search-wrap">
          <i class="pi pi-search search-icon" />
          <InputText
            v-model="search"
            :placeholder="t('categories.searchPlaceholder')"
            class="search-input"
          />
        </div>
        <button class="btn-add" @click="openAdd">
          <i class="pi pi-plus" />
          {{ t('categories.addCategory') }}
        </button>
      </div>

      <div class="surface-card panel">
        <div class="panel-head">
          <h3 class="section-title">{{ t('categories.listTitle') }}</h3>
          <span class="count-badge">{{ store.categories.length }}</span>
        </div>

        <div v-if="filtered.length === 0" class="empty">
          <i class="pi pi-tag empty-icon" />
          <span>{{ store.categories.length === 0 ? t('categories.empty') : t('categories.noResults') }}</span>
        </div>

        <template v-else>
          <div
            v-for="(cat, idx) in filtered"
            :key="cat.id"
            class="cat-row"
            :class="{ last: idx === filtered.length - 1, inactive: !cat.active }"
          >
            <i class="pi pi-tag row-icon" />
            <span class="cat-name">{{ cat.name }}</span>

            <div class="row-actions">
              <span class="status-chip" :class="cat.active ? 'active' : 'inactive'">
                {{ cat.active ? t('common.active') : t('common.inactive') }}
              </span>
              <button class="icon-btn" :title="t('common.edit')" @click="openEdit(cat.id, cat.name)">
                <i class="pi pi-pencil" />
              </button>
              <button
                class="icon-btn"
                :title="cat.active ? t('categories.deactivate') : t('categories.activate')"
                @click="toggleActive(cat.id, cat.active)"
              >
                <i :class="cat.active ? 'pi pi-eye-slash' : 'pi pi-eye'" />
              </button>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- ── Dialog ─────────────────────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="dialogOpen" class="dialog-backdrop" @mousedown.self="closeDialog">
        <div class="dialog surface-card">
          <div class="dialog-header">
            <h3>{{ dialogMode === 'add' ? t('categories.addCategory') : t('categories.editCategory') }}</h3>
            <button class="close-btn" @click="closeDialog"><i class="pi pi-times" /></button>
          </div>

          <div class="dialog-body">
            <div class="field">
              <label class="field-label">{{ t('categories.name') }}</label>
              <InputText
                v-model="formName"
                :placeholder="t('categories.namePlaceholder')"
                class="w-full"
                :invalid="!!formError"
                autofocus
                @keyup.enter="save"
                @input="formError = ''"
              />
              <span v-if="formError" class="field-error">{{ formError }}</span>
            </div>
          </div>

          <div class="dialog-footer">
            <button class="btn-ghost" @click="closeDialog">{{ t('common.cancel') }}</button>
            <button class="btn-primary" :disabled="saving" @click="save">
              <i :class="saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'" />
              {{ saving ? t('common.loading') : t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.cat-page {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
.sk-actions { display: flex; justify-content: space-between; }
.sk-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1.1rem;
  border-bottom: 1px solid var(--border-subtle);
}
.sk-row:last-child { border-bottom: none; }
.sk-row-right { margin-left: auto; display: flex; align-items: center; gap: 0.6rem; }

/* ── Toolbar ──────────────────────────────────────────────────────────────── */
.page-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.search-wrap { position: relative; }
.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  font-size: 0.85rem;
  pointer-events: none;
}
.search-input { padding-left: 2.1rem; min-width: 220px; }

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.2rem;
  border-radius: 10px;
  border: none;
  background: var(--gradient-hero);
  color: #fff;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  box-shadow: var(--accent-glow);
  white-space: nowrap;
}
.btn-add:hover { opacity: 0.9; }

/* ── Panel ────────────────────────────────────────────────────────────────── */
.panel { overflow: hidden; }
.panel-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-subtle);
}
.section-title { font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin: 0; }
.count-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
}

/* ── Rows ─────────────────────────────────────────────────────────────────── */
.cat-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.12s;
}
.cat-row:hover { background: var(--bg-base); }
.cat-row.last { border-bottom: none; }
.cat-row.inactive { opacity: 0.55; }

.row-icon { color: var(--text-secondary); font-size: 0.9rem; flex-shrink: 0; }
.cat-name { font-size: 0.88rem; font-weight: 600; color: var(--text-primary); flex: 1; }

.row-actions { display: flex; align-items: center; gap: 0.5rem; }

.status-chip {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.status-chip.active {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
}
.status-chip.inactive {
  background: color-mix(in srgb, var(--text-secondary) 12%, transparent);
  color: var(--text-secondary);
}

.icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  transition: all 0.13s;
}
.icon-btn:hover { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }

/* ── Empty ────────────────────────────────────────────────────────────────── */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 3rem 1rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}
.empty-icon { font-size: 2rem; opacity: 0.35; }

/* ── Dialog ───────────────────────────────────────────────────────────────── */
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: grid;
  place-items: center;
  z-index: 100;
}
.dialog {
  width: min(420px, 92vw);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.4rem 0.9rem;
  border-bottom: 1px solid var(--border-subtle);
}
.dialog-header h3 { margin: 0; font-size: 0.95rem; font-weight: 700; }
.close-btn {
  width: 28px; height: 28px; border-radius: 7px;
  border: 1px solid var(--border-subtle); background: transparent;
  color: var(--text-secondary); cursor: pointer; display: grid; place-items: center;
}
.close-btn:hover { border-color: var(--danger); color: var(--danger); }

.dialog-body { padding: 1.25rem 1.4rem; display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
.field-error { font-size: 0.75rem; color: var(--danger); }
.w-full { width: 100%; }

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
  padding: 0.9rem 1.4rem;
  border-top: 1px solid var(--border-subtle);
}
.btn-ghost {
  padding: 0.5rem 1.1rem;
  border-radius: 9px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}
.btn-ghost:hover { border-color: var(--text-secondary); color: var(--text-primary); }
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1.3rem;
  border-radius: 9px;
  border: none;
  background: var(--gradient-hero);
  color: #fff;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  box-shadow: var(--accent-glow);
}
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.btn-primary:not(:disabled):hover { opacity: 0.9; }

/* ── Transition ───────────────────────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.18s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
