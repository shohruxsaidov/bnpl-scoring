<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { usePageLoad } from '@/composables/usePageLoad'

const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const { loading } = usePageLoad()

type EntryType = 'pinfl' | 'inn'

interface BlacklistEntry {
  id: string
  type: EntryType
  value: string
  reason: string
  addedBy: string
  addedAt: string
}

let seq = 1
function uid() { return `bl_${Date.now()}_${seq++}` }

const entries = ref<BlacklistEntry[]>([])

// ── Add dialog ──────────────────────────────────────────────────────────────
const dialogOpen = ref(false)
const form = ref<{ type: EntryType; value: string; reason: string }>({
  type: 'pinfl',
  value: '',
  reason: '',
})
const formError = ref('')

function openAdd() {
  form.value = { type: 'pinfl', value: '', reason: '' }
  formError.value = ''
  dialogOpen.value = true
}

function closeDialog() { dialogOpen.value = false }

function validateValue(type: EntryType, val: string): string | null {
  const v = val.trim()
  if (!v) return t('blacklist.valueRequired')
  if (type === 'pinfl' && !/^\d{14}$/.test(v)) return t('blacklist.pinflFormat')
  if (type === 'inn' && !/^\d{9}$/.test(v)) return t('blacklist.innFormat')
  if (entries.value.some((e) => e.type === type && e.value === v)) return t('blacklist.duplicate')
  return null
}

function save() {
  const err = validateValue(form.value.type, form.value.value)
  if (err) { formError.value = err; return }

  entries.value.unshift({
    id: uid(),
    type: form.value.type,
    value: form.value.value.trim(),
    reason: form.value.reason.trim(),
    addedBy: 'Platform Admin',
    addedAt: new Date().toISOString(),
  })
  toast.add({ severity: 'success', summary: t('blacklist.added'), life: 2500 })
  dialogOpen.value = false
}

// ── Remove ──────────────────────────────────────────────────────────────────
function remove(entry: BlacklistEntry) {
  confirm.require({
    message: t('blacklist.removeConfirmMsg', { value: entry.value }),
    header: t('blacklist.removeConfirmTitle'),
    icon: 'pi pi-trash',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('common.delete'), severity: 'danger' },
    accept: () => {
      entries.value = entries.value.filter((e) => e.id !== entry.id)
      toast.add({ severity: 'info', summary: t('blacklist.removed'), life: 2000 })
    },
  })
}

