<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDealsStore } from '@/stores/deals'
import { useOverviewApi } from '@/composables/useOverviewApi'
import StatusBadge from '@/components/StatusBadge.vue'
import { formatSomCompact, formatSomShort, formatDate } from '@/utils/money'

const deals = useDealsStore()
const overview = useOverviewApi()
const router = useRouter()
const { t } = useI18n()

const kybKpis = computed(() => [
  {
    key: 'kyb-pending',
    label: t('overview.kybPending'),
    value: String(overview.kybStats.value.pending),
    delta: `${overview.kybStats.value.pending} ${t('overview.kybPendingDelta')}`,
    tone: overview.kybStats.value.pending > 0 ? ('down' as const) : ('up' as const),
    sparkColor: '#ffb02e',
    icon: 'pi pi-clock',
  },
  {
    key: 'kyb-verified',
    label: t('overview.kybVerified'),
    value: String(overview.kybStats.value.verified),
    delta: `${overview.kybStats.value.verified} ${t('overview.kybVerifiedDelta')}`,
    tone: 'up' as const,
    sparkColor: '#00d4aa',
    icon: 'pi pi-verified',
  },
  {
    key: 'kyb-rejected',
    label: t('overview.kybRejected'),
    value: String(overview.kybStats.value.rejected),
    delta: `${overview.kybStats.value.rejected} ${t('overview.kybRejectedDelta')}`,
    tone: overview.kybStats.value.rejected > 0 ? ('down' as const) : ('up' as const),
    sparkColor: '#ff5c5c',
    icon: 'pi pi-times-circle',
  },
])

onMounted(() => {
  deals.fetchDeals()
  overview.fetch()
})

const overdueCount = computed(() => deals.deals.filter((d) => d.status === 'overdue').length)

const merchantCount = computed(() => overview.merchantHealth.value.length)
const activeMerchantCount = computed(
  () => overview.merchantHealth.value.filter((m) => m.active).length,
)

// ---- KPI strip ----
const kpis = computed(() => [
  {
    key: 'tenants',
    label: t('overview.totalTenants'),
    value: String(merchantCount.value),
    delta: `${activeMerchantCount.value} ${t('overview.activeTenants').toLowerCase()}`,
    tone: 'neutral' as const,
    sparkPath: 'M0,28 L25,24 L50,20 L75,22 L100,16 L125,14 L150,10 L175,8 L200,6',
    sparkColor: '#7b68ee',
    icon: 'pi pi-building',
  },
  {
    key: 'deals',
    label: t('overview.totalDeals'),
    value: String(deals.deals.length),
    delta: `${overdueCount.value} ${t('overview.overdueDeals').toLowerCase()}`,
    tone: overdueCount.value > 0 ? ('down' as const) : ('up' as const),
    sparkPath: 'M0,30 L25,26 L50,22 L75,20 L100,16 L125,14 L150,12 L175,8 L200,6',
    sparkColor: '#00d4aa',
    icon: 'pi pi-credit-card',
  },
  {
    key: 'volume',
    label: t('overview.platformVolume'),
    value: formatSomCompact(deals.platformVolume),
    delta: `${deals.deals.length} ${t('overview.totalDeals').toLowerCase()}`,
    tone: 'up' as const,
    sparkPath: 'M0,32 L25,28 L50,24 L75,20 L100,14 L125,12 L150,8 L175,6 L200,4',
    sparkColor: '#c77dff',
    icon: 'pi pi-chart-line',
  },
  {
    key: 'overdue',
    label: t('overview.overdueDeals'),
    value: String(overdueCount.value),
    delta: overdueCount.value === 0 ? 'All clear' : `${overdueCount.value} ${t('overview.overdue')}`,
    tone: overdueCount.value === 0 ? ('up' as const) : ('down' as const),
    sparkPath: 'M0,10 L25,14 L50,12 L75,18 L100,16 L125,22 L150,18 L175,26 L200,24',
    sparkColor: '#ff5c5c',
    icon: 'pi pi-exclamation-triangle',
  },
])

// ---- Deals over time chart ----
const chartRange = ref<'30' | '90' | 'YTD'>('30')

