// Generic vendor-report rendering helpers, ported from the KATM/INPS mock
// renderers. The bureau payloads are deeply nested, mostly-Russian blobs; these
// helpers turn raw keys/values into something an admin can read at a glance.

export type Json = Record<string, unknown>

export interface ReportSection {
  key: string
  title: string
}

export interface ReportCard {
  label: string
  value: string
}

const GENDER: Record<string, string> = {
  Ж: 'Женский (Ж)',
  М: 'Мужской (М)',
  M: 'Мужской (M)',
}

const YESNO: Record<string, string> = { '1': 'Да', '0': 'Нет' }

export function isObject(v: unknown): v is Json {
  return v != null && typeof v === 'object'
}

export function isEmpty(v: unknown): boolean {
  return v === '' || v == null || v === 'н/д' || v === 'н\\д' || v === '-'
}

// Recursively empty: a scalar that's blank, or a container whose every value is
// (recursively) empty. Used to hide report sections that carry no real data even
// though their wrapper object/array is present (e.g. `{ subscription: '' }`).
export function isDeepEmpty(v: unknown): boolean {
  if (isEmpty(v)) return true
  if (Array.isArray(v)) return v.every(isDeepEmpty)
  if (isObject(v)) {
    const vals = Object.values(v)
    return vals.length === 0 || vals.every(isDeepEmpty)
  }
  return false
}

// `credit_ban_status` -> "Credit ban status" when no curated label exists.
export function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function labelFor(key: string, labels: Record<string, string>): string {
  return labels[key] ?? humanize(key)
}

