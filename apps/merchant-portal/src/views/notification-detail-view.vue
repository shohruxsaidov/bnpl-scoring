<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Skeleton from 'primevue/skeleton'
import { useNotificationsStore, type NotificationType } from '@/stores/notifications'
import { usePageLoad } from '@/composables/use-page-load'

const { loading } = usePageLoad(500)

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const store = useNotificationsStore()

const notification = computed(() => store.getById(route.params.id as string))

const currentIndex = computed(() =>
  store.items.findIndex((n) => n.id === route.params.id),
)
const prevId = computed(() => store.items[currentIndex.value - 1]?.id)
const nextId = computed(() => store.items[currentIndex.value + 1]?.id)

const iconMap: Record<NotificationType, string> = {
  deal_approved: 'pi pi-check-circle',
  deal_declined: 'pi pi-times-circle',
  payment_received: 'pi pi-credit-card',
  overdue: 'pi pi-exclamation-triangle',
  scoring_complete: 'pi pi-chart-line',
  new_deal: 'pi pi-plus-circle',
  admin_message: 'pi pi-megaphone',
}
const colorMap: Record<NotificationType, string> = {
  deal_approved: 'var(--success)',
  deal_declined: 'var(--danger)',
  payment_received: 'var(--accent-2)',
  overdue: '#f59e0b',
  scoring_complete: 'var(--accent-2)',
  new_deal: 'var(--success)',
  admin_message: 'var(--accent-2)',
}

type ParamMeta = { labelKey: string; icon: string; value: string }

const paramMeta = computed<ParamMeta[]>(() => {
  const n = notification.value
  if (!n) return []
  const p = n.params
  const rows: ParamMeta[] = []
  if (p.clientName) rows.push({ labelKey: 'notifDetail.client', icon: 'pi pi-user', value: p.clientName })
  if (p.agentName) rows.push({ labelKey: 'notifDetail.agent', icon: 'pi pi-user-plus', value: p.agentName })
  if (p.dealId) rows.push({ labelKey: 'notifDetail.deal', icon: 'pi pi-file', value: p.dealId })
  if (p.score) rows.push({ labelKey: 'notifDetail.score', icon: 'pi pi-chart-line', value: p.score })
  if (p.amount) rows.push({ labelKey: 'notifDetail.amount', icon: 'pi pi-wallet', value: `${p.amount} ${t('common.som')}` })
  if (p.days) rows.push({ labelKey: 'notifDetail.overdueDays', icon: 'pi pi-clock', value: `${p.days} ${t('notifDetail.days')}` })
  return rows
})

