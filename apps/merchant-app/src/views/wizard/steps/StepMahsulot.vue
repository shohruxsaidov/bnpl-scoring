<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWizardStore } from '@/stores/wizard'
import { useCatalogStore } from '@/stores/catalog'
import MonoAmount from '@/components/MonoAmount.vue'

const wizard = useWizardStore()
const catalog = useCatalogStore()
const { t: tr } = useI18n()

const activeCategory = ref<string | null>(null)

const filteredProducts = computed(() =>
  catalog.productsByCategory(activeCategory.value),
)

const tariff = computed(() => wizard.sessionData.tariff)
const total = computed(() => wizard.basketTotal)

const withinRange = computed(() => {
  const t = tariff.value
  if (!t) return false
  return total.value >= t.creditMin && total.value <= t.creditMax
})

const rangeMsg = computed(() => {
  const t = tariff.value
  if (!t) return ''
  if (total.value < t.creditMin)
    return tr('stepMahsulot.addMore', { amount: ((t.creditMin - total.value) / 100).toLocaleString('uz-UZ') })
  if (total.value > t.creditMax)
    return tr('stepMahsulot.overMax', { amount: ((total.value - t.creditMax) / 100).toLocaleString('uz-UZ') })
  return tr('stepMahsulot.withinRange')
})

function next() {
  if (withinRange.value) wizard.complete('mahsulot')
}
</script>

<template>
  <div class="step-layout">
    <div class="step-card surface-card catalog">
      <header class="sc-head">
        <div>
          <h2>{{ $t('stepMahsulot.title') }}</h2>
          <p>{{ $t('stepMahsulot.subtitle') }}</p>
        </div>
      </header>

      <div class="chips">
        <button
          class="chip"
          :class="{ active: activeCategory === null }"
          @click="activeCategory = null"
        >
          {{ $t('stepMahsulot.all') }}
        </button>
        <button
          v-for="c in catalog.categories"
          :key="c.id"
          class="chip"
          :class="{ active: activeCategory === c.id }"
          @click="activeCategory = c.id"
        >
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
            <MonoAmount :value="Math.round(parseFloat(p.tanNarxi) * 100)" size="sm" />
            <button class="add-btn" @click="wizard.addToBasket(p)">
              <i class="pi pi-plus" /> {{ $t('stepMahsulot.add') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <aside class="step-card surface-card basket">
      <h3>
        <i class="pi pi-shopping-cart" /> {{ $t('stepMahsulot.basket') }}
        <span class="count">{{ wizard.basketCount }}</span>
      </h3>

      <div v-if="wizard.sessionData.basket.length === 0" class="empty-basket">
        <i class="pi pi-inbox" />
        <span>{{ $t('stepMahsulot.noProducts') }}</span>
      </div>

      <div v-else class="basket-items">
        <div
          v-for="item in wizard.sessionData.basket"
          :key="item.product.id"
          class="basket-item"
        >
          <div class="bi-top">
            <span class="bi-name">{{ item.product.name }}</span>
            <button
              class="bi-remove"
              @click="wizard.removeFromBasket(item.product.id)"
            >
              <i class="pi pi-times" />
            </button>
          </div>
          <div class="bi-bottom">
            <div class="qty">
              <button @click="wizard.decrementItem(item.product.id)">
                <i class="pi pi-minus" />
              </button>
              <span class="font-mono">{{ item.quantity }}</span>
              <button @click="wizard.incrementItem(item.product.id)">
                <i class="pi pi-plus" />
              </button>
            </div>
            <MonoAmount
              :value="Math.round(parseFloat(item.product.tanNarxi) * 100) * item.quantity"
              size="sm"
              :gradient="false"
            />
          </div>
        </div>
      </div>

      <div class="basket-summary">
        <div class="bs-row">
          <span>{{ $t('stepMahsulot.basketTotal') }}</span>
          <MonoAmount :value="total" size="md" />
        </div>
        <div v-if="tariff" class="bs-range font-mono">
          {{ $t('stepMahsulot.range', {
            min: (tariff.creditMin / 100).toLocaleString('uz-UZ'),
            max: (tariff.creditMax / 100).toLocaleString('uz-UZ'),
          }) }}
        </div>
        <div
          class="bs-status"
          :class="withinRange ? 'ok' : 'bad'"
        >
          <i :class="withinRange ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle'" />
          {{ rangeMsg }}
        </div>
      </div>

      <div class="basket-foot">
        <button class="btn-ghost" @click="wizard.back()">
          <i class="pi pi-arrow-left" /> {{ $t('common.back') }}
        </button>
        <button class="btn-gradient" :disabled="!withinRange" @click="next">
          {{ $t('common.continue') }} <i class="pi pi-arrow-right" />
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
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1.4rem 0;
}
.chip {
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
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
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}
.product {
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
  justify-content: space-between;
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
  top: 84px;
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
.bs-range {
  font-size: 0.72rem;
  color: var(--text-secondary);
}
.bs-status {
  font-size: 0.76rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
}
.bs-status.ok {
  color: var(--success);
  background: var(--success-bg);
}
.bs-status.bad {
  color: var(--warning);
  background: var(--warning-bg);
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
</style>
