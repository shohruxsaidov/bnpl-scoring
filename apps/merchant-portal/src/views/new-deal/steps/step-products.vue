<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDealStore } from '@/stores/deal'
import { useCatalogStore } from '@/stores/catalog'
import { useClientScoringStore } from '@/stores/client-scoring'
import { saveSessionStep } from '@/composables/use-deal-session-api'
import MonoAmount from '@/components/mono-amount.vue'

const deal = useDealStore()
const catalog = useCatalogStore()
const scoring = useClientScoringStore()

onMounted(() => catalog.fetchCatalog())

const activeCategory = ref<string | null>(null)
const searchQuery = ref('')

const filteredProducts = computed(() => {
  const base = catalog.productsByCategory(activeCategory.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return base
  return base.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.mxikCode ?? '').toLowerCase().includes(q),
  )
})

const tariff = computed(() => deal.sessionData.tariff)
const total = computed(() => deal.basketTotal)

/** Product base price in tiyin */
function basePrice(price: string): number {
  return Math.round(parseFloat(price) * 100)
}

/** Price with tariff markup applied */
function finalPrice(price: string): number {
  const base = basePrice(price)
  const pct = tariff.value?.markupPercent ?? 0
  return Math.round(base * (1 + pct / 100))
}

/** Basket total including markup */
const totalWithMarkup = computed(() => {
  const pct = tariff.value?.markupPercent ?? 0
  return Math.round(total.value * (1 + pct / 100))
})

/** Approved limit (tiyin) scaled by the selected tariff's term in months */
const effectiveLimit = computed(
  () => (scoring.platformCreditLimit ?? 0) * (tariff.value?.termMonths ?? 0),
)

const withinLimit = computed(() => totalWithMarkup.value <= effectiveLimit.value)

/** How much of the limit is still available after the current basket */
const remainingLimit = computed(() =>
  Math.max(effectiveLimit.value - totalWithMarkup.value, 0),
)

/** Credit Range check on the base basket total (pre-markup, tiyin) */
const rangeWarning = computed(() => {
  const t = tariff.value
  if (!t || total.value === 0) return null
  if (t.minAmount != null && total.value < t.minAmount)
    return { key: 'belowTariffMin', amount: t.minAmount }
  if (t.maxAmount != null && total.value > t.maxAmount)
    return { key: 'aboveTariffMax', amount: t.maxAmount }
  return null
})

const canProceed = computed(
  () => !!tariff.value && total.value > 0 && withinLimit.value && rangeWarning.value == null,
)

const { t: tr } = useI18n()
const saving = ref(false)
const saveError = ref('')

async function next() {
  if (!canProceed.value || saving.value) return

  // Blocking step save — the server snapshots names and prices per line; the
  // signed contract is built from this snapshot (ADR-0024)
  saving.value = true
  saveError.value = ''
  try {
    await saveSessionStep(deal.dealSessionId!, 'products', {
      lines: deal.sessionData.basket.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    })
  } catch {
    saveError.value = tr('deal.stepSaveError')
    return
  } finally {
    saving.value = false
  }

  deal.complete('products')
}
</script>

