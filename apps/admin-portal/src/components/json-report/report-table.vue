<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  type ColumnDef,
  type Json,
  type TableConfig,
  autoColumns,
  dateSortKey,
  formatCell,
  isObject,
  labelFor,
} from '@/utils/json-report'

const props = defineProps<{
  // The section wrapper object (e.g. { open_contract: [...], all_debt_sum }),
  // or an array directly (mini-tables).
  value: unknown
  labels: Record<string, string>
  config?: TableConfig
  tiyin?: boolean
}>()

const { t } = useI18n()
const cfg = computed<TableConfig>(() => props.config ?? {})

// --- extract the row array ---------------------------------------------------
const rawRows = computed<Json[]>(() => {
  const v = props.value
  let arr: unknown
  if (Array.isArray(v)) arr = v
  else if (isObject(v)) {
    const o = v as Json
    arr = cfg.value.arrayKey
      ? o[cfg.value.arrayKey]
      : Object.values(o).find((x) => Array.isArray(x))
  }
  return Array.isArray(arr) ? (arr.filter(isObject) as Json[]) : []
})

// --- default date-desc sort --------------------------------------------------
const rows = computed<Json[]>(() => {
  const keys = cfg.value.sortKeys
  if (!keys || !keys.length) return rawRows.value
  const pick = (r: Json) => keys.map((k) => r[k]).find((x) => x != null && x !== '')
  return [...rawRows.value].sort((a, b) =>
    dateSortKey(pick(b)).localeCompare(dateSortKey(pick(a))),
  )
})

const columns = computed<ColumnDef[]>(() => cfg.value.columns ?? autoColumns(rawRows.value))

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
  return col.align === 'right' || col.format === 'money' || col.format === 'percent'
    ? 'num'
    : ''
}

// --- aggregate strip ---------------------------------------------------------
const aggregates = computed(() => {
  const defs = cfg.value.aggregates
  if (!defs || !isObject(props.value)) return []
  const o = props.value as Json
  return defs.map((a) => ({
    label: header(a),
    cell: formatCell(a.key, o[a.key], a.format, props.tiyin),
  }))
})

// --- pagination --------------------------------------------------------------
const page = ref(0)
const pageSize = computed(() => cfg.value.pageSize ?? 0)
const paginated = computed(() => pageSize.value > 0 && rows.value.length > pageSize.value)
const pageCount = computed(() =>
  paginated.value ? Math.ceil(rows.value.length / pageSize.value) : 1,
)
const pageRows = computed(() =>
  paginated.value
    ? rows.value.slice(page.value * pageSize.value, (page.value + 1) * pageSize.value)
    : rows.value,
)
// Reset to the first page when the underlying data changes.
watch(rawRows, () => {
  page.value = 0
})
</script>

<template>
  <div class="report-table">
    <div v-if="aggregates.length" class="agg-strip">
      <div v-for="a in aggregates" :key="a.label" class="agg">
        <div class="agg-l">{{ a.label }}</div>
        <div class="agg-v" :class="cellClass(a.cell.kind)">{{ a.cell.text }}</div>
      </div>
    </div>

    <div v-if="!rows.length" class="note">— {{ t('jsonReport.none') }} —</div>

    <template v-else>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th v-for="c in columns" :key="c.key" :class="colClass(c)">{{ header(c) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in pageRows" :key="i">
              <td v-for="c in columns" :key="c.key" :class="colClass(c)">
                <span :class="cellClass(cell(c, row).kind)">{{ cell(c, row).text }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="paginated" class="pager">
        <button class="btn-ghost" :disabled="page === 0" @click="page--">
          {{ t('common.prev') }}
        </button>
        <span class="pager-info">{{ page + 1 }} / {{ pageCount }} · {{ rows.length }}</span>
        <button class="btn-ghost" :disabled="page >= pageCount - 1" @click="page++">
          {{ t('common.next') }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.report-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.agg-strip {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.agg {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 10px 14px;
  min-width: 130px;
  flex: 1;
}

.agg-l {
  color: var(--text-secondary);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.agg-v {
  font-size: 16px;
  font-weight: 700;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}

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

td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: top;
}

tbody tr:last-child td {
  border-bottom: none;
}

th.num,
td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.money {
  color: var(--success);
}

.dash {
  color: var(--text-secondary);
  opacity: 0.6;
}

.pager {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
}

.pager-info {
  color: var(--text-secondary);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.note {
  color: var(--text-secondary);
  font-size: 12.5px;
}
</style>
