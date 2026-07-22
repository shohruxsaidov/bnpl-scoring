<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import DealsTable from './deals-table.vue'
import DealSessionsTable from './deal-sessions-table.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

// The tab lives in a query param, not a child route: `/deals/:id` already owns
// the path segment after /deals, so a `/deals/sessions` route would sit one
// mistyped id away from silently swallowing a deal link.
type DealsTab = 'deals' | 'sessions'

const tab = computed<DealsTab>(() => (route.query.tab === 'sessions' ? 'sessions' : 'deals'))

function selectTab(value: DealsTab) {
  if (value === tab.value) return
  router.replace({ query: value === 'sessions' ? { tab: 'sessions' } : {} })
}

const TABS: Array<{ value: DealsTab; labelKey: string }> = [
  { value: 'deals', labelKey: 'dealsPage.title' },
  { value: 'sessions', labelKey: 'dealSessions.title' },
]

const dealCount = ref(0)
const sessionsVisible = computed(() => tab.value === 'sessions')
</script>

<template>
  <div class="deals-page">
    <!-- ── Header — shared by both tabs ─────────────────────────────────── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('dealsPage.title') }}</h1>
        <p class="page-sub">
          {{
            tab === 'sessions'
              ? t('dealSessions.subtitle')
              : t('dealsPage.subtitle', { count: dealCount })
          }}
        </p>
      </div>
      <button v-if="auth.isAgent" class="btn-gradient" @click="router.push('/deals/create')">
        <i class="pi pi-plus" /> {{ t('dashboard.newDeal') }}
      </button>
    </div>

    <!-- ── Tab switch ───────────────────────────────────────────────────── -->
    <div class="tab-switch" role="tablist">
      <button v-for="item in TABS" :key="item.value" class="tab-btn" role="tab"
        :class="{ active: tab === item.value }" :aria-selected="tab === item.value"
        @click="selectTab(item.value)">
        {{ t(item.labelKey) }}
      </button>
    </div>

    <!-- Both panels stay mounted — v-show, not v-if — so each keeps its own
         filter state and neither refetches when you flip between them. The
         sessions panel gates its own polling on `visible`. -->
    <div v-show="tab === 'deals'">
      <DealsTable @count="dealCount = $event" />
    </div>
    <div v-show="tab === 'sessions'">
      <DealSessionsTable :visible="sessionsVisible" />
    </div>
  </div>
</template>

<style scoped>
.deals-page {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

/* ── Page header ────────────────────────────────────────────────────────────*/
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.page-title {
  margin: 0 0 0.2rem;
  font-size: 1.55rem;
  font-weight: 800;
}

.page-sub {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* ── Tab switch ─────────────────────────────────────────────────────────────*/
.tab-switch {
  display: inline-flex;
  align-self: flex-start;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--bg-surface);
}

.tab-btn {
  border: none;
  border-radius: 9px;
  padding: 0.45rem 1rem;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.tab-btn:hover:not(.active) {
  color: var(--text-primary);
  background: var(--bg-base);
}

.tab-btn.active {
  background: var(--gradient-accent);
  color: #fff;
}

/* ── Responsive ─────────────────────────────────────────────────────────────*/
@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
