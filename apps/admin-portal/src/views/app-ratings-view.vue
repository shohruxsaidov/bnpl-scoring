<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAppRatingsApi } from '@/composables/use-app-ratings-api'
import type { Star } from '@/composables/use-app-ratings-api'

const ratings = useAppRatingsApi()

const STARS: Star[] = [5, 4, 3, 2, 1]

// Bars are scaled to the BIGGEST bucket, not to the total. Ratings cluster hard
// at 5, so scaling to the total would flatten every other bar to a sliver and
// hide the shape of the distribution — which is the only thing this panel is for.
const peak = computed(() => Math.max(...STARS.map((s) => ratings.summary.value.histogram[s]), 1))

const rows = computed(() =>
  STARS.map((star) => {
    const count = ratings.summary.value.histogram[star]
    return {
      star,
      count,
      barPct: (count / peak.value) * 100,
      // Share of all ratings — what a reader actually wants to reason about,
      // even though the bar length is peak-relative.
      sharePct: ratings.summary.value.count === 0 ? 0 : (count / ratings.summary.value.count) * 100,
    }
  }),
)

const averageLabel = computed(() => {
  const avg = ratings.summary.value.average
  return avg === null ? '—' : avg.toFixed(2)
})

// Rounded to the nearest half star for the glyph row; null average shows an
// empty row rather than a fake zero.
function starClass(position: number): string {
  const avg = ratings.summary.value.average
  if (avg === null) return 'pi pi-star'
  if (avg >= position) return 'pi pi-star-fill'
  if (avg >= position - 0.5) return 'pi pi-star-half-fill'
  return 'pi pi-star'
}

onMounted(() => ratings.fetch())
</script>

<template>
  <div class="ratings-page">
    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('appRatings.title') }}</h3>
        <p class="section-hint">{{ $t('appRatings.hint') }}</p>
      </header>

      <p v-if="ratings.loading.value" class="empty">{{ $t('common.loading') }}</p>

      <div v-else-if="ratings.error.value" class="empty-state" style="padding: 24px">
        <div class="es-glyph"><i class="pi pi-exclamation-triangle" /></div>
        <h4>{{ $t('common.error') }}</h4>
        <button class="btn-ghost" @click="ratings.fetch()">{{ $t('common.retry') }}</button>
      </div>

      <div v-else-if="ratings.summary.value.count === 0" class="empty-state" style="padding: 24px">
        <div class="es-glyph"><i class="pi pi-star" /></div>
        <h4>{{ $t('appRatings.emptyTitle') }}</h4>
        <p>{{ $t('appRatings.emptyHint') }}</p>
      </div>

      <div v-else class="ratings-body">
        <div class="score-block">
          <div class="score-value font-mono">{{ averageLabel }}</div>
          <div class="score-stars">
            <i v-for="p in 5" :key="p" :class="starClass(p)" />
          </div>
          <div class="score-count muted">
            {{ $t('appRatings.ratingCount', { count: ratings.summary.value.count }) }}
          </div>
        </div>

        <ul class="histogram">
          <li v-for="row in rows" :key="row.star" class="hist-row">
            <span class="hist-star">
              {{ row.star }}
              <i class="pi pi-star-fill" />
            </span>
            <div class="hist-track">
              <div class="hist-bar" :style="{ width: `${row.barPct}%` }" />
            </div>
            <span class="hist-count font-mono">{{ row.count }}</span>
            <span class="hist-share muted font-mono">{{ row.sharePct.toFixed(0) }}%</span>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ratings-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 760px;
}
.panel {
  padding: 0;
  overflow: hidden;
}
.panel-head {
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid var(--border-subtle);
}
.section-title {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}
.section-hint {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.ratings-body {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 1.4rem 1.1rem;
  flex-wrap: wrap;
}
.score-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  min-width: 8rem;
}
.score-value {
  font-size: 2.6rem;
  font-weight: 800;
  line-height: 1;
}
.score-stars {
  display: flex;
  gap: 0.15rem;
  color: var(--warning);
  font-size: 0.9rem;
}
.score-count {
  font-size: 0.76rem;
}
.histogram {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  min-width: 16rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.hist-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.hist-star {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  width: 2rem;
  flex-shrink: 0;
}
.hist-star .pi {
  font-size: 0.6rem;
  color: var(--warning);
}
.hist-track {
  flex: 1;
  height: 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-secondary) 12%, transparent);
  overflow: hidden;
}
.hist-bar {
  height: 100%;
  border-radius: 999px;
  background: var(--accent-1);
  transition: width 0.2s ease;
}
.hist-count {
  font-size: 0.78rem;
  font-weight: 700;
  width: 2.5rem;
  text-align: right;
  flex-shrink: 0;
}
.hist-share {
  font-size: 0.72rem;
  width: 2.5rem;
  text-align: right;
  flex-shrink: 0;
}
.empty {
  margin: 0;
  padding: 1rem 1.1rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}
</style>