const dealsChartData = computed(() => {
  const now = Date.now()
  const MS_DAY = 86_400_000
  const days = chartRange.value === '30' ? 30 : chartRange.value === '90' ? 90 : 180
  const N = 24
  const step = Math.max(1, Math.ceil(days / N))
  const buckets = Array.from({ length: N }, () => 0)

  deals.deals.forEach((d) => {
    const ageInDays = Math.floor((now - new Date(d.createdAt).getTime()) / MS_DAY)
    const bucket = Math.floor(ageInDays / step)
    if (bucket >= 0 && bucket < N) {
      buckets[N - 1 - bucket]++
    }
  })

  const max = Math.max(...buckets, 1)
  const W = 540
  const H = 130
  const padX = 10
  const padY = 10

  const pts = buckets.map((v, i) => {
    const x = +(padX + (i / (N - 1)) * (W - padX * 2)).toFixed(1)
    const y = +(padY + (1 - v / max) * (H - padY * 2)).toFixed(1)
    return [x, y]
  })

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
  const fill = `${line} L${W - padX},${H} L${padX},${H} Z`

  return { line, fill }
})

// ---- Status donut ----
const CIRC = 301.6 // 2 * π * 48

const statusSegments = computed(() => {
  const counts: Record<string, number> = { active: 0, scoring: 0, closed: 0, overdue: 0, declined: 0 }
  deals.deals.forEach((d) => {
    if (d.status in counts) counts[d.status]++
  })
  const total = Math.max(deals.deals.length, 1)

  const config = [
    { key: 'active', color: '#00d4aa', label: t('status.active') },
    { key: 'scoring', color: '#ffb02e', label: t('status.scoring') },
    { key: 'closed', color: '#7b68ee', label: t('status.closed') },
    { key: 'overdue', color: '#ff5c5c', label: t('status.overdue') },
    { key: 'declined', color: '#9898bb', label: t('status.declined') },
  ]

  let offset = 0
  return config.map((s) => {
    const count = counts[s.key] ?? 0
    const pct = count / total
    const dash = pct * CIRC
    const seg = { ...s, count, pct: Math.round(pct * 100), dash, offset }
    offset += dash
    return seg
  })
})

const dominantSegment = computed(() =>
  [...statusSegments.value].sort((a, b) => b.count - a.count)[0],
)

// ---- Activity feed ----
const merchantNameMap = computed(
  () => new Map(overview.merchantHealth.value.map((m) => [m.id, m.name])),
)

const activityItems = computed(() =>
  deals.recent(6).map((d, i) => ({
    id: d.id,
    dealNumber: d.dealNumber,
    initials: d.clientName?.slice(0, 2).toUpperCase() ?? '??',
    avClass: `av-${(i % 6) + 1}`,
    name: d.clientName,
    tenant: merchantNameMap.value.get(d.tenantId) ?? '—',
    status: d.status,
    amount: formatSomShort(d.amount),
    time: formatDate(d.createdAt),
  })),
)

// ---- Merchant health ----
const tenantHealth = computed(() => overview.merchantHealth.value.slice(0, 8))


</script>

