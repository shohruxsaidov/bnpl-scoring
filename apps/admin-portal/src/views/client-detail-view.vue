<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { useClientsStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'
import MonoAmount from '@/components/mono-amount.vue'
import StatusBadge from '@/components/status-badge.vue'
import { formatDate, formatDateTime } from '@/utils/money'
import type { ClientNotificationRow } from '@/types'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const store = useClientsStore()
const auth = useAuthStore()

const clientId = route.params.id as string

const tabs = ['Overview', 'Deals', 'Scoring', 'Payments', 'Notifications'] as const
type Tab = (typeof tabs)[number]

const activeTab = ref<Tab>('Overview')

const TAB_LABEL_KEYS: Record<Tab, string> = {
  Overview: 'clientDetail.tabOverview',
  Deals: 'clientDetail.tabDeals',
  Scoring: 'clientDetail.tabScoring',
  Payments: 'clientDetail.tabPayments',
  Notifications: 'clientDetail.tabNotifications',
}

function tabLabel(tab: Tab): string {
  return t(TAB_LABEL_KEYS[tab])
}

onMounted(() => store.fetchDetail(clientId))

watch(activeTab, (tab) => {
  if (tab === 'Deals') store.fetchDetailDeals(clientId)
  else if (tab === 'Scoring') store.fetchDetailScoring(clientId)
  else if (tab === 'Payments') store.fetchDetailPayments(clientId)
  else if (tab === 'Notifications') store.fetchDetailNotifications(clientId)
})

// ── Send push ───────────────────────────────────────────────────────────────
const TITLE_MAX = 120
const BODY_MAX = 500

const canSendPush = computed(() => auth.can('send_client_push'))

const pushOpen = ref(false)
const sending = ref(false)
const pushLang = ref<'ru' | 'uz'>('ru')
const pushError = ref('')
const pushForm = ref({ titleRu: '', titleUz: '', bodyRu: '', bodyUz: '' })

// Minted once per opened dialog, not per click: a double-clicked Send replays the
// same key and the backend collapses it to a single push. Reopening mints a new
// one, so a deliberate resend still goes through.
const idempotencyKey = ref('')

function openPush() {
  pushForm.value = { titleRu: '', titleUz: '', bodyRu: '', bodyUz: '' }
  pushLang.value = 'ru'
  pushError.value = ''
  idempotencyKey.value = crypto.randomUUID()
  pushOpen.value = true
}

function closePush() {
  if (sending.value) return
  pushOpen.value = false
}

// Both languages are mandatory — the push worker renders per device language, so
// a blank Uzbek title would reach an Uzbek-language phone as an empty push.
const pushIncomplete = computed(() =>
  Object.values(pushForm.value).some((v) => v.trim() === ''),
)

async function submitPush() {
  if (pushIncomplete.value) {
    pushError.value = t('clientDetail.pushAllFieldsRequired')
    return
  }

  sending.value = true
  pushError.value = ''
  try {
    const { deviceCount } = await store.sendPush(clientId, {
      titleRu: pushForm.value.titleRu.trim(),
      titleUz: pushForm.value.titleUz.trim(),
      bodyRu: pushForm.value.bodyRu.trim(),
      bodyUz: pushForm.value.bodyUz.trim(),
      idempotencyKey: idempotencyKey.value,
    })
    toast.add({
      severity: 'success',
      summary: t('clientDetail.pushSent', { n: deviceCount }),
      life: 3000,
    })
    pushOpen.value = false
    activeTab.value = 'Notifications'
  } catch (e) {
    // The backend refuses up front when it knows the push cannot land, so these
    // are real, actionable states — not generic failures.
    const code = (e as Error).message
    pushError.value =
      code === 'no_push_devices' ? t('clientDetail.pushNoDevices')
      : code === 'push_disabled' ? t('clientDetail.pushDisabled')
      : t('clientDetail.pushFailed')
  } finally {
    sending.value = false
  }
}

// ── Notifications tab ───────────────────────────────────────────────────────
// The API renders title/body for every type now, so there is nothing to build
// here — the type label is only a fallback for a row the server could not render.
function notificationTitle(row: ClientNotificationRow): string {
  return row.title || t(`clientDetail.notifType_${row.type}`)
}

function goToDeals(dealId: string) {
  router.push(`/deals/${dealId}`)
}

function sourceLabel(source: 'wizard' | 'self-service' | null): string {
  if (source === 'wizard') return t('clientDetail.sourceWizard')
  if (source === 'self-service') return t('clientDetail.sourceSelfService')
  return '—'
}

function decisionSeverity(decision: string): 'success' | 'danger' | 'warn' {
  if (decision === 'approved') return 'success'
  if (decision === 'declined') return 'danger'
  return 'warn'
}

function decisionLabel(decision: string): string {
  return t(`clientDetail.decision_${decision}`, decision)
}

function paymentStatusColor(status: string): string {
  if (status === 'paid') return 'var(--success)'
  if (status === 'partial') return 'var(--warning, #f59e0b)'
  return 'var(--danger)'
}

function paymentStatusBg(status: string): string {
  if (status === 'paid') return 'var(--success-bg)'
  if (status === 'partial') return 'color-mix(in srgb, #f59e0b 12%, transparent)'
  return 'var(--danger-bg)'
}
</script>

<template>
  <div v-if="store.detailLoading" class="loading-state surface-card">
    <i class="pi pi-spin pi-spinner" />
  </div>

  <div v-else-if="store.detail" class="detail">
    <button class="back" @click="router.push('/clients')">
      <i class="pi pi-arrow-left" /> {{ $t('clientDetail.backToClients') }}
    </button>

    <!-- Header -->
    <header class="c-header surface-card">
      <div class="c-id">
        <div class="c-avatar">{{ store.detail.fullName.charAt(0) }}</div>
        <div>
          <h2 class="c-name">{{ store.detail.fullName }}</h2>
          <span v-if="store.detail.middleName" class="c-slug muted">{{ store.detail.middleName }}</span>
          <span class="c-slug font-mono">
            {{ $t('clientDetail.pinfl') }}: {{ store.detail.pinfl }}
            · {{ store.detail.phone }}
          </span>
        </div>
      </div>
      <div class="c-meta">
        <div class="meta-item">
          <span class="meta-label">{{ $t('clientDetail.birthDate') }}</span>
          <span class="meta-value font-mono">{{ formatDate(store.detail.birthDate) }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">{{ $t('clientDetail.registeredAt') }}</span>
          <span class="meta-value font-mono">{{ formatDateTime(store.detail.createdAt) }}</span>
        </div>
        <button v-if="canSendPush" class="btn-gradient push-btn" @click="openPush">
          <i class="pi pi-send" />
          {{ $t('clientDetail.sendPush') }}
        </button>
      </div>
    </header>

    <!-- Credit limit cards -->
    <div class="limit-cards">
      <div class="limit-card surface-card">
        <span class="limit-label">{{ $t('clientDetail.creditLimit') }}</span>
        <MonoAmount
          v-if="store.detail.creditLimit != null"
          :value="Number(store.detail.creditLimit)"
          size="lg"
          class="limit-value"
        />
        <span v-else class="limit-value muted">—</span>
        <span v-if="store.detail.creditLimitScoredAt" class="limit-source muted">
          {{ formatDate(store.detail.creditLimitScoredAt) }}
        </span>
      </div>
      <!-- A limit is a one-shot ticket, so there is no balance to show: the client
           either holds an unspent limit or an open deal has already spent it. -->
      <div class="limit-card surface-card">
        <span class="limit-label">{{ $t('clientDetail.limitStatus') }}</span>
        <template v-if="store.detail.blockingDealNumber != null">
          <span class="limit-value">
            {{ $t('clientDetail.blockedByDeal', { n: store.detail.blockingDealNumber }) }}
          </span>
          <span class="limit-source muted">{{ $t('clientDetail.blockedByDealHint') }}</span>
        </template>
        <template v-else-if="store.detail.creditLimitExpiresAt">
          <span class="limit-value">{{ $t('clientDetail.limitAvailable') }}</span>
          <span class="limit-source muted">
            {{ $t('clientDetail.limitValidUntil', { date: formatDate(store.detail.creditLimitExpiresAt) }) }}
          </span>
        </template>
        <span v-else class="limit-value muted">—</span>
      </div>
    </div>

    <!-- Tabs -->
    <nav class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab"
        class="tab"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ tabLabel(tab) }}
      </button>
    </nav>

    <!-- Overview tab -->
    <section v-if="activeTab === 'Overview'" class="tab-body">
      <div class="surface-card info-grid">
        <div class="info-row">
          <span class="info-label">{{ $t('clientDetail.fullName') }}</span>
          <span class="info-value">{{ store.detail.fullName }}</span>
        </div>
        <div v-if="store.detail.middleName" class="info-row">
          <span class="info-label">{{ $t('clientDetail.middleName') }}</span>
          <span class="info-value">{{ store.detail.middleName }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('clientDetail.pinfl') }}</span>
          <span class="info-value font-mono">{{ store.detail.pinfl }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('clientDetail.phone') }}</span>
          <span class="info-value font-mono">{{ store.detail.phone }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('clientDetail.birthDate') }}</span>
          <span class="info-value font-mono">{{ formatDate(store.detail.birthDate) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('clientDetail.registeredAt') }}</span>
          <span class="info-value font-mono">{{ formatDateTime(store.detail.createdAt) }}</span>
        </div>
      </div>
    </section>

    <!-- Deals tab -->
    <section v-else-if="activeTab === 'Deals'" class="tab-body">
      <div class="surface-card table-wrap">
        <DataTable
          :value="store.detailDeals"
          data-key="id"
          size="small"
          :empty-message="$t('common.noData')"
          selection-mode="single"
          class="clickable-rows"
          @row-click="(e: any) => goToDeals(e.data.id)"
        >
          <Column :header="$t('clientDetail.dealNumber')">
            <template #body="{ data }">
              <span class="font-mono deal-num">{{ data.dealNumber }}</span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.merchant')">
            <template #body="{ data }">
              <span class="t-name-sm">{{ data.merchantName }}</span>
              <span class="muted branch-name"> / {{ data.branchName }}</span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.status')">
            <template #body="{ data }">
              <StatusBadge :status="data.status" />
            </template>
          </Column>
          <Column :header="$t('clientDetail.amount')">
            <template #body="{ data }">
              <MonoAmount :value="data.amount" size="sm" />
            </template>
          </Column>
          <Column :header="$t('clientDetail.tariff')">
            <template #body="{ data }">
              <span>{{ data.tariffName }}</span>
              <span class="muted"> · {{ data.termMonths }} {{ $t('common.mo') }}</span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.dealDate')">
            <template #body="{ data }">
              <span class="font-mono muted">{{ formatDateTime(data.createdAt) }}</span>
            </template>
          </Column>
          <Column style="width: 36px">
            <template #body>
              <i class="pi pi-angle-right muted" style="font-size: 0.85rem" />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Scoring tab -->
    <section v-else-if="activeTab === 'Scoring'" class="tab-body">
      <div class="surface-card table-wrap">
        <DataTable
          :value="store.detailScoring"
          data-key="id"
          size="small"
          :empty-message="$t('common.noData')"
        >
          <Column :header="$t('clientDetail.scoringDate')">
            <template #body="{ data }">
              <span class="font-mono muted">{{ formatDateTime(data.scoredAt) }}</span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.source')">
            <template #body="{ data }">
              <span class="source-chip" :class="data.source">
                {{ sourceLabel(data.source) }}
              </span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.decision')">
            <template #body="{ data }">
              <span
                class="decision-chip"
                :style="{
                  color: decisionSeverity(data.decision) === 'success' ? 'var(--success)' : decisionSeverity(data.decision) === 'danger' ? 'var(--danger)' : 'var(--warning, #f59e0b)',
                  background: decisionSeverity(data.decision) === 'success' ? 'var(--success-bg)' : decisionSeverity(data.decision) === 'danger' ? 'var(--danger-bg)' : 'color-mix(in srgb, #f59e0b 12%, transparent)',
                }"
              >
                {{ decisionLabel(data.decision) }}
              </span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.score')">
            <template #body="{ data }">
              <span class="font-mono">{{ data.score }}</span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.creditLimit')">
            <template #body="{ data }">
              <MonoAmount :value="data.limit" size="sm" />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Payments tab -->
    <section v-else-if="activeTab === 'Payments'" class="tab-body">
      <div class="surface-card table-wrap">
        <DataTable
          :value="store.detailPayments"
          data-key="id"
          size="small"
          :empty-message="$t('common.noData')"
        >
          <Column :header="$t('clientDetail.dealNumber')">
            <template #body="{ data }">
              <span class="font-mono deal-num">{{ data.dealNumber }}</span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.merchant')">
            <template #body="{ data }">
              <span class="t-name-sm">{{ data.merchantName }}</span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.dueDate')">
            <template #body="{ data }">
              <span class="font-mono muted">{{ formatDate(data.dueDate) }}</span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.amount')">
            <template #body="{ data }">
              <MonoAmount :value="data.amount" size="sm" />
            </template>
          </Column>
          <Column :header="$t('clientDetail.paidAmount')">
            <template #body="{ data }">
              <MonoAmount :value="data.paidAmount" size="sm" />
            </template>
          </Column>
          <Column :header="$t('clientDetail.paymentStatus')">
            <template #body="{ data }">
              <span
                class="status-chip"
                :style="{
                  color: paymentStatusColor(data.status),
                  background: paymentStatusBg(data.status),
                }"
              >
                {{ $t(`clientDetail.paymentStatus_${data.status}`) }}
              </span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.channel')">
            <template #body="{ data }">
              <span class="muted font-mono" style="font-size: 0.78rem">
                {{ $t(`clientDetail.channel_${data.channel}`) }}
              </span>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Notifications tab -->
    <section v-else class="tab-body">
      <div class="surface-card table-wrap">
        <DataTable
          :value="store.detailNotifications"
          data-key="id"
          size="small"
          :empty-message="$t('clientDetail.noNotifications')"
        >
          <Column :header="$t('clientDetail.notifSentAt')">
            <template #body="{ data }">
              <span class="font-mono muted">{{ formatDateTime(data.createdAt) }}</span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.notifMessage')">
            <template #body="{ data }">
              <span class="t-name-sm">{{ notificationTitle(data) }}</span>
              <span v-if="data.body" class="muted notif-body">{{ data.body }}</span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.notifSender')">
            <template #body="{ data }">
              <span v-if="data.sentByName">{{ data.sentByName }}</span>
              <span v-else class="muted system-chip">{{ $t('clientDetail.notifSystem') }}</span>
            </template>
          </Column>
          <Column :header="$t('clientDetail.notifStatus')">
            <template #body="{ data }">
              <span
                class="status-chip"
                :style="{
                  color: data.readAt ? 'var(--success)' : 'var(--text-secondary)',
                  background: data.readAt ? 'var(--success-bg)' : 'var(--bg-surface)',
                }"
              >
                {{ data.readAt ? $t('clientDetail.notifRead') : $t('clientDetail.notifUnread') }}
              </span>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Send push dialog -->
    <Transition name="fade">
      <div v-if="pushOpen" class="dialog-backdrop" @mousedown.self="closePush">
        <div class="dialog surface-card">
          <div class="dialog-header">
            <h3>{{ $t('clientDetail.sendPushTitle') }}</h3>
            <button class="close-btn" @click="closePush"><i class="pi pi-times" /></button>
          </div>

          <div class="dialog-body">
            <p class="dialog-hint muted">{{ $t('clientDetail.pushHint') }}</p>

            <!-- Language tabs: both are required, so this is a view switch, not a choice -->
            <div class="lang-toggle">
              <button
                v-for="lang in (['ru', 'uz'] as const)"
                :key="lang"
                class="lang-opt"
                :class="{ active: pushLang === lang, filled: pushForm[lang === 'ru' ? 'titleRu' : 'titleUz'].trim() && pushForm[lang === 'ru' ? 'bodyRu' : 'bodyUz'].trim() }"
                @click="pushLang = lang"
              >
                {{ lang === 'ru' ? 'Русский' : "O'zbekcha" }}
                <i
                  v-if="pushForm[lang === 'ru' ? 'titleRu' : 'titleUz'].trim() && pushForm[lang === 'ru' ? 'bodyRu' : 'bodyUz'].trim()"
                  class="pi pi-check"
                />
              </button>
            </div>

            <!-- RU -->
            <template v-if="pushLang === 'ru'">
              <div class="field">
                <label class="field-label">
                  {{ $t('clientDetail.pushTitleLabel') }}
                  <span class="counter">{{ pushForm.titleRu.length }}/{{ TITLE_MAX }}</span>
                </label>
                <InputText
                  v-model="pushForm.titleRu"
                  :maxlength="TITLE_MAX"
                  :placeholder="$t('clientDetail.pushTitlePlaceholder')"
                  @input="pushError = ''"
                />
              </div>
              <div class="field">
                <label class="field-label">
                  {{ $t('clientDetail.pushBodyLabel') }}
                  <span class="counter">{{ pushForm.bodyRu.length }}/{{ BODY_MAX }}</span>
                </label>
                <Textarea
                  v-model="pushForm.bodyRu"
                  :maxlength="BODY_MAX"
                  rows="4"
                  auto-resize
                  :placeholder="$t('clientDetail.pushBodyPlaceholder')"
                  @input="pushError = ''"
                />
              </div>
            </template>

            <!-- UZ -->
            <template v-else>
              <div class="field">
                <label class="field-label">
                  {{ $t('clientDetail.pushTitleLabel') }}
                  <span class="counter">{{ pushForm.titleUz.length }}/{{ TITLE_MAX }}</span>
                </label>
                <InputText
                  v-model="pushForm.titleUz"
                  :maxlength="TITLE_MAX"
                  :placeholder="$t('clientDetail.pushTitlePlaceholder')"
                  @input="pushError = ''"
                />
              </div>
              <div class="field">
                <label class="field-label">
                  {{ $t('clientDetail.pushBodyLabel') }}
                  <span class="counter">{{ pushForm.bodyUz.length }}/{{ BODY_MAX }}</span>
                </label>
                <Textarea
                  v-model="pushForm.bodyUz"
                  :maxlength="BODY_MAX"
                  rows="4"
                  auto-resize
                  :placeholder="$t('clientDetail.pushBodyPlaceholder')"
                  @input="pushError = ''"
                />
              </div>
            </template>

            <span v-if="pushError" class="field-error">{{ pushError }}</span>
          </div>

          <div class="dialog-footer">
            <button class="btn-ghost" :disabled="sending" @click="closePush">
              {{ $t('common.cancel') }}
            </button>
            <button
              class="btn-gradient"
              :disabled="sending || pushIncomplete"
              @click="submitPush"
            >
              <i :class="sending ? 'pi pi-spin pi-spinner' : 'pi pi-send'" />
              {{ $t('clientDetail.pushSend') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>

  <div v-else class="not-found surface-card">
    <i class="pi pi-exclamation-circle" />
    <p>{{ $t('clientDetail.notFound') }}</p>
    <button class="btn-ghost" @click="router.push('/clients')">
      {{ $t('clientDetail.backToClients') }}
    </button>
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
  font-size: 1.5rem;
  color: var(--text-secondary);
}

.back {
  align-self: flex-start;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: inherit;
}

.back:hover {
  color: var(--accent-2);
}

.c-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1rem 1.2rem;
  gap: 1rem;
}