// Group the integer part with thin spaces: 243550357 -> "243 550 357".
function groupInt(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// KATM 077 amounts arrive in tiyin (1/100 of a som). When `tiyin` is set we
// divide by 100 and always render two decimal places: 500000000 -> "5 000 000.00".
export function formatMoney(v: unknown, tiyin = false): string {
  const s = String(v)
  const m = s.match(/^(\d+)(\.\d+)?$/)
  if (!m) return s
  if (tiyin) {
    const som = Number(s) / 100
    if (!Number.isFinite(som)) return s
    const [intPart, frac] = som.toFixed(2).split('.')
    return groupInt(intPart) + '.' + frac
  }
  return groupInt(m[1]) + (m[2] ?? '')
}

function isMoneyKey(k: string): boolean {
  return /(summa|income|remain|salary|amount)/.test(k) && !/date|name|period_b|period_e/.test(k)
}

export type LeafKind = 'empty' | 'gender' | 'pill-good' | 'pill-bad' | 'money' | 'text'

export interface LeafValue {
  kind: LeafKind
  text: string
}

export function formatLeaf(key: string, value: unknown, tiyin = false): LeafValue {
  if (isEmpty(value)) return { kind: 'empty', text: '—' }
  if (key === 'gender') return { kind: 'gender', text: GENDER[String(value)] ?? String(value) }
  if (key === 'scoring_katm' || key === 'credit_info') {
    const v = String(value)
    return { kind: v === '1' ? 'pill-good' : 'pill-bad', text: YESNO[v] ?? v }
  }
  if (key === 'presence') {
    return { kind: /да/i.test(String(value)) ? 'pill-good' : 'pill-bad', text: String(value) }
  }
  const sv = String(value)
  if (isMoneyKey(key) && /^\d+(\.\d+)?$/.test(sv) && sv.replace(/\..*/, '').length >= 4) {
    return { kind: 'money', text: formatMoney(value, tiyin) }
  }
  return { kind: 'text', text: sv }
}

// Hide vendor bookkeeping keys (change-timestamps) unless the user opts in.
export function isTechnicalKey(key: string): boolean {
  return /_change$/.test(key)
}

// A one-line digest for a list item (income record, contract, …).
export function itemSummary(o: Json, tiyin = false): { main: string; meta: string } {
  const date = o.period || o.send_date || o.oper_date || o.consent_date || ''
  const who = o.orgname || o.org_name || o.report_name || o.name || ''
  const creditType = o.credit_type_name || o.credit_type || ''
  const amt = o.income_summa || o.inps_summa || o.amount || ''
  const main =
    [date, who, creditType].filter((x) => !isEmpty(x)).map(String).join(' · ') ||
    '#' + (o.num ?? '')
  const meta: string[] = []
  if (!isEmpty(amt)) meta.push(formatMoney(amt, tiyin))
  if (o.presence) meta.push(String(o.presence))
  return { main, meta: meta.join(' · ') }
}

// Split an object's keys into scalar leaves vs nested object/array branches,
// honouring the technical-dates toggle and dropping empty branches.
export function partition(
  obj: Json,
  showMeta: boolean,
): { leaves: string[]; branches: string[] } {
  const leaves: string[] = []
  const branches: string[] = []
  for (const k of Object.keys(obj)) {
    if (k === 'declaration' || k === 'notes') continue
    if (!showMeta && isTechnicalKey(k)) continue
    const v = obj[k]
    if (isObject(v)) {
      const children = Array.isArray(v) ? v : Object.values(v)
      if (children.length === 0 || children.every(isEmpty)) continue
      branches.push(k)
    } else {
      leaves.push(k)
    }
  }
  return { leaves, branches }
}

export function branchCount(v: unknown): number | null {
  if (Array.isArray(v)) return v.length
  if (isObject(v)) {
    for (const k of Object.keys(v)) {
      if (Array.isArray(v[k])) return (v[k] as unknown[]).length
    }
  }
  return null
}

// Normalise a vendor date ("2025-03", "11.03.2025", "20250311") into a sortable
// YYYYMMDD string. A 4-digit leading group is treated as a year (Y-M-D order);
// otherwise the groups are assumed D-M-Y and reversed. Shared by the detail view
// (INPS incomes) and the 077 report tables.
export function dateSortKey(value: unknown): string {
  const digits = String(value ?? '').match(/\d+/g)
  if (!digits || !digits.length) return ''
  const ymd = digits[0].length === 4 ? digits : [...digits].reverse()
  return ymd.join('').padEnd(8, '0')
}

// --- report tables -----------------------------------------------------------

export type CellFormat = 'money' | 'date' | 'percent' | 'text'

export interface ColumnDef {
  key: string
  label?: string
  format?: CellFormat
  align?: 'left' | 'right'
}

export interface TableConfig {
  // Inner array key for the section wrapper (e.g. `contract`, `open_contract`).
  // When absent, the first array-valued property is used, or the value itself
  // if it is already an array.
  arrayKey?: string
  // Explicit columns. When absent, columns are derived from the rows.
  columns?: ColumnDef[]
  // Sibling scalar keys (on the section wrapper) shown as a summary strip.
  aggregates?: ColumnDef[]
  // Candidate date keys; rows are sorted newest-first by the first present one.
  sortKeys?: string[]
  // Page size; when set and exceeded, the table paginates.
  pageSize?: number
}

// Format a single cell honouring an explicit column format, falling back to the
// key-based heuristics in formatLeaf (gender pills, money detection, …).
export function formatCell(
  key: string,
  value: unknown,
  format: CellFormat | undefined,
  tiyin = false,
): LeafValue {
  if (isEmpty(value)) return { kind: 'empty', text: '—' }
  switch (format) {
    case 'money':
      return { kind: 'money', text: formatMoney(value, tiyin) }
    case 'percent':
      return { kind: 'text', text: `${value}%` }
    case 'date':
      return { kind: 'text', text: String(value) }
    case 'text':
      return { kind: 'text', text: String(value) }
    default:
      // 077 money fields reliably end in `_sum` (immediate_principal_sum,
      // reserve_bal_sum, …); day/qty counters end in `_days`/`_qty`.
      if (/_sum$/.test(key) && /^\d+(\.\d+)?$/.test(String(value))) {
        return { kind: 'money', text: formatMoney(value, tiyin) }
      }
      return formatLeaf(key, value, tiyin)
  }
}

// Derive table columns from the first row, dropping bookkeeping (*_change) keys
// and columns that are empty across every row. Used for mini-tables (contract
// balances/schedules) and any section without an explicit column config.
export function autoColumns(rows: Json[]): ColumnDef[] {
  if (!rows.length) return []
  const keys = Object.keys(rows[0]).filter((k) => !isTechnicalKey(k))
  return keys
    .filter((k) => rows.some((r) => !isEmpty(r[k]) && !isObject(r[k])))
    .map((k) => ({ key: k, format: isMoneyKey(k) ? ('money' as const) : undefined }))
}
