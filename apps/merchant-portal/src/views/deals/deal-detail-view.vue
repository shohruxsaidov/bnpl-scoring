<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StatusBadge from '@/components/status-badge.vue'
import { formatDate, formatSomShort } from '@/utils/money'
import { useDealQuery, fetchContractPdfUrl } from '@/composables/use-deals-api'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const dealId = computed(() => route.params.id as string)
const { data: dealData, isLoading, isError } = useDealQuery(dealId)

const deal = computed(() => dealData.value ?? null)
const agent = computed(() => deal.value ? { fullName: deal.value.agentName, phone: null } : null)

const pdfLoading = ref(false)

async function openContractPdf() {
  if (pdfLoading.value) return
  pdfLoading.value = true
  try {
    const url = await fetchContractPdfUrl(dealId.value)
    window.open(url, '_blank')
  } finally {
    pdfLoading.value = false
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`
}

const ustama = computed(() => {
  if (!deal.value || !deal.value.amount) return '0.00%'
  return (((deal.value.totalPayable - deal.value.amount) / deal.value.amount) * 100).toFixed(2) + '%'
})

function paymentDayText(day: number): string {
  return t('dealDetail.autopayDesc', { day })
}

function markupRatio(): number {
  const d = deal.value
  if (!d || !d.amount) return 1
  return d.totalPayable / d.amount
}

function itemUnitPrice(price: string): number {
  return Math.round(parseFloat(price) * markupRatio())
}

function basketTotal(item: { price: string; quantity: number }): number {
  return itemUnitPrice(item.price) * item.quantity
}
</script>

<template>
  <div v-if="isLoading" class="not-found surface-card">
    <i class="pi pi-spin pi-spinner" style="font-size:2rem" />
  </div>

  <div v-else-if="isError" class="not-found surface-card">
    <i class="pi pi-exclamation-circle" />
    <p>{{ $t('common.error') }}</p>
    <button class="btn-gradient" @click="router.push('/deals')">{{ $t('dealDetail.contracts') }}</button>
  </div>

  <div v-else-if="deal" class="page">
    <!-- Page header -->
    <div class="page-hdr">
      <div class="breadcrumb">
        <button class="bc-back" @click="router.push('/deals')">
          <i class="pi pi-arrow-left" /> {{ $t('dealDetail.contracts') }}
        </button>
        <span class="bc-sep">/</span>
        <span class="bc-current font-mono">{{ deal.dealNumber }}</span>
      </div>
      <div class="hdr-actions">
        <button class="btn-ghost btn-sm" :disabled="pdfLoading" @click="openContractPdf">
          <i :class="pdfLoading ? 'pi pi-spin pi-spinner' : 'pi pi-file-pdf'" />
          {{ $t('dealDetail.contractPdf') }}
        </button>
        <button class="btn-cancel btn-sm">
          <i class="pi pi-times-circle" /> {{ $t('dealDetail.cancel') }}
        </button>
      </div>
    </div>

    <div class="surface-card deal-card">
      <div class="top-section">
        <div class="fields-grid">
          <div class="field-row">
            <span class="fl">{{ $t('dealDetail.finProduct') }}</span>
            <span class="fv">{{ deal.termMonths }} {{ $t('dealDetail.month') }}</span>
            <span class="fl">{{ $t('dealDetail.dealDate') }}</span>
            <span class="fv">{{ formatDateTime(deal.createdAt) }}</span>
          </div>
          <div class="field-row">
            <span class="fl">{{ $t('dealDetail.dealNumber') }}</span>
            <span class="fv font-mono">{{ deal.dealNumber }}</span>
            <span class="fl">{{ $t('dealDetail.status') }}</span>
            <span class="fv">
              <StatusBadge :status="(deal.status as any)" />
            </span>
          </div>
          <div class="field-row">
            <span class="fl">{{ $t('dealDetail.dealCost') }}</span>
            <span class="fv font-mono">{{ formatSomShort(deal.totalPayable) }} {{ $t('dealDetail.som') }}</span>
          </div>
          <div class="field-row">
            <span class="fl">{{ $t('dealDetail.finProduct') }}</span>
            <span class="fv">{{ deal.termMonths }} {{ $t('dealDetail.month') }}</span>
            <span class="fl">{{ $t('dealDetail.paymentDay') }}</span>
            <span class="fv">{{ paymentDayText(deal.paymentDay ?? 5) }}</span>
          </div>
          <div class="field-row">
            <span class="fl">{{ $t('dealDetail.prepayment') }}</span>
            <span class="fv font-mono">{{ formatSomShort(deal.prepaymentAmount ?? 0) }} {{ $t('dealDetail.som') }}</span>
            <span class="fl">{{ $t('dealDetail.markup') }}</span>
            <span class="fv">{{ ustama }}</span>
          </div>
        </div>
        <div class="side-panels">
          <div class="side-panel">
            <span class="panel-role">{{ $t('dealDetail.agent') }}</span>
            <span class="panel-name">{{ agent?.fullName ?? '—' }}</span>
            <span class="panel-phone font-mono">{{ agent?.phone ?? '' }}</span>
          </div>
          <div class="side-panel">
            <span class="panel-role">{{ $t('dealDetail.client') }}</span>
            <span class="panel-name">{{ deal.clientName }}</span>
            <span class="panel-phone font-mono">{{ deal.clientPhone }}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h4 class="section-title">{{ $t('dealDetail.products') }} ({{ deal.basket.length }})</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ $t('dealDetail.thNum') }}</th>
              <th>{{ $t('dealDetail.thName') }}</th>
              <th>{{ $t('dealDetail.thMxik') }}</th>
              <th>{{ $t('dealDetail.thQty') }}</th>
              <th>{{ $t('dealDetail.thPrice') }}</th>
              <th>{{ $t('dealDetail.thTotal') }}</th>
              <th>{{ $t('dealDetail.thMarking') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in deal.basket" :key="item.productId ?? i">
              <td class="font-mono">{{ i + 1 }}</td>
              <td>{{ item.productName }}</td>
              <td class="font-mono muted">{{ item.mxikCode ?? '—' }}</td>
              <td class="font-mono">{{ item.quantity }}</td>
              <td class="font-mono">{{ formatSomShort(itemUnitPrice(item.price)) }}</td>
              <td class="font-mono">{{ formatSomShort(basketTotal(item)) }}</td>
              <td class="muted">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="section">
        <h4 class="section-title">{{ $t('dealDetail.fiscalReceipt') }}</h4>
        <div class="receipt-rows">
          <div class="receipt-row">
            <span class="fl">{{ $t('dealDetail.marking') }}</span>
            <span class="receipt-val danger">{{ $t('dealDetail.no') }}</span>
          </div>
          <div class="receipt-row">
            <span class="fl">{{ $t('dealDetail.fiscalReceiptLabel') }}</span>
            <span class="receipt-val muted">{{ $t('dealDetail.notCreated') }}</span>
          </div>
        </div>
        <button class="link-btn">{{ $t('dealDetail.createFiscalReceipt') }}</button>
      </div>

      <div class="section">
        <h4 class="section-title">{{ $t('dealDetail.contracts') }}</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ $t('dealDetail.contractNumber') }}</th>
              <th>{{ $t('dealDetail.type') }}</th>
              <th>{{ $t('dealDetail.client') }}</th>
              <th>{{ $t('dealDetail.term') }}</th>
              <th>{{ $t('dealDetail.dateCol') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="font-mono">{{ deal.dealNumber }}</td>
              <td>{{ $t('dealDetail.murabaha') }}</td>
              <td>{{ deal.clientName }}</td>
              <td>{{ deal.termMonths }} {{ $t('dealDetail.month') }}</td>
              <td class="font-mono">{{ formatDate(deal.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div v-else class="not-found surface-card">
    <i class="pi pi-exclamation-circle" />
    <p>{{ $t('dealDetail.notFound') }}</p>
    <button class="btn-gradient" @click="router.push('/')">{{ $t('dealDetail.toHome') }}</button>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.page-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.2rem;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.bc-back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
  font-family: inherit;
  padding: 0;
}

.bc-back:hover { color: var(--accent-2); }
.bc-sep { color: var(--text-secondary); }
.bc-current { font-weight: 700; color: var(--text-primary); }

.hdr-actions { display: flex; gap: 0.6rem; }

.btn-sm {
  font-size: 0.82rem;
  padding: 0.45rem 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.15s ease;
}

.btn-cancel {
  background: transparent;
  border: 1.5px solid var(--danger);
  color: var(--danger);
}

.btn-cancel:hover { background: var(--danger-bg); }

.deal-card { padding: 0; overflow: hidden; }

.top-section {
  display: flex;
  border-bottom: 1px solid var(--border-subtle);
}

.fields-grid { flex: 1; min-width: 0; }

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  border-bottom: 1px solid var(--border-subtle);
}

.fl {
  padding: 0.7rem 1.4rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  font-weight: 500;
  display: flex;
  align-items: center;
}

.fv {
  padding: 0.7rem 0.8rem 0.7rem 0;
  font-size: 0.88rem;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.side-panels {
  width: 220px;
  flex-shrink: 0;
  border-left: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
}

.side-panel {
  flex: 1;
  padding: 1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.side-panel + .side-panel { border-top: 1px solid var(--border-subtle); }

.panel-role {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.panel-name { font-size: 1rem; font-weight: 800; margin-top: 0.15rem; }
.panel-phone { font-size: 0.8rem; color: var(--text-secondary); }

.section {
  padding: 1.2rem 1.4rem;
  border-top: 1px solid var(--border-subtle);
}

.section-title { margin: 0 0 0.9rem; font-size: 0.92rem; font-weight: 800; }

.data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }

.data-table th {
  text-align: left;
  padding: 0.55rem 0.9rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
}

.data-table td {
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
}

.data-table tbody tr:last-child td { border-bottom: none; }

.receipt-rows { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.8rem; }

.receipt-row { display: flex; align-items: center; gap: 0.6rem; font-size: 0.88rem; }

.receipt-val { font-weight: 600; }

.link-btn {
  background: transparent;
  border: none;
  color: var(--success);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.link-btn:hover { opacity: 0.8; }

.muted { color: var(--text-secondary); }
.danger { color: var(--danger); }

.not-found {
  padding: 4rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.not-found i { font-size: 2.4rem; color: var(--text-secondary); }

@media (max-width: 900px) {
  .top-section { flex-direction: column; }
  .side-panels { width: 100%; flex-direction: row; border-left: none; border-top: 1px solid var(--border-subtle); }
  .side-panel + .side-panel { border-top: none; border-left: 1px solid var(--border-subtle); }
  .field-row { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 600px) {
  .field-row { grid-template-columns: 1fr; }
  .side-panels { flex-direction: column; }
  .side-panel + .side-panel { border-left: none; border-top: 1px solid var(--border-subtle); }
}
</style>
