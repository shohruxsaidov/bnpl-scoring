<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { FAQ_CATEGORIES, useFaqsStore, type Faq, type FaqCategory } from '@/stores/faqs'

const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const store = useFaqsStore()

// Mirrors db/faqs.ts. Enforced here too so an over-long answer is caught while
// the author still has it in front of them, not after a round trip.
const MAX_QUESTION = 300
const MAX_ANSWER = 4000

function load() {
  return store
    .fetchAll()
    .catch(() => toast.add({ severity: 'error', summary: t('faqs.loadFailed'), life: 3000 }))
}

onMounted(load)

// ── Search ──────────────────────────────────────────────────────────────────
// Searches both languages at once: an admin who remembers the Russian wording of
// an answer should find it without first switching the tab they are looking at.
const search = ref('')
const searching = computed(() => search.value.trim().length > 0)

function matches(f: Faq, q: string) {
  return [f.questionUz, f.questionRu, f.answerUz, f.answerRu].some((v) =>
    v.toLowerCase().includes(q),
  )
}

// ── Grouping and order ───────────────────────────────────────────────────────
// `dragOrder` is a live preview of one category's order while a row is in flight.
// It overrides the server's sortOrder for that category only, and is cleared once
// the move has been persisted (or rolled back).
const dragOrder = ref<{ category: FaqCategory; ids: number[] } | null>(null)
const draggingId = ref<number | null>(null)

function ordered(category: FaqCategory): Faq[] {
  const items = store.faqs
    .filter((f) => f.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)

  const preview = dragOrder.value
  if (preview?.category !== category) return items

  const pos = new Map(preview.ids.map((id, i) => [id, i]))
  return [...items].sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
}

const groups = computed(() => {
  const q = search.value.trim().toLowerCase()
  return FAQ_CATEGORIES.map((category) => {
    const all = ordered(category)
    return { category, items: q ? all.filter((f) => matches(f, q)) : all, total: all.length }
  })
})

const totalShown = computed(() => groups.value.reduce((n, g) => n + g.items.length, 0))

// ── Drag to reorder ──────────────────────────────────────────────────────────
// Disabled while searching: the visible rows are then a subset, so a drop would
// submit a partial id list — which the server rejects outright rather than
// ordering around the gap.
function onDragStart(category: FaqCategory, id: number) {
  draggingId.value = id
  dragOrder.value = { category, ids: ordered(category).map((f) => f.id) }
}

function onDragEnter(category: FaqCategory, targetId: number) {
  const preview = dragOrder.value
  const moving = draggingId.value
  if (!preview || preview.category !== category || moving == null || targetId === moving) return

  const ids = [...preview.ids]
  const from = ids.indexOf(moving)
  const to = ids.indexOf(targetId)
  if (from === -1 || to === -1) return

  ids.splice(to, 0, ids.splice(from, 1)[0]!)
  dragOrder.value = { category, ids }
}

async function onDragEnd() {
  const preview = dragOrder.value
  draggingId.value = null
  if (!preview) return

  const persisted = store.faqs
    .filter((f) => f.category === preview.category)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((f) => f.id)

  // Dropped where it started, or never actually moved — nothing to send.
  if (persisted.length === preview.ids.length && persisted.every((id, i) => id === preview.ids[i])) {
    dragOrder.value = null
    return
  }

  try {
    await store.reorder(preview.category, preview.ids)
  } catch (err) {
    // faq_reorder_mismatch means someone else changed this category while the
    // screen was open. Refetching is the only honest recovery: the order this
    // admin just built was over a list that no longer exists.
    toast.add({
      severity: 'error',
      summary:
        (err as Error).message === 'faq_reorder_mismatch'
          ? t('faqs.reorderStale')
          : t('faqs.saveFailed'),
      life: 4000,
    })
    await load()
  } finally {
    dragOrder.value = null
  }
}

// ── Dialog ───────────────────────────────────────────────────────────────────
const dialogOpen = ref(false)
const dialogMode = ref<'add' | 'edit'>('add')
const editingId = ref<number | null>(null)
const saving = ref(false)
// Which language the form is currently showing. Both are always saved together —
// the tab is a view of one row, not two drafts.
const tab = ref<'uz' | 'ru'>('uz')

const form = ref({
  category: 'general' as FaqCategory,
  questionUz: '',
  questionRu: '',
  answerUz: '',
  answerRu: '',
  isActive: true,
})

const categoryOptions = computed(() =>
  FAQ_CATEGORIES.map((c) => ({ label: t(`faqs.cat.${c}`), value: c })),
)