<template>
  <div class="step-layout">
    <div class="step-card surface-card catalog">
      <header class="sc-head">
        <div>
          <h2>{{ $t('stepProducts.title') }}</h2>
          <p>{{ $t('stepProducts.subtitle') }}</p>
        </div>
      </header>

      <div class="search-row">
        <i class="pi pi-search search-icon" />
        <input v-model="searchQuery" type="text" class="search-input"
          :placeholder="$t('stepProducts.searchPlaceholder')" />
        <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
          <i class="pi pi-times" />
        </button>
      </div>

      <div class="chips">
        <button class="chip" :class="{ active: activeCategory === null }" @click="activeCategory = null">
          {{ $t('stepProducts.all') }}
        </button>
        <button v-for="c in catalog.categories" :key="c.id" class="chip" :class="{ active: activeCategory === c.id }"
          @click="activeCategory = c.id">
          {{ c.name }}
        </button>
      </div>

      <div class="product-grid">
        <div v-for="p in filteredProducts" :key="p.id" class="product">
          <div class="p-info">
            <span class="p-name">{{ p.name }}</span>
            <span class="p-sku font-mono">{{ p.mxikCode ?? '' }}</span>
            <span class="p-cat">{{ catalog.categoryName(p.categoryId) }}</span>
          </div>
          <div class="p-bottom">
            <div class="p-prices">
              <div class="p-price-row">
                <MonoAmount :value="finalPrice(p.price)" size="sm" />
                <span v-if="tariff" class="p-markup">+{{ tariff.markupPercent }}%</span>
              </div>
              <span v-if="tariff && tariff.markupPercent > 0" class="p-base">
                {{ $t('stepProducts.basePrice') }}
                <MonoAmount :value="basePrice(p.price)" size="sm" :gradient="false" />
              </span>
            </div>
            <button class="add-btn" @click="deal.addToBasket(p)">
              <i class="pi pi-plus" /> {{ $t('stepProducts.add') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <aside class="step-card surface-card basket">
      <div v-if="tariff" class="limit-banner" :class="{ over: !withinLimit }">
        <span class="lb-label">{{ $t('stepProducts.limit', { months: tariff.termMonths }) }}</span>
        <MonoAmount :value="effectiveLimit" size="lg" />
        <div class="lb-remaining">
          <span>{{ $t('stepProducts.remaining') }}</span>
          <MonoAmount :value="remainingLimit" size="sm" :gradient="false" />
        </div>
      </div>

      <h3>
        <i class="pi pi-shopping-cart" /> {{ $t('stepProducts.basket') }}
        <span class="count">{{ deal.basketCount }}</span>
      </h3>

      <div v-if="deal.sessionData.basket.length === 0" class="empty-basket">
        <i class="pi pi-inbox" />
        <span>{{ $t('stepProducts.noProducts') }}</span>
      </div>

      <div v-else class="basket-items">
        <div v-for="item in deal.sessionData.basket" :key="item.product.id" class="basket-item">
          <div class="bi-top">
            <span class="bi-name">{{ item.product.name }}</span>
            <button class="bi-remove" @click="deal.removeFromBasket(item.product.id)">
              <i class="pi pi-times" />
            </button>
          </div>
          <div class="bi-bottom">
            <div class="qty">
              <button @click="deal.decrementItem(item.product.id)">
                <i class="pi pi-minus" />
              </button>
              <span class="font-mono">{{ item.quantity }}</span>
              <button @click="deal.incrementItem(item.product.id)">
                <i class="pi pi-plus" />
              </button>
            </div>
            <MonoAmount :value="finalPrice(item.product.price) * item.quantity" size="sm" :gradient="false" />
          </div>
        </div>
      </div>

      <div class="basket-summary">
        <div v-if="tariff" class="bs-row markup-row">
          <span>{{ $t('stepProducts.withMarkup', { pct: tariff.markupPercent }) }}</span>
          <MonoAmount :value="totalWithMarkup" size="md" />
        </div>
        <div v-if="tariff && !withinLimit" class="bs-overlimit">
          <i class="pi pi-exclamation-triangle" />
          {{ $t('stepProducts.overLimit', {
            amount: ((totalWithMarkup - effectiveLimit) / 100).toLocaleString('uz-UZ'),
          }) }}
        </div>
        <div v-if="rangeWarning" class="bs-overlimit">
          <i class="pi pi-exclamation-triangle" />
          {{ $t(`stepProducts.${rangeWarning.key}`, {
            amount: (rangeWarning.amount / 100).toLocaleString('uz-UZ'),
          }) }}
        </div>
      </div>

      <div v-if="saveError" class="bs-overlimit">
        <i class="pi pi-exclamation-triangle" /> {{ saveError }}
      </div>

      <div class="basket-foot">
        <button class="btn-ghost" @click="deal.back()">
          <i class="pi pi-arrow-left" /> {{ $t('common.back') }}
        </button>
        <button class="btn-gradient" :disabled="!canProceed || saving" @click="next">
          <i v-if="saving" class="pi pi-spin pi-spinner" />
          {{ $t('common.continue') }} <i v-if="!saving" class="pi pi-arrow-right" />
        </button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.step-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 1.4rem;
  align-items: start;
}

.step-card {
  padding: 1.8rem;
}

.sc-head h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
}

.sc-head p {
  margin: 0.3rem 0 0;
  color: var(--text-secondary);
  font-size: 0.86rem;
}

