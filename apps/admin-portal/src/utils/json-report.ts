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