<template>
  <div class="overview">

    <!-- ── KPI strip ── -->
    <div class="kpi-strip">
      <div v-for="k in kpis" :key="k.key" class="kpi-card">
        <div class="kpi-label">
          <i :class="k.icon" />
          {{ k.label }}
        </div>
        <div class="kpi-value">{{ k.value }}</div>
        <div class="kpi-delta" :class="k.tone">{{ k.delta }}</div>
        <svg class="kpi-spark" viewBox="0 0 200 44" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient :id="`sg-${k.key}`" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" :stop-color="k.sparkColor" stop-opacity="0.30" />
              <stop offset="1" :stop-color="k.sparkColor" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path :d="k.sparkPath + ' L200,44 L0,44 Z'" :fill="`url(#sg-${k.key})`" />
          <path :d="k.sparkPath" :stroke="k.sparkColor" stroke-width="2" fill="none" stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
      </div>
    </div>

    <!-- ── KYB KPI strip ── -->
    <div class="kpi-strip kyb-strip">
      <div v-for="k in kybKpis" :key="k.key" class="kpi-card">
        <div class="kpi-label">
          <i :class="k.icon" />
          {{ k.label }}
        </div>
        <div class="kpi-value">{{ k.value }}</div>
        <div class="kpi-delta" :class="k.tone">{{ k.delta }}</div>
      </div>
    </div>

    <!-- ── Charts row ── -->
    <div class="charts-row">

      <!-- Deals over time — line chart -->
      <div class="chart-card">
        <div class="chart-head">
          <div>
            <h3>Deals over time</h3>
            <p class="chart-sub">Active & closed by period</p>
          </div>
          <div class="tabs">
            <div v-for="r in (['30', '90', 'YTD'] as const)" :key="r" class="tab"
              :class="{ 'is-active': chartRange === r }" @click="chartRange = r">
              {{ r === '30' ? '30 d' : r === '90' ? '90 d' : 'YTD' }}
            </div>
          </div>
        </div>
        <div class="chart-body">
          <svg viewBox="0 0 540 130" width="100%" height="130" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="g-dl" x1="0" x2="1">
                <stop offset="0" stop-color="#7b68ee" />
                <stop offset="1" stop-color="#c77dff" />
              </linearGradient>
              <linearGradient id="g-df" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#7b68ee" stop-opacity=".28" />
                <stop offset="1" stop-color="#7b68ee" stop-opacity="0" />
              </linearGradient>
            </defs>
            <g stroke="var(--border-subtle)" stroke-width="1">
              <line x1="0" y1="32" x2="540" y2="32" />
              <line x1="0" y1="65" x2="540" y2="65" />
              <line x1="0" y1="98" x2="540" y2="98" />
            </g>
            <path :d="dealsChartData.fill" fill="url(#g-df)" />
            <path :d="dealsChartData.line" stroke="url(#g-dl)" stroke-width="2.5" fill="none" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-swatch" style="background: linear-gradient(90deg,#7b68ee,#c77dff)" />
              {{ $t('overview.totalDeals') }}
            </div>
          </div>
        </div>
      </div>

      <!-- Status distribution — donut -->
      <div class="chart-card">
        <div class="chart-head">
          <div>
            <h3>Status distribution</h3>
            <p class="chart-sub">{{ deals.deals.length }} total deals</p>
          </div>
        </div>
        <div class="chart-body donut-wrap">
          <svg viewBox="0 0 120 120" width="150" height="150" style="flex-shrink:0" aria-hidden="true">
            <circle cx="60" cy="60" r="48" fill="none" stroke="var(--border-subtle)" stroke-width="16" />
            <circle v-for="seg in statusSegments" :key="seg.key" cx="60" cy="60" r="48" fill="none" :stroke="seg.color"
              stroke-width="16" :stroke-dasharray="`${seg.dash} 301.6`" :stroke-dashoffset="`${-seg.offset}`"
              transform="rotate(-90 60 60)" />
            <text x="60" y="56" text-anchor="middle" font-family="Plus Jakarta Sans" font-weight="800" font-size="17"
              fill="var(--text-primary)">
              {{ dominantSegment.pct }}%
            </text>
            <text x="60" y="71" text-anchor="middle" font-family="JetBrains Mono" font-size="8"
              fill="var(--text-secondary)">
              {{ dominantSegment.label }}
            </text>
          </svg>
          <div class="donut-legend">
            <div v-for="seg in statusSegments" :key="seg.key" class="donut-row">
              <span class="dl-dot" :style="{ background: seg.color, boxShadow: `0 0 5px ${seg.color}` }" />
              <span class="dl-label">{{ seg.label }}</span>
              <span class="dl-val font-mono">{{ seg.count }} · {{ seg.pct }}%</span>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ── Data row ── -->
    <div class="data-row">

      <!-- Tenant health list -->
      <section class="surface-card panel">
        <header class="panel-head">
          <h3 class="section-title">{{ $t('overview.tenantHealth') }}</h3>
          <button class="btn-ghost sm" @click="router.push('/merchants')">
            {{ $t('overview.viewAll') }} <i class="pi pi-arrow-right" />
          </button>
        </header>
        <ul class="health-list">
          <li v-for="(tenant, idx) in tenantHealth" :key="tenant.id" class="health-row"
            @click="router.push(`/merchants/${tenant.id}`)">
            <div class="h-av" :class="`av-${(idx % 6) + 1}`">
              {{ tenant.name.slice(0, 2).toUpperCase() }}
            </div>
            <span class="status-dot" :style="{
              background: tenant.active ? 'var(--success)' : 'var(--danger)',
              boxShadow: `0 0 6px ${tenant.active ? 'var(--success)' : 'var(--danger)'}`,
            }" />
            <span class="health-name">{{ tenant.name }}</span>
            <span class="health-meta font-mono">{{ tenant.dealCount }} {{ $t('overview.deals') }}</span>
            <span class="health-overdue font-mono" :class="{ zero: tenant.overdueCount === 0 }">
              {{ tenant.overdueCount }} {{ $t('overview.overdue') }}
            </span>
          </li>
        </ul>
      </section>

      <!-- Activity feed -->
      <section class="surface-card panel">
        <header class="panel-head">
          <h3 class="section-title">{{ $t('overview.recentDeals') }}</h3>
          <button class="btn-ghost sm" @click="router.push('/deals')">
            {{ $t('overview.viewAll') }} <i class="pi pi-arrow-right" />
          </button>
        </header>
        <div class="activity-feed" style="padding: 0 0.9rem;">
          <div v-for="item in activityItems" :key="item.id" class="act-item">
            <div class="act-av" :class="item.avClass">{{ item.initials }}</div>
            <div class="act-txt">
              <strong>{{ item.name }}</strong>
              &nbsp;<span style="opacity:.6">via</span>&nbsp;
              <strong>{{ item.tenant }}</strong>
              &nbsp;·&nbsp;<span class="act-txn">{{ item.dealNumber }}</span>
              &nbsp;<span class="act-amt">{{ item.amount }}</span>
            </div>
            <StatusBadge :status="item.status" style="flex-shrink:0" />
            <div class="act-time">{{ item.time }}</div>
          </div>
          <div v-if="activityItems.length === 0" class="empty-state" style="padding:24px">
            <div class="es-glyph"><i class="pi pi-inbox" /></div>
            <h4>No deals yet</h4>
            <p>Deals will appear here once they're created.</p>
          </div>
        </div>
      </section>

    </div>


  </div>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.kyb-strip {
  grid-template-columns: repeat(3, 1fr);
}