.c-id {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}

.c-avatar {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  background: var(--gradient-hero);
  color: #fff;
  font-weight: 800;
  display: grid;
  place-items: center;
  font-size: 1.05rem;
  flex-shrink: 0;
}

.c-name {
  margin: 0 0 0.1rem;
  font-size: 1.1rem;
  font-weight: 800;
}

.c-slug {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.c-meta {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  text-align: right;
}

.meta-label {
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.meta-value {
  font-size: 0.84rem;
  font-weight: 700;
}

.limit-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}

.limit-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 1rem 1.2rem;
}

.limit-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.limit-value {
  font-size: 1.4rem;
  font-weight: 800;
}

.limit-source {
  font-size: 0.72rem;
  margin-top: 0.15rem;
}

.tabs {
  display: flex;
  gap: 0.3rem;
  border-bottom: 1px solid var(--border-subtle);
}

.tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.6rem 0.9rem;
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.12s ease;
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--accent-2);
  border-bottom-color: var(--accent-2);
}

.tab-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.table-wrap {
  padding: 0;
  overflow: hidden;
}

.info-grid {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--border-subtle);
  gap: 1rem;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.info-value {
  font-size: 0.88rem;
  font-weight: 700;
  text-align: right;
}

.t-name-sm {
  font-weight: 700;
  font-size: 0.85rem;
}

