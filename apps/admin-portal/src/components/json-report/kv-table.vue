<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  type ColumnDef,
  type Json,
  formatCell,
  isEmpty,
  isObject,
  labelFor,
} from '@/utils/json-report'

// Renders a single flat object as a two-column (label / value) table. `fields`
// fixes the order and per-key formatting; when absent, every scalar key is shown.
const props = defineProps<{
  value: unknown
  labels: Record<string, string>
  fields?: ColumnDef[]
  tiyin?: boolean
}>()

const { t } = useI18n()

const obj = computed<Json>(() => (isObject(props.value) ? (props.value as Json) : {}))

const rows = computed(() => {
  const defs =
    props.fields ??
    Object.keys(obj.value)
      .filter((k) => !isObject(obj.value[k]))
      .map((k) => ({ key: k }) as ColumnDef)
  return defs
    .filter((d) => obj.value[d.key] !== undefined && !isEmpty(obj.value[d.key]))
    .map((d) => ({
      key: d.key,
      label: d.label ?? labelFor(d.key, props.labels),
      cell: formatCell(d.key, obj.value[d.key], d.format, props.tiyin),
    }))
})
</script>

<template>
  <div v-if="!rows.length" class="note">— {{ t('jsonReport.none') }} —</div>
  <table v-else class="kv">
    <tbody>
      <tr v-for="r in rows" :key="r.key">
        <th>{{ r.label }}</th>
        <td :class="r.cell.kind === 'money' ? 'money' : ''">{{ r.cell.text }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
table.kv {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.kv th {
  text-align: left;
  font-weight: 500;
  color: var(--text-secondary);
  padding: 8px 12px;
  width: 55%;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: top;
}

.kv td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.kv tr:last-child th,
.kv tr:last-child td {
  border-bottom: none;
}

.kv .money {
  color: var(--success);
}

.note {
  color: var(--text-secondary);
  font-size: 12.5px;
}
</style>