const fullDate = computed(() => {
  const n = notification.value
  if (!n) return ''
  return new Date(n.createdAt).toLocaleString('uz-UZ', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

function markReadAndOpen() {
  const n = notification.value
  if (!n) return
  store.markRead(n.id)
  router.push(`/deals/${n.dealId}`)
}

function navigate(id: string) {
  if (!notification.value?.read) store.markRead(notification.value!.id)
  router.push(`/notifications/${id}`)
}

watch(loading, (val) => {
  if (!val && notification.value && !notification.value.read) {
    store.markRead(notification.value.id)
  }
})
</script>

<template>
  <div class="detail-page">
    <!-- skeleton -->
    <template v-if="loading">
      <div class="nav-row">
        <Skeleton width="7rem" height="1.8rem" border-radius="8px" />
        <Skeleton width="7rem" height="1.8rem" border-radius="8px" />
      </div>
      <div class="card surface-card">
        <div class="sk-hero">
          <Skeleton shape="circle" size="3.5rem" />
          <div class="sk-hero-meta">
            <Skeleton width="12rem" height="1.1rem" border-radius="6px" />
            <Skeleton width="5rem" height="1.4rem" border-radius="999px" />
          </div>
        </div>
        <div class="sk-section">
          <Skeleton width="100%" height="0.9rem" border-radius="4px" />
          <Skeleton width="85%" height="0.9rem" border-radius="4px" />
          <Skeleton width="60%" height="0.9rem" border-radius="4px" />
        </div>
        <div class="sk-divider" />
        <div class="sk-section">
          <Skeleton width="4rem" height="0.65rem" border-radius="4px" />
          <div v-for="i in 3" :key="i" class="sk-param-row">
            <Skeleton width="1.8rem" height="1.8rem" border-radius="8px" />
            <div class="sk-param-body">
              <Skeleton width="4rem" height="0.6rem" border-radius="4px" />
              <Skeleton width="7rem" height="0.85rem" border-radius="4px" />
            </div>
          </div>
        </div>
        <div class="sk-divider" />
        <div class="sk-section sk-row">
          <Skeleton width="1.2rem" height="1.2rem" border-radius="4px" />
          <Skeleton width="14rem" height="0.8rem" border-radius="4px" />
        </div>
        <div class="sk-cta">
          <Skeleton width="100%" height="2.6rem" border-radius="10px" />
        </div>
      </div>
    </template>

    <!-- not found -->
    <div v-else-if="!notification" class="not-found surface-card">
      <i class="pi pi-bell-slash" />
      <p>{{ t('notifDetail.notFound') }}</p>
      <button class="btn-back" @click="router.push('/notifications')">
        <i class="pi pi-arrow-left" /> {{ t('notifDetail.backToList') }}
      </button>
    </div>

    <template v-else-if="notification">
      <!-- back + navigation row -->
      <div class="nav-row">
        <button class="btn-ghost" @click="router.push('/notifications')">
          <i class="pi pi-arrow-left" />
          {{ t('notifDetail.backToList') }}
        </button>
        <div class="pager">
          <button class="pager-btn" :disabled="!prevId" @click="prevId && navigate(prevId)">
            <i class="pi pi-angle-left" />
          </button>
          <span class="pager-pos">{{ currentIndex + 1 }} / {{ store.items.length }}</span>
          <button class="pager-btn" :disabled="!nextId" @click="nextId && navigate(nextId)">
            <i class="pi pi-angle-right" />
          </button>
        </div>
      </div>

      <!-- main card -->
      <div class="card surface-card">
        <!-- hero header -->
        <div class="hero" :style="{ '--type-color': colorMap[notification.type] }">
          <div class="hero-icon">
            <i :class="iconMap[notification.type]" />
          </div>
          <div class="hero-meta">
            <div class="type-label">{{ t(notification.titleKey) }}</div>
            <span class="read-chip" :class="notification.read ? 'read' : 'unread'">
              <i :class="notification.read ? 'pi pi-check' : 'pi pi-circle-fill'" />
              {{ notification.read ? t('notifDetail.read') : t('notifDetail.unread') }}
            </span>
          </div>
        </div>

        <!-- body message -->
        <div class="section">
          <p class="message">{{ t(notification.bodyKey, notification.params) }}</p>
        </div>

        <div class="divider-line" />

        <!-- params grid -->
        <div class="section">
          <div class="section-label">{{ t('notifDetail.details') }}</div>
          <div class="params-grid">
            <div v-for="row in paramMeta" :key="row.labelKey" class="param-row">
              <div class="param-icon">
                <i :class="row.icon" />
              </div>
              <div class="param-content">
                <span class="param-label">{{ t(row.labelKey) }}</span>
                <span class="param-value font-mono">{{ row.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="divider-line" />

        <!-- timestamp -->
        <div class="section timestamp-row">
          <i class="pi pi-calendar" />
          <span class="timestamp">{{ fullDate }}</span>
        </div>

        <!-- CTA -->
        <div v-if="notification.dealId" class="cta-row">
          <button class="btn-gradient cta-btn" @click="markReadAndOpen">
            <i class="pi pi-external-link" />
            {{ t('notifDetail.openDeal', { id: notification.dealId }) }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* skeleton */
.sk-hero {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.6rem;
  border-bottom: 1px solid var(--border-subtle);
}
.sk-hero-meta { display: flex; flex-direction: column; gap: 0.6rem; }
.sk-section {
  padding: 1.2rem 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.sk-row { flex-direction: row; align-items: center; gap: 0.6rem; }
.sk-divider { height: 1px; background: var(--border-subtle); margin: 0 1.6rem; }
.sk-param-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.7rem;
  background: var(--bg-surface);
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  margin-top: 0.15rem;
}
.sk-param-body { display: flex; flex-direction: column; gap: 0.3rem; }
.sk-cta { padding: 0 1.6rem 1.6rem; }

.detail-page {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  max-width: 640px;
}

/* ── not found ─────────────────────────────────────── */
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  text-align: center;
  color: var(--text-secondary);
}
.not-found i {
  font-size: 2.5rem;
  opacity: 0.3;
}

/* ── nav row ────────────────────────────────────────── */
.nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  transition: color 0.15s, background 0.15s;
}
.btn-ghost:hover {
  color: var(--text-primary);
  background: var(--bg-surface);
}
.pager {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.pager-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.15s;
}
.pager-btn:hover:not(:disabled) {
  color: var(--accent-2);
  border-color: var(--accent-2);
}
.pager-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.pager-pos {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  padding: 0 0.4rem;
}

/* ── main card ─────────────────────────────────────── */
.card {
  border-radius: 16px;
  overflow: hidden;
}

/* hero */
.hero {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  padding: 1.6rem 1.6rem 1.4rem;
  background: color-mix(in srgb, var(--type-color) 8%, var(--bg-surface));
  border-bottom: 1px solid color-mix(in srgb, var(--type-color) 15%, var(--border-subtle));
}
.hero-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--type-color) 15%, var(--bg-base));
  border: 1px solid color-mix(in srgb, var(--type-color) 25%, transparent);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--type-color);
  font-size: 1.5rem;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--type-color) 20%, transparent);
}
.hero-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.type-label {
  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1.2;
}
.read-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
}
.read-chip.unread {
  background: color-mix(in srgb, var(--accent-2) 12%, transparent);
  color: var(--accent-2);
}
.read-chip.read {
  background: var(--bg-surface);
  color: var(--text-secondary);
}
.read-chip i {
  font-size: 0.62rem;
}

/* sections */
.section {
  padding: 1.2rem 1.6rem;
}
.message {
  font-size: 0.95rem;
  line-height: 1.65;
  color: var(--text-primary);
  margin: 0;
}
.divider-line {
  height: 1px;
  background: var(--border-subtle);
  margin: 0 1.6rem;
}
.section-label {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  opacity: 0.6;
  margin-bottom: 0.9rem;
}

/* params */
.params-grid {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.param-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.8rem;
  background: var(--bg-surface);
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
}
.param-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--bg-base);
  display: grid;
  place-items: center;
  color: var(--accent-2);
  font-size: 0.85rem;
  flex-shrink: 0;
}
.param-content {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.param-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.param-value {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* timestamp */
.timestamp-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
}
.timestamp-row i {
  opacity: 0.5;
}
.timestamp {
  font-weight: 600;
}

/* CTA */
.cta-row {
  padding: 0 1.6rem 1.6rem;
}
.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  justify-content: center;
}

/* back btn */
.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  margin-top: 0.5rem;
}

@media (max-width: 600px) {
  .hero {
    padding: 1.2rem;
  }
  .section {
    padding: 1rem 1.2rem;
  }
  .divider-line {
    margin: 0 1.2rem;
  }
  .cta-row {
    padding: 0 1.2rem 1.2rem;
  }
}
</style>