// Per-tab completeness, so the author can see at a glance that the OTHER
// language is still empty — the save button being disabled otherwise looks like
// a bug when the tab you are on is full.
const uzFilled = computed(() => !!form.value.questionUz.trim() && !!form.value.answerUz.trim())
const ruFilled = computed(() => !!form.value.questionRu.trim() && !!form.value.answerRu.trim())
const canSave = computed(() => uzFilled.value && ruFilled.value)

function openAdd(category?: FaqCategory) {
  dialogMode.value = 'add'
  editingId.value = null
  tab.value = 'uz'
  form.value = {
    category: category ?? 'general',
    questionUz: '',
    questionRu: '',
    answerUz: '',
    answerRu: '',
    isActive: true,
  }
  dialogOpen.value = true
}

function openEdit(f: Faq) {
  dialogMode.value = 'edit'
  editingId.value = f.id
  tab.value = 'uz'
  form.value = {
    category: f.category,
    questionUz: f.questionUz,
    questionRu: f.questionRu,
    answerUz: f.answerUz,
    answerRu: f.answerRu,
    isActive: f.isActive,
  }
  dialogOpen.value = true
}

function closeDialog() {
  dialogOpen.value = false
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    const payload = {
      category: form.value.category,
      questionUz: form.value.questionUz.trim(),
      questionRu: form.value.questionRu.trim(),
      answerUz: form.value.answerUz.trim(),
      answerRu: form.value.answerRu.trim(),
      isActive: form.value.isActive,
    }
    if (dialogMode.value === 'add') {
      await store.create(payload)
      toast.add({ severity: 'success', summary: t('faqs.created'), life: 2500 })
    } else {
      await store.update(editingId.value!, payload)
      toast.add({ severity: 'success', summary: t('faqs.saved'), life: 2500 })
    }
    dialogOpen.value = false
  } catch {
    toast.add({ severity: 'error', summary: t('faqs.saveFailed'), life: 3000 })
  } finally {
    saving.value = false
  }
}

// ── Row actions ──────────────────────────────────────────────────────────────
async function toggleActive(f: Faq) {
  try {
    await store.update(f.id, { isActive: !f.isActive })
  } catch {
    toast.add({ severity: 'error', summary: t('faqs.saveFailed'), life: 3000 })
  }
}

// Permanent, and said so plainly — the reversible option is one button to the
// left, and an admin reaching for the bin usually wants that one instead.
function askDelete(f: Faq) {
  confirm.require({
    header: t('faqs.deleteConfirmTitle'),
    message: t('faqs.deleteConfirmMsg', { question: f.questionRu || f.questionUz }),
    icon: 'pi pi-trash',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('common.delete'), severity: 'danger' },
    accept: async () => {
      try {
        await store.remove(f.id)
        toast.add({ severity: 'info', summary: t('faqs.deleted'), life: 2500 })
      } catch {
        toast.add({ severity: 'error', summary: t('faqs.saveFailed'), life: 3000 })
      }
    },
  })
}
</script>