// ── Search ──────────────────────────────────────────────────────────────────
const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return entries.value
  return entries.value.filter(
    (e) => e.value.includes(q) || e.reason.toLowerCase().includes(q),
  )
})

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="bl-page">

    <!-- ── Skeleton ────────────────────────────────────────────────────────── -->
    <template v-if="loading">
      <div class="page-actions sk-actions">
        <Skeleton width="10rem" height="2rem" border-radius="10px" />
        <Skeleton width="7rem" height="2rem" border-radius="10px" />
      </div>
      <div class="surface-card panel">
        <div class="panel-head">
          <Skeleton width="8rem" height="0.85rem" border-radius="4px" />
          <Skeleton width="5rem" height="0.75rem" border-radius="4px" />
        </div>
        <div v-for="i in 5" :key="i" class="sk-row">
          <Skeleton width="3.5rem" height="1.5rem" border-radius="999px" />
          <Skeleton width="9rem" height="0.9rem" border-radius="4px" />
          <div class="sk-row-right">
            <Skeleton width="12rem" height="0.75rem" border-radius="4px" />
            <Skeleton width="1.8rem" height="1.8rem" border-radius="6px" />
          </div>
        </div>
      </div>
    </template>

    <!-- ── Content ────────────────────────────────────────────────────────── -->
    <template v-else>
      <!-- toolbar -->
      <div class="page-actions">
        <div class="search-wrap">
          <i class="pi pi-search search-icon" />
          <InputText
            v-model="search"
            :placeholder="t('blacklist.searchPlaceholder')"
            class="search-input"
          />
        </div>
        <button class="btn-add" @click="openAdd">
          <i class="pi pi-plus" />
          {{ t('blacklist.addEntry') }}
        </button>
      </div>

      <!-- list card -->
      <div class="surface-card panel">
        <div class="panel-head">
          <h3 class="section-title">{{ t('blacklist.listTitle') }}</h3>
          <span class="count-badge">{{ entries.length }}</span>
        </div>

        <!-- empty -->
        <div v-if="filtered.length === 0" class="empty">
          <i class="pi pi-ban empty-icon" />
          <span>{{ entries.length === 0 ? t('blacklist.empty') : t('blacklist.noResults') }}</span>
        </div>

        <!-- rows -->
        <template v-else>
          <div
            v-for="(entry, idx) in filtered"
            :key="entry.id"
            class="entry-row"
            :class="{ last: idx === filtered.length - 1 }"
          >
            <span class="type-badge" :class="entry.type">
              {{ entry.type === 'pinfl' ? 'PINFL' : 'INN' }}
            </span>

            <span class="entry-value font-mono">{{ entry.value }}</span>

            <div class="entry-meta">
              <span v-if="entry.reason" class="entry-reason">{{ entry.reason }}</span>
              <span class="entry-date">{{ t('blacklist.addedBy', { who: entry.addedBy }) }} · {{ formatDate(entry.addedAt) }}</span>
            </div>

            <button class="remove-btn" :title="t('common.delete')" @click="remove(entry)">
              <i class="pi pi-trash" />
            </button>
          </div>
        </template>
      </div>
    </template>

    <!-- ── Add dialog ─────────────────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="dialogOpen" class="dialog-backdrop" @mousedown.self="closeDialog">
        <div class="dialog surface-card">
          <div class="dialog-header">
            <h3>{{ t('blacklist.addEntry') }}</h3>
            <button class="close-btn" @click="closeDialog"><i class="pi pi-times" /></button>
          </div>

          <div class="dialog-body">
            <!-- type toggle -->
            <div class="field">
              <label class="field-label">{{ t('blacklist.entryType') }}</label>
              <div class="type-toggle">
                <button
                  class="type-opt"
                  :class="{ active: form.type === 'pinfl' }"
                  @click="form.type = 'pinfl'; formError = ''"
                >
                  PINFL
                  <span class="type-hint">14 {{ t('blacklist.digits') }}</span>
                </button>
                <button
                  class="type-opt"
                  :class="{ active: form.type === 'inn' }"
                  @click="form.type = 'inn'; formError = ''"
                >
                  INN
                  <span class="type-hint">9 {{ t('blacklist.digits') }}</span>
                </button>
              </div>
            </div>

            <!-- value -->
            <div class="field">
              <label class="field-label">
                {{ form.type === 'pinfl' ? 'PINFL' : 'INN' }}
              </label>
              <InputText
                v-model="form.value"
                :placeholder="form.type === 'pinfl' ? '31203016740011' : '302184711'"
                class="font-mono w-full"
                :invalid="!!formError"
                @input="formError = ''"
              />
              <span v-if="formError" class="field-error">{{ formError }}</span>
            </div>

            <!-- reason -->
            <div class="field">
              <label class="field-label">{{ t('blacklist.reason') }} <span class="optional">({{ t('blacklist.optional') }})</span></label>
              <InputText
                v-model="form.reason"
                :placeholder="t('blacklist.reasonPlaceholder')"
              />
            </div>
          </div>

          <div class="dialog-footer">
            <button class="btn-ghost" @click="closeDialog">{{ t('common.cancel') }}</button>
            <button class="btn-danger-solid" @click="save">
              <i class="pi pi-ban" />
              {{ t('blacklist.block') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bl-page {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
.sk-actions {
  display: flex;
  justify-content: space-between;
}
.sk-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1.1rem;
  border-bottom: 1px solid var(--border-subtle);
}
.sk-row:last-child { border-bottom: none; }
.sk-row-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* ── Toolbar ─────────────────────────────────────────────────────────────── */
.page-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.search-wrap {
  position: relative;
  flex: 1;
  max-width: 320px;
}
.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  font-size: 0.85rem;
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding-left: 2.2rem !important;
}
.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 1.1rem;
  border-radius: 10px;
  border: none;
  background: var(--danger);
  color: #fff;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.btn-add:hover { opacity: 0.88; }

/* ── Panel ───────────────────────────────────────────────────────────────── */
.panel {
  padding: 0;
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid var(--border-subtle);
}
.section-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 800;
}
.count-badge {
  font-size: 0.72rem;
  font-weight: 800;
  background: var(--bg-surface);
  color: var(--text-secondary);
  border-radius: 999px;
  padding: 0.1rem 0.55rem;
  border: 1px solid var(--border-subtle);
}

