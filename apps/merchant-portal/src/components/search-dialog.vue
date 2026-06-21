<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()

const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement>()

const allItems = computed(() => [
  { label: t('nav.dashboard'),      icon: 'pi pi-th-large',    to: '/',                  group: 'main',  show: true },
  { label: t('nav.deals'),          icon: 'pi pi-briefcase',   to: '/deals',             group: 'main',  show: auth.can('view_deals') },
  { label: t('nav.newDeal'),        icon: 'pi pi-plus-circle', to: '/deals/create',      group: 'main',  show: auth.can('create_deal') },
  { label: t('nav.products'),       icon: 'pi pi-box',         to: '/admin/products',    group: 'admin', show: auth.can('manage_products') },
  { label: t('nav.categories'),     icon: 'pi pi-tags',        to: '/admin/categories',  group: 'admin', show: auth.can('manage_categories') },
  { label: t('nav.branches'),       icon: 'pi pi-map-marker',  to: '/admin/branches',    group: 'admin', show: auth.can('manage_branches') },
  { label: t('nav.employees'),      icon: 'pi pi-users',       to: '/admin/employees',   group: 'admin', show: auth.can('manage_employees') },
  { label: t('nav.tariffs'),        icon: 'pi pi-percentage',  to: '/admin/tariffs',     group: 'admin', show: auth.can('manage_tariffs') },
].filter((i) => i.show))

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? allItems.value.filter((i) => i.label.toLowerCase().includes(q)) : allItems.value
})

const grouped = computed(() => {
  const map: Record<string, { groupLabel: string; items: typeof filtered.value }> = {}
  for (const item of filtered.value) {
    if (!map[item.group]) {
      map[item.group] = {
        groupLabel: item.group === 'admin' ? t('search.groupAdmin') : t('search.groupMain'),
        items: [],
      }
    }
    map[item.group].items.push(item)
  }
  return Object.values(map)
})

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      query.value = ''
      activeIndex.value = 0
      await nextTick()
      inputRef.value?.focus()
    }
  },
)

watch(query, () => { activeIndex.value = 0 })

function close() { emit('update:visible', false) }

function select(to: string) {
  router.push(to)
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { close(); return }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, filtered.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    const item = filtered.value[activeIndex.value]
    if (item) select(item.to)
  }
}

function highlight(text: string): string {
  const q = query.value.trim()
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return text
  return (
    text.slice(0, idx) +
    '<mark>' +
    text.slice(idx, idx + q.length) +
    '</mark>' +
    text.slice(idx + q.length)
  )
}

function flatIndex(item: (typeof filtered.value)[number]) {
  return filtered.value.indexOf(item)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sp">
      <div v-if="visible" class="sp-overlay" @click.self="close">
        <div class="sp-modal" role="dialog" aria-modal="true" @keydown="onKeydown">
          <!-- Input row -->
          <div class="sp-input-row">
            <i class="pi pi-search sp-icon" />
            <input
              ref="inputRef"
              v-model="query"
              class="sp-input"
              :placeholder="$t('search.placeholder')"
              @keydown="onKeydown"
            />
            <button v-if="query" class="sp-clear" @click="query = ''">
              <i class="pi pi-times" />
            </button>
          </div>

          <!-- Results -->
          <div class="sp-body">
            <template v-if="grouped.length">
              <div v-for="group in grouped" :key="group.groupLabel" class="sp-group">
                <div class="sp-group-label">{{ group.groupLabel }}</div>
                <button
                  v-for="item in group.items"
                  :key="item.to"
                  class="sp-item"
                  :class="{ active: flatIndex(item) === activeIndex }"
                  @mouseenter="activeIndex = flatIndex(item)"
                  @click="select(item.to)"
                >
                  <span class="sp-item-icon"><i :class="item.icon" /></span>
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <span class="sp-item-label" v-html="highlight(item.label)" />
                  <i class="pi pi-arrow-return-left sp-enter" />
                </button>
              </div>
            </template>
            <div v-else class="sp-empty">
              <i class="pi pi-search" />
              {{ $t('search.noResults', { q: query }) }}
            </div>
          </div>

          <!-- Footer -->
          <div class="sp-footer">
            <span class="sp-hint"><kbd>↵</kbd> {{ $t('search.hintSelect') }}</span>
            <span class="sp-hint"><kbd>↑</kbd><kbd>↓</kbd> {{ $t('search.hintNavigate') }}</span>
            <span class="sp-hint"><kbd>esc</kbd> {{ $t('search.hintClose') }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sp-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
}

.sp-modal {
  width: 100%;
  max-width: 580px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 18px;
  box-shadow: var(--sh-xl);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Input ───────────────────────────────────────────────────────────────── */
.sp-input-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.sp-icon {
  font-size: 1rem;
  color: var(--accent-1);
  flex-shrink: 0;
}

.sp-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-primary);
  min-width: 0;
}

.sp-input::placeholder { color: var(--text-muted); }

.sp-clear {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-hover);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 0.7rem;
  flex-shrink: 0;
  transition: all 0.12s;
}
.sp-clear:hover { color: var(--text-primary); border-color: var(--border-default); }

/* ── Body / Results ──────────────────────────────────────────────────────── */
.sp-body {
  max-height: 380px;
  overflow-y: auto;
  padding: 0.5rem;
}

.sp-group { margin-bottom: 0.4rem; }

.sp-group-label {
  padding: 0.5rem 0.75rem 0.3rem;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-1);
}

.sp-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.sp-item.active {
  background: var(--gradient-accent);
  color: #fff;
}

.sp-item-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--bg-hover);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 0.9rem;
  color: var(--accent-1);
  transition: background 0.1s, color 0.1s;
}

.sp-item.active .sp-item-icon {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.sp-item-label {
  flex: 1;
  font-size: 0.92rem;
  font-weight: 600;
}

.sp-item-label :deep(mark) {
  background: transparent;
  color: var(--accent-3);
  font-weight: 800;
}

.sp-item.active .sp-item-label :deep(mark) {
  color: #fff;
  text-decoration: underline;
}

.sp-enter {
  font-size: 0.75rem;
  opacity: 0;
  transition: opacity 0.1s;
  flex-shrink: 0;
}
.sp-item.active .sp-enter { opacity: 1; }

.sp-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 2.5rem 1rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.sp-footer {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 0.6rem 1rem;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-deep);
}

.sp-hint {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 600;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  border: 1px solid var(--border-default);
  background: var(--bg-hover);
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-family: inherit;
  line-height: 1.4;
}

/* ── Transition ──────────────────────────────────────────────────────────── */
.sp-enter-active,
.sp-leave-active {
  transition: opacity 0.15s var(--ease);
}
.sp-enter-active .sp-modal,
.sp-leave-active .sp-modal {
  transition: transform 0.15s var(--ease), opacity 0.15s var(--ease);
}
.sp-enter-from,
.sp-leave-to {
  opacity: 0;
}
.sp-enter-from .sp-modal,
.sp-leave-to .sp-modal {
  transform: translateY(-12px);
  opacity: 0;
}

@media (max-width: 640px) {
  .sp-overlay { padding-top: 0; align-items: flex-end; }
  .sp-modal { border-radius: 18px 18px 0 0; max-width: 100%; }
  .sp-footer { gap: 0.8rem; flex-wrap: wrap; }
}
</style>
