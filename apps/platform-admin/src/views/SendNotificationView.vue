<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { apiFetch } from '@/utils/apiFetch'

const { t } = useI18n()
const qc = useQueryClient()

// ── Types ────────────────────────────────────────────────────────────────────

type TargetType = 'employee' | 'merchant_employees' | 'client' | 'all_clients'

interface Merchant { id: string; name: string }
interface Employee { id: string; fullName: string; email: string; roles: string[] }
interface ClientResult { id: string; fullName: string; pinfl: string; phone: string }
interface Broadcast {
  id: string
  targetType: string
  targetId: string | null
  title: string
  body: string
  recipientCount: number
  createdAt: string
}

// ── Form state ───────────────────────────────────────────────────────────────

const targetType = ref<TargetType>('employee')
const selectedMerchantId = ref('')
const selectedEmployeeId = ref('')
const selectedClientId = ref('')
const clientSearch = ref('')
const title = ref('')
const body = ref('')
const errors = ref<Record<string, string>>({})
const successMsg = ref('')
const errorMsg = ref('')

// Reset downstream selections when target type changes
watch(targetType, () => {
  selectedMerchantId.value = ''
  selectedEmployeeId.value = ''
  selectedClientId.value = ''
  clientSearch.value = ''
  errors.value = {}
})

watch(selectedMerchantId, () => {
  selectedEmployeeId.value = ''
})

// ── API queries ──────────────────────────────────────────────────────────────

const merchantsQuery = useQuery({
  queryKey: ['admin-merchants-list'],
  queryFn: () => apiFetch<{ merchants: Merchant[] }>('/admin/merchants'),
  staleTime: 60_000,
})

const merchantOptions = computed<Merchant[]>(() => merchantsQuery.data.value?.merchants ?? [])

const employeesQuery = useQuery({
  queryKey: computed(() => ['admin-employees', selectedMerchantId.value]),
  queryFn: () =>
    apiFetch<{ employees: Employee[] }>(
      `/admin/employees?merchantId=${selectedMerchantId.value}`,
    ),
  enabled: computed(() => !!selectedMerchantId.value && targetType.value === 'employee'),
  staleTime: 30_000,
})

const employeeOptions = computed<Employee[]>(() => employeesQuery.data.value?.employees ?? [])

const clientSearchQuery = useQuery({
  queryKey: computed(() => ['admin-client-search', clientSearch.value]),
  queryFn: () =>
    apiFetch<{ clients: ClientResult[] }>(
      `/admin/notifications/clients/search?q=${encodeURIComponent(clientSearch.value)}`,
    ),
  enabled: computed(() => clientSearch.value.length >= 2 && targetType.value === 'client'),
  staleTime: 15_000,
})

const clientResults = computed<ClientResult[]>(() => clientSearchQuery.data.value?.clients ?? [])

const broadcastsQuery = useQuery({
  queryKey: ['admin-broadcasts'],
  queryFn: () => apiFetch<{ broadcasts: Broadcast[] }>('/admin/notifications/broadcasts'),
  staleTime: 30_000,
})

const broadcasts = computed<Broadcast[]>(() => broadcastsQuery.data.value?.broadcasts ?? [])

// ── Send mutation ─────────────────────────────────────────────────────────────

const sendMutation = useMutation({
  mutationFn: (payload: {
    targetType: TargetType
    targetId?: string
    title: string
    body: string
  }) =>
    apiFetch<{ ok: boolean; recipientCount: number }>('/admin/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  onSuccess: (data) => {
    successMsg.value = t('notifications.sentSuccess', { count: data.recipientCount })
    errorMsg.value = ''
    title.value = ''
    body.value = ''
    qc.invalidateQueries({ queryKey: ['admin-broadcasts'] })
    setTimeout(() => (successMsg.value = ''), 5000)
  },
  onError: () => {
    errorMsg.value = t('notifications.sentError')
    successMsg.value = ''
  },
})

// ── Validation & submit ──────────────────────────────────────────────────────

function validate(): boolean {
  const e: Record<string, string> = {}

  if (targetType.value === 'employee') {
    if (!selectedMerchantId.value) e.merchant = t('notifications.validationTarget')
    if (!selectedEmployeeId.value) e.employee = t('notifications.validationTarget')
  } else if (targetType.value === 'merchant_employees') {
    if (!selectedMerchantId.value) e.merchant = t('notifications.validationTarget')
  } else if (targetType.value === 'client') {
    if (!selectedClientId.value) e.client = t('notifications.validationTarget')
  }

  if (!title.value.trim()) e.title = t('notifications.validationTitle')
  if (!body.value.trim()) e.body = t('notifications.validationBody')

  errors.value = e
  return Object.keys(e).length === 0
}