/* ── Empty ───────────────────────────────────────────────────────────────── */
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 2.5rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}
.empty-icon {
  font-size: 1.1rem;
  opacity: 0.35;
}

/* ── Entry row ───────────────────────────────────────────────────────────── */
.entry-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1.1rem;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.12s;
}
.entry-row:hover { background: var(--bg-surface); }
.entry-row.last { border-bottom: none; }

.type-badge {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  flex-shrink: 0;
}
.type-badge.pinfl {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
}
.type-badge.inn {
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  color: #b45309;
  border: 1px solid color-mix(in srgb, #f59e0b 30%, transparent);
}

.entry-value {
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.entry-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  overflow: hidden;
}
.entry-reason {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.entry-date {
  font-size: 0.72rem;
  color: var(--text-secondary);
  opacity: 0.7;
  font-weight: 600;
  white-space: nowrap;
}

.remove-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 0.78rem;
  flex-shrink: 0;
  transition: all 0.13s;
}
.remove-btn:hover {
  color: var(--danger);
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}

/* ── Dialog ──────────────────────────────────────────────────────────────── */
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 1rem;
}
.dialog {
  width: 100%;
  max-width: 440px;
  border-radius: 16px;
  overflow: hidden;
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem;
  border-bottom: 1px solid var(--border-subtle);
}
.dialog-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}
.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 0.78rem;
  transition: all 0.12s;
}
.close-btn:hover { color: var(--text-primary); }

.dialog-body {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.optional { text-transform: none; font-weight: 600; opacity: 0.7; }
.field-error {
  font-size: 0.75rem;
  color: var(--danger);
  font-weight: 600;
}
.w-full { width: 100%; }

.type-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.type-opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.7rem;
  border-radius: 10px;
  border: 1.5px solid var(--border-subtle);
  background: var(--bg-surface);
  cursor: pointer;
  font-weight: 800;
  font-size: 0.9rem;
  color: var(--text-secondary);
  transition: all 0.15s;
}
.type-opt.active {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, var(--bg-base));
  color: var(--danger);
}
.type-hint {
  font-size: 0.65rem;
  font-weight: 600;
  opacity: 0.65;
  text-transform: none;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.9rem 1.2rem;
  border-top: 1px solid var(--border-subtle);
}
.btn-ghost {
  padding: 0.5rem 1rem;
  border-radius: 9px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 0.84rem;
  cursor: pointer;
  transition: all 0.13s;
}
.btn-ghost:hover { color: var(--text-primary); border-color: var(--text-secondary); }
.btn-danger-solid {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1.1rem;
  border-radius: 9px;
  border: none;
  background: var(--danger);
  color: #fff;
  font-weight: 700;
  font-size: 0.84rem;
  cursor: pointer;
  transition: opacity 0.13s;
}
.btn-danger-solid:hover { opacity: 0.88; }

/* ── Transition ──────────────────────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 600px) {
  .page-actions { flex-direction: column; align-items: stretch; }
  .search-wrap { max-width: 100%; }
  .entry-row { flex-wrap: wrap; gap: 0.6rem; }
  .entry-meta { width: 100%; }
}
</style>
