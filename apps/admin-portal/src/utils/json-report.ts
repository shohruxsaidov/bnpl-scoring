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

export function formatMoney(v: unknown): string {
  const s = String(v)
  const m = s.match(/^(\d+)(\.\d+)?$/)
  if (!m) return s
  return groupInt(m[1]) + (m[2] ?? '')
}

function isMoneyKey(k: string): boolean {
  return /(summa|income|remain|salary)/.test(k) && !/date|name|period_b|period_e/.test(k)
}

export type LeafKind = 'empty' | 'gender' | 'pill-good' | 'pill-bad' | 'money' | 'text'

export interface LeafValue {
  kind: LeafKind
  text: string
}

export function formatLeaf(key: string, value: unknown): LeafValue {
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
    return { kind: 'money', text: formatMoney(value) }
  }
  return { kind: 'text', text: sv }
}

// Hide vendor bookkeeping keys (change-timestamps) unless the user opts in.
export function isTechnicalKey(key: string): boolean {
  return /_change$/.test(key)
}

// A one-line digest for a list item (income record, contract, …).
export function itemSummary(o: Json): { main: string; meta: string } {
  const date = o.period || o.send_date || o.oper_date || ''
  const who = o.orgname || o.report_name || o.name || ''
  const amt = o.income_summa || o.inps_summa || o.amount || ''
  const main =
    [date, who].filter((x) => !isEmpty(x)).map(String).join(' · ') || '#' + (o.num ?? '')
  const meta: string[] = []
  if (!isEmpty(amt)) meta.push(formatMoney(amt))
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
