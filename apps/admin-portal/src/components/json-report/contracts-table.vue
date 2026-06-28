<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ReportTable from './report-table.vue'
import { CONTRACT_COLUMNS, CONTRACT_DETAIL_TABLES } from './scoring-report-config'
import {
  type ColumnDef,
  type Json,
  formatCell,
  isEmpty,
  isObject,
  labelFor,
  partition,
} from '@/utils/json-report'

const props = defineProps<{
  // The `contracts` section wrapper: { contract: [...] }.
  value: unknown
  labels: Record<string, string>
  tiyin?: boolean
}>()

const { t } = useI18n()

const contracts = computed<Json[]>(() => {
  const v = props.value
  const arr = Array.isArray(v) ? v : isObject(v) ? (v as Json).contract : null
  return Array.isArray(arr) ? (arr.filter(isObject) as Json[]) : []
})

const open = ref<Set<number>>(new Set())
function toggle(i: number) {
  const next = new Set(open.value)
  next.has(i) ? next.delete(i) : next.add(i)
  open.value = next
}

const summaryKeys = CONTRACT_COLUMNS.map((c) => c.key)

function header(col: ColumnDef): string {
  return col.label ?? labelFor(col.key, props.labels)
}
function cell(col: ColumnDef, row: Json) {
  return formatCell(col.key, row[col.key], col.format, props.tiyin)
}
function cellClass(kind: string): string {
  return kind === 'money' ? 'money' : kind === 'empty' ? 'dash' : ''
}
function colClass(col: ColumnDef): string {
  return col.format === 'money' || col.format === 'percent' ? 'num' : ''
}

// Curated scalar grid for the expanded row: every leaf that isn't already a
// summary column, dropping bookkeeping (*_change) and empty fields.
function detailFields(c: Json) {
  return partition(c, false)
    .leaves.filter((k) => !summaryKeys.includes(k) && !isEmpty(c[k]))
    .map((k) => ({ key: k, label: labelFor(k, props.labels), leaf: formatCell(k, c[k], undefined, props.tiyin) }))
}

// Pull a nested list (wrapping a single object as a one-row list).
function nestedRows(c: Json, path: [string, string]): Json[] {
  const wrap = c[path[0]]
  if (!isObject(wrap)) return []
  const inner = (wrap as Json)[path[1]]
  if (Array.isArray(inner)) return inner.filter(isObject) as Json[]
  if (isObject(inner)) return [inner as Json]
  return []
}
function detailTables(c: Json) {
  return CONTRACT_DETAIL_TABLES.map((path) => ({
    title: labelFor(path[1], props.labels),
    rows: nestedRows(c, path),
  })).filter((d) => d.rows.length)
}
</script>

<template>
  <div class="contracts-table">
    <div v-if="!contracts.length" class="note">— {{ t('jsonReport.none') }} —</div>

    <div v-else class="table-scroll">
      <table>
        <thead>
          <tr>
            <th class="tw-col" />
            <th v-for="c in CONTRACT_COLUMNS" :key="c.key" :class="colClass(c)">{{ header(c) }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(row, i) in contracts" :key="i">
            <tr class="summary-row" :class="{ open: open.has(i) }" @click="toggle(i)">
              <td class="tw-col">
                <span class="tw">{{ open.has(i) ? '▾' : '▸' }}</span>
              </td>
              <td v-for="c in CONTRACT_COLUMNS" :key="c.key" :class="colClass(c)">
                <span :class="cellClass(cell(c, row).kind)">{{ cell(c, row).text }}</span>
              </td>
            </tr>
            <tr v-if="open.has(i)" class="detail-row">
              <td :colspan="CONTRACT_COLUMNS.length + 1">
                <dl v-if="detailFields(row).length" class="fields">
                  <div v-for="f in detailFields(row)" :key="f.key" class="row">
                    <span class="lbl">{{ f.label }}</span>
                    <span class="val"><span :class="cellClass(f.leaf.kind)">{{ f.leaf.text }}</span></span>
                  </div>
                </dl>
                <div v-for="d in detailTables(row)" :key="d.title" class="mini">
                  <h4>{{ d.title }}</h4>
                  <ReportTable :value="d.rows" :labels="labels" :tiyin="tiyin" />
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th {
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  white-space: nowrap;
}

th.num,
td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.tw-col {
  width: 24px;
  padding-left: 12px;
}

.summary-row {
  cursor: pointer;
}

.summary-row > td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.summary-row:hover > td {
  background: var(--bg-surface);
}

.summary-row.open > td {
  background: var(--bg-surface);
  font-weight: 600;
}

.tw {
  color: var(--text-secondary);
}

.money {
  color: var(--success);
}

.dash {
  color: var(--text-secondary);
  opacity: 0.6;
}

.detail-row > td {
  padding: 12px 16px 16px 36px;
  background: var(--bg-base);
  border-bottom: 1px solid var(--border-subtle);
}

dl.fields {
  margin: 0 0 8px;
  display: grid;
  grid-template-columns: minmax(170px, 240px) 1fr;
  gap: 2px 16px;
}

.row {
  display: contents;
}

.row .lbl {
  color: var(--text-secondary);
  padding: 5px 0;
}

.row .val {
  padding: 5px 0;
  word-break: break-word;
}

.mini {
  margin-top: 12px;
}

.mini h4 {
  margin: 0 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-secondary);
}

.note {
  color: var(--text-secondary);
  font-size: 12.5px;
}
</style>