.search-row {
  position: relative;
  display: flex;
  align-items: center;
  margin: 1.4rem 0 0.8rem;
}

.search-icon {
  position: absolute;
  left: 0.85rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 38px;
  padding: 0 2.2rem 0 2.4rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.15s ease;
}

.search-input:focus {
  border-color: var(--accent-2);
}

.search-clear {
  position: absolute;
  right: 0.6rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  display: grid;
  place-items: center;
  padding: 0.2rem;
}

.search-clear:hover {
  color: var(--text-primary);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.6rem 0 1rem;
}

.chip {
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: none;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chip.active {
  background: var(--gradient-hero);
  color: #fff;
  border-color: transparent;
}

.product-grid {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.product {
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 0.9rem 1.2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.2rem;
  background: var(--bg-surface);
}

.p-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.p-name {
  font-weight: 700;
  font-size: 0.9rem;
}

.p-sku {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.p-cat {
  font-size: 0.7rem;
  color: var(--accent-2);
  font-weight: 700;
}

.p-bottom {
  display: flex;
  align-items: center;
  gap: 1.4rem;
  flex-shrink: 0;
}

.p-prices {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.p-price-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.p-base {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.68rem;
  color: var(--text-secondary);
}

.p-base :deep(.mono-amount) {
  color: var(--text-secondary);
}

.p-markup {
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--success);
  background: var(--success-bg);
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
}

.add-btn {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  color: var(--accent-2);
  font-weight: 700;
  font-size: 0.76rem;
  padding: 0.35rem 0.7rem;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.15s ease;
}

.add-btn:hover {
  background: var(--gradient-hero);
  color: #fff;
  border-color: transparent;
}

.basket {
  position: sticky;
  top: 68px;
  max-height: calc(100vh - 68px);
  overflow-y: auto;
}

.basket h3 {
  margin: 0 0 1.2rem;
  font-size: 1.05rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.count {
  margin-left: auto;
  background: var(--gradient-accent);
  color: #fff;
  font-size: 0.74rem;
  min-width: 22px;
  height: 22px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  padding: 0 6px;
}

.limit-banner {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-bottom: 1.2rem;
  padding: 0.9rem 1.2rem;
  border: 2px solid var(--accent-2);
  border-radius: 14px;
  box-shadow: var(--accent-glow);
  background: var(--bg-base);
}

.limit-banner.over {
  border-color: var(--warning);
  box-shadow: none;
}

.lb-label {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--accent-2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.limit-banner.over .lb-label {
  color: var(--warning);
}

.lb-remaining {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.45rem;
  padding-top: 0.45rem;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.lb-remaining :deep(.mono-amount) {
  color: var(--text-secondary);
}

.limit-banner.over .lb-remaining {
  color: var(--warning);
}

.limit-banner.over .lb-remaining :deep(.mono-amount) {
  color: var(--warning);
}

.empty-basket {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 2.5rem 0;
  color: var(--text-secondary);
}

.empty-basket i {
  font-size: 1.8rem;
}

.basket-items {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  max-height: 280px;
  overflow-y: auto;
}

.basket-item {
  background: var(--bg-surface);
  border-radius: 12px;
  padding: 0.8rem;
}

.bi-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.bi-name {
  font-size: 0.82rem;
  font-weight: 700;
}

.bi-remove {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.78rem;
}

.bi-remove:hover {
  color: var(--danger);
}

.bi-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.6rem;
}

.qty {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.qty button {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-primary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 0.7rem;
}

.qty button:hover {
  border-color: var(--accent-2);
  color: var(--accent-2);
}

.basket-summary {
  margin-top: 1.2rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.bs-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 0.86rem;
}

.bs-row.muted {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.base-total {
  font-size: 0.78rem;
}

.markup-row {
  padding-top: 0.4rem;
  border-top: 1px solid var(--border-subtle);
}

.bs-overlimit {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--warning);
  background: var(--warning-bg);
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
}

.basket-foot {
  margin-top: 1.2rem;
  display: flex;
  gap: 0.6rem;
}

.basket-foot button {
  flex: 1;
  justify-content: center;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

@media (max-width: 900px) {
  .step-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .product {
    flex-direction: column;
    align-items: stretch;
  }

  .p-bottom {
    justify-content: space-between;
  }

  .p-prices {
    align-items: flex-start;
  }
}
</style>