/* Charts row */
.charts-row {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 1rem;
}

/* Data row */
.data-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  align-items: start;
}

.panel {
  padding: 0;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.btn-ghost.sm {
  padding: 0.3rem 0.65rem;
  font-size: 0.74rem;
}

/* Tenant health */
.health-list {
  list-style: none;
  margin: 0;
  padding: 0.35rem;
  display: flex;
  flex-direction: column;
}

.health-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.health-row:hover {
  background: color-mix(in srgb, var(--accent-1) 6%, transparent);
}

.h-av {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.62rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.health-name {
  flex: 1;
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.health-meta {
  font-size: 0.74rem;
  color: var(--text-secondary);
}

.health-overdue {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--danger);
  min-width: 80px;
  text-align: right;
}

.health-overdue.zero {
  color: var(--text-secondary);
}

/* Integration */
.integ {
  padding: 0;
}

.integ-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
}

.integ-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  border-right: 1px solid var(--border-subtle);
}

.integ-item:last-child {
  border-right: none;
}

.integ-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.integ-label {
  font-size: 0.84rem;
  font-weight: 700;
}

.integ-state {
  font-size: 0.68rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.integ-detail {
  margin-left: auto;
  font-size: 0.66rem;
  color: var(--text-secondary);
  text-align: right;
}

@media (max-width: 900px) {
  .charts-row {
    grid-template-columns: 1fr;
  }

  .data-row {
    grid-template-columns: 1fr;
  }

  .integ-row {
    grid-template-columns: repeat(3, 1fr);
  }

  .integ-item {
    border-right: none;
    border-bottom: 1px solid var(--border-subtle);
  }

  .integ-item:last-child {
    border-bottom: none;
  }
}

@media (max-width: 600px) {
  .integ-row {
    grid-template-columns: 1fr 1fr;
  }

  .integ-detail {
    display: none;
  }
}
</style>
