<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useBannersStore, type Banner } from '@/stores/banners'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const store = useBannersStore()

// Past this many live slides nobody swipes to the end, and the API stops serving
// at 10 regardless — better to say so here than to let someone build an eleventh.
const CROWDED_AT = 5

onMounted(load)

async function load() {
  await store
    .fetchAll()
    .catch(() => toast.add({ severity: 'error', summary: t('banners.loadFailed'), life: 3000 }))
}

async function toggleInactive() {
  store.includeInactive = !store.includeInactive
  await load()
}

const liveCount = computed(() => store.banners.filter((b) => b.isLive).length)

type BannerState = 'live' | 'scheduled' | 'expired' | 'inactive'

// isLive is the server's answer; the other three only distinguish WHY a banner
// is not live, which is the thing an admin looking at a dark row wants to know.
function stateOf(b: Banner): BannerState {
  if (!b.isActive) return 'inactive'
  if (b.isLive) return 'live'
  if (b.startsAt && new Date(b.startsAt) > new Date()) return 'scheduled'
  return 'expired'
}

function actionSummary(b: Banner): string {
  if (b.actionType === 'none') return t('banners.actionNone')
  if (b.actionType === 'external_url') return b.actionValue ?? '—'
  return t('banners.actionMerchantId', { id: b.actionValue ?? '—' })
}