<template>
  <div class="faq-page">
    <!-- ── Skeleton ────────────────────────────────────────────────────────── -->
    <template v-if="store.loading && !store.loaded">
      <div class="page-actions sk-actions">
        <Skeleton width="14rem" height="2rem" border-radius="10px" />
        <Skeleton width="8rem" height="2rem" border-radius="10px" />
      </div>
      <div v-for="i in 3" :key="i" class="surface-card panel">
        <div class="panel-head">
          <Skeleton width="8rem" height="0.85rem" border-radius="4px" />
          <Skeleton width="2rem" height="0.75rem" border-radius="4px" />
        </div>
        <div v-for="j in 2" :key="j" class="sk-row">
          <Skeleton width="1rem" height="1rem" border-radius="4px" />
          <Skeleton width="18rem" height="0.9rem" border-radius="4px" />
          <div class="sk-row-right">
            <Skeleton width="3rem" height="1.5rem" border-radius="999px" />
            <Skeleton width="1.8rem" height="1.8rem" border-radius="6px" />
          </div>
        </div>
      </div>
    </template>

    <!-- ── Content ─────────────────────────────────────────────────────────── -->
    <template v-else>
      <div class="page-actions">
        <div class="search-wrap">
          <i class="pi pi-search search-icon" />
          <InputText
            v-model="search"
            :placeholder="t('faqs.searchPlaceholder')"
            class="search-input"
          />
        </div>
        <button class="btn-add" @click="openAdd()">
          <i class="pi pi-plus" />
          {{ t('faqs.add') }}
        </button>
      </div>

      <!-- The order of these panels is the admin's dropdown order, NOT what the
           phone shows: the client app owns the section order and their names. -->
      <p class="hint">
        <i class="pi pi-info-circle" />
        {{ searching ? t('faqs.dragDisabledHint') : t('faqs.orderHint') }}
      </p>

      <div v-if="searching && totalShown === 0" class="surface-card empty">
        <i class="pi pi-search empty-icon" />
        <span>{{ t('faqs.noResults') }}</span>
      </div>

      <template v-else>
        <div
          v-for="group in groups"
          v-show="!searching || group.items.length > 0"
          :key="group.category"
          class="surface-card panel"
        >
          <div class="panel-head">
            <h3 class="section-title">{{ t(`faqs.cat.${group.category}`) }}</h3>
            <span class="count-badge">{{ group.total }}</span>
            <button class="add-here" :title="t('faqs.add')" @click="openAdd(group.category)">
              <i class="pi pi-plus" />
            </button>
          </div>

          <div v-if="group.items.length === 0" class="empty small">
            <span>{{ t('faqs.emptyCategory') }}</span>
          </div>

          <div
            v-for="(faq, idx) in group.items"
            :key="faq.id"
            class="faq-row"
            :class="{
              last: idx === group.items.length - 1,
              inactive: !faq.isActive,
              dragging: draggingId === faq.id,
            }"
            :draggable="!searching"
            @dragstart="onDragStart(group.category, faq.id)"
            @dragenter.prevent="onDragEnter(group.category, faq.id)"
            @dragover.prevent
            @dragend="onDragEnd"
          >
            <i
              class="pi pi-bars drag-handle"
              :class="{ disabled: searching }"
              :title="searching ? t('faqs.dragDisabledHint') : t('faqs.dragHint')"
            />

            <div class="faq-text">
              <span class="faq-q">{{ faq.questionRu || faq.questionUz }}</span>
              <span class="faq-a">{{ faq.answerRu || faq.answerUz }}</span>
            </div>

            <div class="row-actions">
              <span class="status-chip" :class="faq.isActive ? 'active' : 'inactive'">
                {{ faq.isActive ? t('common.active') : t('common.inactive') }}
              </span>
              <button class="icon-btn" :title="t('common.edit')" @click="openEdit(faq)">
                <i class="pi pi-pencil" />
              </button>
              <button
                class="icon-btn"
                :title="faq.isActive ? t('faqs.deactivate') : t('faqs.activate')"
                @click="toggleActive(faq)"
              >
                <i :class="faq.isActive ? 'pi pi-eye-slash' : 'pi pi-eye'" />
              </button>
              <button class="icon-btn danger" :title="t('common.delete')" @click="askDelete(faq)">
                <i class="pi pi-trash" />
              </button>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- ── Dialog ──────────────────────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="dialogOpen" class="dialog-backdrop" @mousedown.self="closeDialog">
        <div class="dialog surface-card">
          <div class="dialog-header">
            <h3>{{ dialogMode === 'add' ? t('faqs.add') : t('faqs.edit') }}</h3>
            <button class="close-btn" @click="closeDialog"><i class="pi pi-times" /></button>
          </div>

          <div class="dialog-body">
            <div class="row-2">
              <div class="field">
                <label class="field-label">{{ t('faqs.category') }}</label>
                <Select
                  v-model="form.category"
                  :options="categoryOptions"
                  option-label="label"
                  option-value="value"
                  class="w-full"
                />
              </div>
              <div class="field">
                <label class="field-label">{{ t('common.active') }}</label>
                <div class="toggle-wrap">
                  <ToggleSwitch v-model="form.isActive" />
                  <span class="toggle-hint">{{
                    form.isActive ? t('faqs.visibleHint') : t('faqs.hiddenHint')
                  }}</span>
                </div>
              </div>
            </div>

            <!-- Both languages are required, so the tabs carry a completeness dot:
                 a disabled Save while the visible tab is full reads as a bug. -->
            <div class="lang-tabs">
              <button class="lang-tab" :class="{ on: tab === 'uz' }" @click="tab = 'uz'">
                O'zbekcha
                <i class="pi dot" :class="uzFilled ? 'pi-check-circle ok' : 'pi-circle'" />
              </button>
              <button class="lang-tab" :class="{ on: tab === 'ru' }" @click="tab = 'ru'">
                Русский
                <i class="pi dot" :class="ruFilled ? 'pi-check-circle ok' : 'pi-circle'" />
              </button>
            </div>

            <template v-if="tab === 'uz'">
              <div class="field">
                <label class="field-label">{{ t('faqs.question') }}</label>
                <InputText
                  v-model="form.questionUz"
                  :maxlength="MAX_QUESTION"
                  class="w-full"
                  autofocus
                />
              </div>
              <div class="field">
                <label class="field-label">
                  {{ t('faqs.answer') }}
                  <span class="counter">{{ form.answerUz.length }}/{{ MAX_ANSWER }}</span>
                </label>
                <Textarea v-model="form.answerUz" :maxlength="MAX_ANSWER" rows="7" class="w-full" />
              </div>
            </template>

            <template v-else>
              <div class="field">
                <label class="field-label">{{ t('faqs.question') }}</label>
                <InputText v-model="form.questionRu" :maxlength="MAX_QUESTION" class="w-full" />
              </div>
              <div class="field">
                <label class="field-label">
                  {{ t('faqs.answer') }}
                  <span class="counter">{{ form.answerRu.length }}/{{ MAX_ANSWER }}</span>
                </label>
                <Textarea v-model="form.answerRu" :maxlength="MAX_ANSWER" rows="7" class="w-full" />
              </div>
            </template>

            <!-- The one formatting rule the author has to know. -->
            <p class="plain-note">
              <i class="pi pi-info-circle" />
              {{ t('faqs.plainTextHint') }}
            </p>
          </div>

          <div class="dialog-footer">
            <span v-if="!canSave" class="footer-warn">{{ t('faqs.bothLanguagesRequired') }}</span>
            <button class="btn-ghost" @click="closeDialog">{{ t('common.cancel') }}</button>
            <button class="btn-primary" :disabled="saving || !canSave" @click="save">
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
.faq-page {
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
.search-input { padding-left: 2.1rem; min-width: 260px; }

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

.hint {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: -0.35rem 0 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

/* ── Panel ────────────────────────────────────────────────────────────────── */
.panel { overflow: hidden; }
.panel-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1.25rem;
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
.add-here {
  margin-left: auto;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 0.72rem;
}
.add-here:hover { border-color: var(--accent); color: var(--accent); }

/* ── Rows ─────────────────────────────────────────────────────────────────── */
.faq-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.7rem 1.25rem;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.12s, opacity 0.12s;
}
.faq-row:hover { background: var(--bg-base); }
.faq-row.last { border-bottom: none; }
.faq-row.inactive { opacity: 0.55; }
.faq-row.dragging { opacity: 0.4; background: color-mix(in srgb, var(--accent) 8%, transparent); }

.drag-handle { color: var(--text-secondary); font-size: 0.85rem; cursor: grab; flex-shrink: 0; }
.drag-handle.disabled { opacity: 0.3; cursor: not-allowed; }

.faq-text { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; min-width: 0; }
.faq-q { font-size: 0.87rem; font-weight: 600; color: var(--text-primary); }
.faq-a {
  font-size: 0.76rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }

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
.icon-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.icon-btn.danger:hover {
  border-color: var(--danger);
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}

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
.empty.small { padding: 1.1rem 1rem; font-size: 0.78rem; }
.empty-icon { font-size: 2rem; opacity: 0.35; }

/* ── Dialog ───────────────────────────────────────────────────────────────── */
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: grid;
  place-items: center;
  z-index: 100;
}
.dialog {
  width: min(640px, 94vw);
  max-height: 92vh;
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

.dialog-body {
  padding: 1.25rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}
.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-label {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.counter { margin-left: auto; font-size: 0.68rem; font-weight: 500; text-transform: none; letter-spacing: 0; }
.toggle-wrap { display: flex; align-items: center; gap: 0.6rem; height: 2.4rem; }
.toggle-hint { font-size: 0.75rem; color: var(--text-secondary); }
.w-full { width: 100%; }

.lang-tabs { display: flex; gap: 0.4rem; border-bottom: 1px solid var(--border-subtle); }
.lang-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  margin-bottom: -1px;
}
.lang-tab.on { color: var(--accent); border-bottom-color: var(--accent); }
.lang-tab .dot { font-size: 0.7rem; opacity: 0.5; }
.lang-tab .dot.ok { color: var(--success); opacity: 1; }

.plain-note {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.4;
  color: var(--text-secondary);
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  padding: 0.9rem 1.4rem;
  border-top: 1px solid var(--border-subtle);
}
.footer-warn { margin-right: auto; font-size: 0.75rem; color: var(--warning, var(--text-secondary)); }
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

@media (max-width: 640px) {
  .row-2 { grid-template-columns: 1fr; }
  .faq-a { display: none; }
}
</style>