.deal-num {
  font-size: 0.82rem;
  color: var(--accent-2);
  font-weight: 700;
}

.branch-name {
  font-size: 0.78rem;
}

.source-chip,
.decision-chip,
.status-chip {
  display: inline-block;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}

.source-chip.wizard {
  color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 12%, transparent);
}

.source-chip.self-service {
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
}

:deep(.clickable-rows .p-datatable-tbody > tr) {
  cursor: pointer;
}

:deep(.clickable-rows .p-datatable-tbody > tr:hover td) {
  background: var(--bg-surface);
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  padding: 3rem;
  text-align: center;
}

.not-found i {
  font-size: 2rem;
  color: var(--danger);
}

/* ── Send push ───────────────────────────────────────────────────────────── */
.push-btn {
  align-self: center;
  white-space: nowrap;
}

.notif-body {
  display: block;
  font-size: 0.78rem;
  margin-top: 0.1rem;
  max-width: 46ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-chip {
  font-size: 0.78rem;
  font-style: italic;
}

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
  max-width: 480px;
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

.close-btn:hover {
  color: var(--text-primary);
}

.dialog-body {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.dialog-hint {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.4;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 0.9rem 1.2rem;
  border-top: 1px solid var(--border-subtle);
}

.lang-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.lang-opt {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem;
  border-radius: 10px;
  border: 1.5px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.12s;
}

.lang-opt.active {
  border-color: var(--accent-2);
  color: var(--accent-2);
}

/* A filled-but-inactive tab still reads as done — both languages are required,
   so the admin needs to see at a glance which half is still empty. */
.lang-opt.filled:not(.active) {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 40%, transparent);
}

.lang-opt .pi-check {
  font-size: 0.7rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.counter {
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  opacity: 0.65;
}

.field-error {
  font-size: 0.75rem;
  color: var(--danger);
  font-weight: 600;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