function formatWindow(b: Banner): string {
  if (!b.startsAt && !b.endsAt) return t('banners.windowAlways')
  const from = b.startsAt ? formatDate(b.startsAt) : '…'
  const to = b.endsAt ? formatDate(b.endsAt) : '…'
  return `${from} → ${to}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function open(b: Banner) {
  router.push({ name: 'banner-detail', params: { id: String(b.id) } })
}

function deactivate(b: Banner) {
  confirm.require({
    message: t('banners.deactivateConfirmMsg', { title: b.title }),
    header: t('banners.deactivateConfirmTitle'),
    icon: 'pi pi-eye-slash',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('banners.deactivate'), severity: 'danger' },
    accept: async () => {
      try {
        await store.setActive(b.id, false)
        // The row leaves the default view entirely, so say where it went.
        if (!store.includeInactive) await load()
        toast.add({ severity: 'info', summary: t('banners.deactivated'), life: 2500 })
      } catch {
        toast.add({ severity: 'error', summary: t('banners.saveFailed'), life: 3000 })
      }
    },
  })
}

async function activate(b: Banner) {
  try {
    await store.setActive(b.id, true)
    toast.add({ severity: 'success', summary: t('banners.activated'), life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: t('banners.saveFailed'), life: 3000 })
  }
}

/* ── Reordering ─────────────────────────────────────────────────────────────
 * Moving a banner renumbers the whole displayed list 0..n-1 and PATCHes only the
 * rows whose number actually changed. Renumbering rather than swapping is what
 * keeps this predictable: sort_order values drift (everything starts at 0), and
 * a swap between two rows that both hold 0 would visibly do nothing.
 *
 * Disabled while inactive banners are shown, because the displayed order then
 * includes rows a client never sees — renumbering from that view would reshuffle
 * the live carousel to match a list that isn't it.
 */
const reordering = ref(false)
const canReorder = computed(() => !store.includeInactive && !reordering.value)

async function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= store.banners.length) return

  const next = [...store.banners]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)

  reordering.value = true
  try {
    const changed = next
      .map((b, i) => ({ b, i }))
      .filter(({ b, i }) => b.sortOrder !== i)
    await Promise.all(changed.map(({ b, i }) => store.update(b.id, { sortOrder: i })))
    await load()
  } catch {
    toast.add({ severity: 'error', summary: t('banners.saveFailed'), life: 3000 })
    await load()
  } finally {
    reordering.value = false
  }
}
</script>

<template>
  <div class="banners-page">
    <!-- ── toolbar ─────────────────────────────────────────────────────────── -->
    <div class="page-actions">
      <label class="inactive-toggle">
        <ToggleSwitch :model-value="store.includeInactive" @update:model-value="toggleInactive" />
        <span>{{ t('banners.showInactive') }}</span>
      </label>
      <button class="btn-add" @click="router.push({ name: 'banner-new' })">
        <i class="pi pi-plus" />
        {{ t('banners.create') }}
      </button>
    </div>

    <!-- ── skeleton ────────────────────────────────────────────────────────── -->
    <template v-if="store.loading && !store.loaded">
      <div v-for="i in 3" :key="i" class="surface-card row sk-row">
        <Skeleton width="9rem" height="4.5rem" border-radius="10px" />
        <div class="sk-lines">
          <Skeleton width="12rem" height="0.9rem" border-radius="4px" />
          <Skeleton width="18rem" height="0.75rem" border-radius="4px" />
        </div>
      </div>
    </template>

    <template v-else>
      <p v-if="liveCount > CROWDED_AT" class="crowded-note">
        <i class="pi pi-info-circle" />
        {{ t('banners.crowded', { n: liveCount }) }}
      </p>

      <div v-if="!store.banners.length" class="surface-card empty-card">
        <i class="pi pi-images" />
        <p>{{ t('banners.empty') }}</p>
      </div>

      <!-- ── list ──────────────────────────────────────────────────────────── -->
      <div
        v-for="(b, i) in store.banners"
        :key="b.id"
        class="surface-card row"
        :class="{ dim: !b.isLive }"
      >
        <div class="order-col">
          <button
            class="icon-btn"
            :disabled="i === 0 || !canReorder"
            :title="t('banners.moveUp')"
            @click="move(i, -1)"
          >
            <i class="pi pi-chevron-up" />
          </button>
          <span class="order-num">{{ b.sortOrder }}</span>
          <button
            class="icon-btn"
            :disabled="i === store.banners.length - 1 || !canReorder"
            :title="t('banners.moveDown')"
            @click="move(i, 1)"
          >
            <i class="pi pi-chevron-down" />
          </button>
        </div>

        <!-- UZ art, in the exact 2:1 box the phone uses -->
        <button class="thumb" @click="open(b)">
          <img :src="b.imageUrlUz" :alt="b.title" loading="lazy" />
        </button>

        <div class="meta" @click="open(b)">
          <div class="meta-head">
            <span class="title">{{ b.title }}</span>
            <span class="chip" :class="stateOf(b)">{{ t(`banners.state.${stateOf(b)}`) }}</span>
          </div>
          <div class="meta-line">
            <i class="pi pi-link" />
            <span class="ellipsis">{{ actionSummary(b) }}</span>
          </div>
          <div class="meta-line">
            <i class="pi pi-calendar" />
            <span>{{ formatWindow(b) }}</span>
          </div>
        </div>

        <div class="stats">
          <div class="views">
            <span class="views-num">{{ b.viewCount }}</span>
            <span class="views-label">{{ t('banners.views') }}</span>
          </div>
          <div class="row-actions">
            <button class="icon-btn" :title="t('common.edit')" @click="open(b)">
              <i class="pi pi-pencil" />
            </button>
            <button
              v-if="b.isActive"
              class="icon-btn danger"
              :title="t('banners.deactivate')"
              @click="deactivate(b)"
            >
              <i class="pi pi-eye-slash" />
            </button>
            <button v-else class="icon-btn" :title="t('banners.activate')" @click="activate(b)">
              <i class="pi pi-eye" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.banners-page {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.page-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.inactive-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
}
.crowded-note {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.7rem 0.9rem;
}
.row.dim {
  opacity: 0.62;
}
.sk-row {
  gap: 1rem;
}
.sk-lines {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.order-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}
.order-num {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
}
.thumb {
  flex-shrink: 0;
  width: 9.5rem;
  aspect-ratio: 2 / 1;
  border: 1px solid var(--border-subtle);
  border-radius: 0.6rem;
  overflow: hidden;
  padding: 0;
  background: none;
  cursor: pointer;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  cursor: pointer;
}
.meta-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.title {
  font-weight: 700;
  font-size: 0.9rem;
}
.meta-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
  min-width: 0;
}
.meta-line .pi {
  font-size: 0.72rem;
}
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
}
.chip.live {
  color: #16a34a;
  background: color-mix(in srgb, #16a34a 14%, transparent);
}
.chip.scheduled {
  color: #d97706;
  background: color-mix(in srgb, #d97706 14%, transparent);
}
.chip.expired,
.chip.inactive {
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--text-secondary) 12%, transparent);
}
.stats {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.views {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 3rem;
}
.views-num {
  font-size: 1rem;
  font-weight: 700;
}
.views-label {
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}
.row-actions {
  display: flex;
  gap: 0.3rem;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.icon-btn:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--accent-1);
}
.icon-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.icon-btn.danger:hover {
  color: #dc2626;
  border-color: #dc2626;
}
.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  color: var(--text-secondary);
}
.empty-card .pi {
  font-size: 1.6rem;
}
.empty-card p {
  margin: 0;
  font-size: 0.85rem;
}
@media (max-width: 720px) {
  .row {
    flex-wrap: wrap;
  }
  .thumb {
    width: 7rem;
  }
  .stats {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