function send() {
  if (!validate()) return

  let targetId: string | undefined
  if (targetType.value === 'employee') targetId = selectedEmployeeId.value
  else if (targetType.value === 'merchant_employees') targetId = selectedMerchantId.value
  else if (targetType.value === 'client') targetId = selectedClientId.value

  sendMutation.mutate({ targetType: targetType.value, targetId, title: title.value, body: body.value })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function targetLabel(b: Broadcast): string {
  if (b.targetType === 'all_clients') return t('notifications.targetAllClientsLabel')
  if (b.targetType === 'merchant_employees') return t('notifications.targetMerchantLabel', { id: b.targetId })
  if (b.targetType === 'employee') return t('notifications.targetEmployeeLabel', { id: b.targetId })
  return t('notifications.targetClientLabel', { id: b.targetId })
}
</script>

<template>
  <div class="send-notification">
    <!-- ── Page header ──────────────────────────────────────────────────────── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('notifications.pageTitle') }}</h1>
        <p class="page-sub">{{ t('notifications.pageSubtitle') }}</p>
      </div>
    </div>

    <!-- ── Two-column layout ───────────────────────────────────────────────── -->
    <div class="layout">
      <!-- ── Compose panel ─────────────────────────────────────────────────── -->
      <div class="compose-card surface-card">
        <h2 class="section-title">{{ t('notifications.composeTitle') }}</h2>

        <!-- Target type tabs -->
        <div class="field">
          <label class="field-label">{{ t('notifications.targetLabel') }}</label>
          <div class="target-tabs">
            <button
              v-for="opt in (['employee', 'merchant_employees', 'client', 'all_clients'] as TargetType[])"
              :key="opt"
              class="target-tab"
              :class="{ active: targetType === opt }"
              @click="targetType = opt"
            >
              <i
                :class="{
                  'pi pi-user': opt === 'employee',
                  'pi pi-building': opt === 'merchant_employees',
                  'pi pi-id-card': opt === 'client',
                  'pi pi-globe': opt === 'all_clients',
                }"
              />
              {{ t(`notifications.target${opt.split('_').map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)).join('')}`) }}
            </button>
          </div>
        </div>

        <!-- Merchant picker (for employee / merchant_employees) -->
        <div v-if="targetType === 'employee' || targetType === 'merchant_employees'" class="field">
          <label class="field-label">{{ t('notifications.merchantLabel') }}</label>
          <select
            v-model="selectedMerchantId"
            class="field-input"
            :class="{ error: errors.merchant }"
          >
            <option value="">{{ t('notifications.merchantPlaceholder') }}</option>
            <option v-for="m in merchantOptions" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
          <span v-if="errors.merchant" class="field-error">{{ errors.merchant }}</span>
        </div>

        <!-- Employee picker (for employee only) -->
        <div v-if="targetType === 'employee'" class="field">
          <label class="field-label">{{ t('notifications.employeeLabel') }}</label>
          <select
            v-model="selectedEmployeeId"
            class="field-input"
            :class="{ error: errors.employee }"
            :disabled="!selectedMerchantId"
          >
            <option value="">{{ t('notifications.employeePlaceholder') }}</option>
            <option v-for="e in employeeOptions" :key="e.id" :value="e.id">
              {{ e.fullName }} — {{ e.email }}
            </option>
          </select>
          <span v-if="errors.employee" class="field-error">{{ errors.employee }}</span>
        </div>

        <!-- Client search (for client only) -->
        <div v-if="targetType === 'client'" class="field">
          <label class="field-label">{{ t('notifications.clientLabel') }}</label>
          <input
            v-model="clientSearch"
            type="text"
            class="field-input"
            :placeholder="t('notifications.clientSearchPlaceholder')"
          />
          <div v-if="clientSearch.length >= 2" class="client-results">
            <div
              v-for="c in clientResults"
              :key="c.id"
              class="client-row"
              :class="{ selected: selectedClientId === c.id }"
              @click="selectedClientId = c.id"
            >
              <div class="client-name">{{ c.fullName }}</div>
              <div class="client-meta">{{ c.pinfl }} · {{ c.phone }}</div>
            </div>
            <div v-if="clientResults.length === 0 && !clientSearchQuery.isFetching.value" class="client-empty">
              {{ t('notifications.noResults') }}
            </div>
          </div>
          <span v-if="errors.client" class="field-error">{{ errors.client }}</span>
        </div>

        <!-- Title -->
        <div class="field">
          <label class="field-label">{{ t('notifications.titleLabel') }}</label>
          <input
            v-model="title"
            type="text"
            class="field-input"
            :class="{ error: errors.title }"
            :placeholder="t('notifications.titlePlaceholder')"
          />
          <span v-if="errors.title" class="field-error">{{ errors.title }}</span>
        </div>

        <!-- Body -->
        <div class="field">
          <label class="field-label">{{ t('notifications.bodyLabel') }}</label>
          <textarea
            v-model="body"
            class="field-input body-area"
            :class="{ error: errors.body }"
            :placeholder="t('notifications.bodyPlaceholder')"
            rows="4"
          />
          <span v-if="errors.body" class="field-error">{{ errors.body }}</span>
        </div>

        <!-- Feedback -->
        <div v-if="successMsg" class="feedback success">
          <i class="pi pi-check-circle" /> {{ successMsg }}
        </div>
        <div v-if="errorMsg" class="feedback danger">
          <i class="pi pi-times-circle" /> {{ errorMsg }}
        </div>

        <!-- Submit -->
        <button
          class="send-btn"
          :disabled="sendMutation.isPending.value"
          @click="send"
        >
          <i v-if="sendMutation.isPending.value" class="pi pi-spin pi-spinner" />
          <i v-else class="pi pi-send" />
          {{ sendMutation.isPending.value ? t('notifications.sending') : t('notifications.send') }}
        </button>
      </div>

      <!-- ── History panel ──────────────────────────────────────────────────── -->
      <div class="history-card surface-card">
        <h2 class="section-title">{{ t('notifications.historyTitle') }}</h2>

        <div v-if="broadcasts.length === 0" class="history-empty">
          <i class="pi pi-inbox" />
          <p>{{ t('notifications.historyEmpty') }}</p>
        </div>

        <table v-else class="history-table">
          <thead>
            <tr>
              <th>{{ t('notifications.colTarget') }}</th>
              <th>{{ t('notifications.colTitle') }}</th>
              <th>{{ t('notifications.colCount') }}</th>
              <th>{{ t('notifications.colDate') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in broadcasts" :key="b.id">
              <td>
                <span class="target-chip">{{ targetLabel(b) }}</span>
              </td>
              <td class="title-cell">{{ b.title }}</td>
              <td class="count-cell">{{ b.recipientCount }}</td>
              <td class="date-cell">{{ fmtDate(b.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.send-notification {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.page-title {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0 0 0.3rem;
}
.page-sub {
  font-size: 0.88rem;
  color: var(--text-secondary);
  margin: 0;
}

.layout {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 1.5rem;
  align-items: start;
}

.compose-card,
.history-card {
  border-radius: 16px;
  padding: 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 800;
  margin: 0 0 0.2rem;
}

/* Target tabs */
.target-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}
.target-tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border-radius: 9px;
  border: 1.5px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.target-tab:hover {
  border-color: var(--accent-2);
  color: var(--accent-2);
}
.target-tab.active {
  background: var(--gradient-accent);
  border-color: transparent;
  color: #fff;
  box-shadow: var(--accent-glow);
}

/* Fields */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.field-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
}
.field-input {
  padding: 0.55rem 0.8rem;
  border-radius: 9px;
  border: 1.5px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 0.88rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
}
.field-input:focus {
  border-color: var(--accent-2);
}
.field-input.error {
  border-color: var(--danger);
}
.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.body-area {
  resize: vertical;
  min-height: 90px;
}
.field-error {
  font-size: 0.75rem;
  color: var(--danger);
}

/* Client search results */
.client-results {
  border: 1.5px solid var(--border-subtle);
  border-radius: 9px;
  background: var(--bg-surface);
  overflow: hidden;
  max-height: 180px;
  overflow-y: auto;
}
.client-row {
  padding: 0.6rem 0.85rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.12s;
}
.client-row:last-child {
  border-bottom: none;
}
.client-row:hover,
.client-row.selected {
  background: color-mix(in srgb, var(--accent-2) 8%, var(--bg-surface));
}
.client-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
}
.client-meta {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.1rem;
}
.client-empty {
  padding: 0.8rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  text-align: center;
}

/* Feedback */
.feedback {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  border-radius: 9px;
  font-size: 0.85rem;
  font-weight: 600;
}
.feedback.success {
  background: color-mix(in srgb, var(--success) 12%, transparent);
  color: var(--success);
}
.feedback.danger {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.7rem 1.2rem;
  border-radius: 10px;
  border: none;
  background: var(--gradient-hero);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
  box-shadow: var(--accent-glow);
}
.send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* History */
.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 2.5rem 1rem;
  color: var(--text-secondary);
  opacity: 0.5;
}
.history-empty i {
  font-size: 2rem;
}
.history-empty p {
  margin: 0;
  font-size: 0.88rem;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.83rem;
}
.history-table th {
  text-align: left;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
}
.history-table td {
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: top;
}
.history-table tr:last-child td {
  border-bottom: none;
}
.history-table tr:hover td {
  background: var(--bg-base);
}

.target-chip {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent-2) 12%, transparent);
  color: var(--accent-2);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}
.title-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.count-cell {
  font-weight: 700;
  color: var(--text-secondary);
  white-space: nowrap;
}
.date-cell {
  color: var(--text-secondary);
  font-size: 0.78rem;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
