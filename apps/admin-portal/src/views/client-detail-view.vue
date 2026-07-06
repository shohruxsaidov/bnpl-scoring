<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useClientsStore } from '@/stores/clients'
import MonoAmount from '@/components/mono-amount.vue'
import StatusBadge from '@/components/status-badge.vue'
import { formatDate, formatDateTime } from '@/utils/money'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const store = useClientsStore()

const clientId = route.params.id as string

const tabs = ['Overview', 'Deals', 'Scoring', 'Payments'] as const
type Tab = (typeof tabs)[number]

const activeTab = ref<Tab>('Overview')

const TAB_LABEL_KEYS: Record<Tab, string> = {
  Overview: 'clientDetail.tabOverview',
  Deals: 'clientDetail.tabDeals',
  Scoring: 'clientDetail.tabScoring',
  Payments: 'clientDetail.tabPayments',
}

function tabLabel(tab: Tab): string {
  return t(TAB_LABEL_KEYS[tab])
}

onMounted(() => store.fetchDetail(clientId))

watch(activeTab, (tab) => {
  if (tab === 'Deals') store.fetchDetailDeals(clientId)
  else if (tab === 'Scoring') store.fetchDetailScoring(clientId)
  else if (tab === 'Payments') store.fetchDetailPayments(clientId)
})

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
      </div>
    </header>

    <!-- Credit limit cards -->
    <div class="limit-cards">
      <div class="limit-card surface-card">
        <span class="limit-label">{{ $t('clientDetail.creditLimit') }}</span>
        <MonoAmount
          v-if="store.detail.creditLimit != null"
          :value="Number(store.detail.creditLimit) * 100"
          size="lg"
          class="limit-value"
        />
        <span v-else class="limit-value muted">—</span>
        <span v-if="store.detail.creditLimitScoredAt" class="limit-source muted">
          {{ formatDate(store.detail.creditLimitScoredAt) }}
        </span>
      </div>
      <div class="limit-card surface-card">
        <span class="limit-label">{{ $t('clientDetail.availableBalance') }}</span>
        <MonoAmount
          v-if="store.detail.availableBalance != null"
          :value="store.detail.availableBalance"
          size="lg"
          gradient
          class="limit-value"
        />
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
    <section v-else class="tab-body">
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
</style>
