<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import JsonNode from './json-node.vue'
import {
  type Json,
  type ReportCard,
  type ReportSection,
  branchCount,
  isDeepEmpty,
  isObject,
} from '@/utils/json-report'

const props = defineProps<{
  data: Json
  sections: ReportSection[]
  labels: Record<string, string>
  cards?: ReportCard[]
}>()

const { t } = useI18n()
const root = ref<HTMLElement | null>(null)
const showMeta = ref(false)

interface RenderedSection {
  key: string
  title: string
  value: unknown
  empty: boolean
  note: string | null
  count: number | null
}

const sections = computed<RenderedSection[]>(() =>
  props.sections
    .filter((s) => props.data[s.key] !== undefined)
    .map((s) => {
      const value = props.data[s.key]
      const empty = isDeepEmpty(value)
      const note = isObject(value)
        ? ((value as Json).notes as string) || ((value as Json).declaration as string) || null
        : null
      return { key: s.key, title: s.title, value, empty, note, count: branchCount(value) }
    })
    // Drop sections with no data (e.g. Условные обязательства) rather than show a placeholder.
    .filter((s) => !s.empty),
)

function setAll(open: boolean) {
  root.value?.querySelectorAll('details').forEach((d) => {
    d.open = open
  })
}
</script>

<template>
  <div ref="root" class="json-report">
    <div v-if="cards && cards.length" class="cards">
      <div v-for="c in cards" :key="c.label" class="stat">
        <div class="l">{{ c.label }}</div>
        <div class="v">{{ c.value }}</div>
      </div>
    </div>

    <div class="controls">
      <button class="btn-ghost" @click="setAll(true)">{{ t('jsonReport.expandAll') }}</button>
      <button class="btn-ghost" @click="setAll(false)">{{ t('jsonReport.collapseAll') }}</button>
    </div>

    <section v-for="s in sections" :key="s.key" class="block">
      <h2>
        {{ s.title }}
        <span v-if="s.count != null" class="n">{{ s.count }}</span>
      </h2>
      <div class="body">
        <div v-if="s.empty" class="note">— {{ t('jsonReport.none') }} —</div>
        <template v-else>
          <div v-if="s.note" class="note">{{ s.note }}</div>
          <JsonNode :value="s.value" :labels="labels" :show-meta="showMeta" />
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.json-report {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cards {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 12px 16px;
  min-width: 130px;
  flex: 1;
}

.stat .l {
  color: var(--text-secondary);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.stat .v {
  font-size: 18px;
  font-weight: 700;
  margin-top: 4px;
}

.controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.block {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;
}

.block > h2 {
  margin: 0;
  font-size: 14px;
  padding: 13px 18px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  gap: 10px;
}

.block > h2 .n {
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 12px;
}

.body {
  padding: 10px 18px 14px;
}

.note {
  color: var(--text-secondary);
  font-size: 12.5px;
  white-space: pre-wrap;
  line-height: 1.7;
  margin-bottom: 8px;
}
</style>
