<script setup lang="ts">
import { computed } from 'vue'
import {
  type Json,
  branchCount,
  formatLeaf,
  isEmpty,
  isObject,
  itemSummary,
  labelFor,
  partition,
} from '@/utils/json-report'

defineOptions({ name: 'JsonNode' })

const props = defineProps<{
  value: unknown
  labels: Record<string, string>
  showMeta: boolean
}>()

const isArr = computed(() => Array.isArray(props.value))

// --- object branch ---
const obj = computed<Json>(() => (isObject(props.value) && !isArr.value ? (props.value as Json) : {}))
const parts = computed(() => partition(obj.value, props.showMeta))
const leaves = computed(() =>
  parts.value.leaves.map((k) => ({ key: k, label: labelFor(k, props.labels), leaf: formatLeaf(k, obj.value[k]) })),
)
const branches = computed(() =>
  parts.value.branches.map((k) => ({
    key: k,
    label: labelFor(k, props.labels),
    value: obj.value[k],
    count: branchCount(obj.value[k]),
    open: isBranchOpen(obj.value[k]),
  })),
)

// --- array branch ---
const arr = computed<unknown[]>(() => (isArr.value ? (props.value as unknown[]) : []))
const itemsAreObjects = computed(() => arr.value.length > 0 && isObject(arr.value[0]))
const items = computed(() =>
  arr.value.map((it, i) => ({ i, raw: it, ...itemSummary(it as Json) })),
)
const itemsOpen = computed(() => arr.value.length <= 12)
// Arrays whose items are each a single-field object (e.g. phones → [{ phone_number }, …])
// read better as a flat value list than as a stack of collapsible one-row cards.
const singleLeafList = computed<string[] | null>(() => {
  if (!itemsAreObjects.value) return null
  const out: string[] = []
  for (const it of arr.value) {
    if (!isObject(it)) return null
    const { leaves, branches } = partition(it as Json, props.showMeta)
    if (branches.length || leaves.length !== 1) return null
    const leaf = formatLeaf(leaves[0], (it as Json)[leaves[0]])
    if (isEmpty(leaf.text)) continue
    out.push(leaf.text)
  }
  return out.length ? out : null
})
const scalarList = computed(() => {
  const txt = arr.value.filter((x) => !isEmpty(x)).map(String).join(', ')
  return txt || '—'
})

function isBranchOpen(v: unknown): boolean {
  if (Array.isArray(v)) return v.length <= 12
  if (isObject(v)) return Object.keys(v).length <= 10
  return true
}

function leafClass(kind: string): string {
  switch (kind) {
    case 'empty':
      return 'dash'
    case 'money':
      return 'money'
    case 'pill-good':
      return 'pill-good'
    case 'pill-bad':
      return 'pill-bad'
    default:
      return ''
  }
}
</script>

<template>
  <!-- object: scalar field list + nested collapsible branches -->
  <template v-if="!isArr">
    <dl v-if="leaves.length" class="fields">
      <div v-for="l in leaves" :key="l.key" class="row">
        <span class="lbl">{{ l.label }}</span>
        <span class="val"><span :class="leafClass(l.leaf.kind)">{{ l.leaf.text }}</span></span>
      </div>
    </dl>
    <details v-for="b in branches" :key="b.key" class="sub" :open="b.open">
      <summary>
        <span class="tw" />
        <span class="branch-label">{{ b.label }}</span>
        <span v-if="b.count != null" class="chip">{{ b.count }}</span>
      </summary>
      <div class="inner">
        <JsonNode :value="b.value" :labels="labels" :show-meta="showMeta" />
      </div>
    </details>
  </template>

  <!-- array of single-field objects: flat value list (e.g. phone numbers) -->
  <template v-else-if="singleLeafList">
    <ul class="leaf-list">
      <li v-for="(v, i) in singleLeafList" :key="i">{{ v }}</li>
    </ul>
  </template>

  <!-- array of objects: list of summarised items -->
  <template v-else-if="itemsAreObjects">
    <details v-for="it in items" :key="it.i" class="item" :open="itemsOpen">
      <summary>
        <span class="tw" />
        <span class="sumtxt">{{ it.main }}</span>
        <span v-if="it.meta" class="summeta">{{ it.meta }}</span>
      </summary>
      <div class="inner">
        <JsonNode :value="it.raw" :labels="labels" :show-meta="showMeta" />
      </div>
    </details>
  </template>

  <!-- array of scalars -->
  <template v-else>
    <span class="scalar-list">{{ scalarList }}</span>
  </template>
</template>

<style scoped>
dl.fields {
  margin: 0;
  display: grid;
  grid-template-columns: minmax(170px, 260px) 1fr;
  gap: 2px 16px;
}

.row {
  display: contents;
}

.row .lbl {
  color: var(--text-secondary);
  padding: 6px 0;
}

.row .val {
  padding: 6px 0;
  word-break: break-word;
}

.val .money {
  color: var(--success);
  font-variant-numeric: tabular-nums;
}

.val .dash {
  color: var(--text-secondary);
  opacity: 0.6;
}

.pill-good {
  color: var(--success);
}

.pill-bad {
  color: var(--danger);
}

details.sub,
details.item {
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  margin: 8px 0;
  background: var(--bg-base);
}

details.sub > summary,
details.item > summary {
  cursor: pointer;
  list-style: none;
  padding: 9px 14px;
  font-weight: 600;
  display: flex;
  gap: 10px;
  align-items: center;
}

summary::-webkit-details-marker {
  display: none;
}

summary .tw {
  color: var(--text-secondary);
  width: 12px;
  display: inline-block;
}

details[open] > summary .tw::before {
  content: '▾';
}

details:not([open]) > summary .tw::before {
  content: '▸';
}

.inner {
  padding: 4px 14px 12px;
  border-top: 1px solid var(--border-subtle);
}

.item .sumtxt {
  font-weight: 600;
}

.item .summeta {
  color: var(--text-secondary);
  font-weight: 400;
  font-size: 12px;
  margin-left: auto;
}

.chip {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 20px;
  padding: 2px 10px;
  font-size: 11px;
  color: var(--text-secondary);
}

.scalar-list {
  word-break: break-word;
}

ul.leaf-list {
  margin: 4px 0;
  padding-left: 0;
  list-style: none;
}

ul.leaf-list li {
  padding: 6px 0;
  word-break: break-word;
}
</style>
