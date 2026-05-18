import { defineStore } from 'pinia'
import type {
  Deal,
  PaymentRecord,
  ScheduleEntry,
  ScheduleStatus,
  PaymentProvider,
} from '@/types'

/** Build an ISO date string for the 15th of a given year/month. */
function due(year: number, monthIndex0: number): string {
  const m = String(monthIndex0 + 1).padStart(2, '0')
  return `${year}-${m}-15`
}

interface BuildArgs {
  count: number
  amount: number
  startYear: number
  startMonth0: number
  paidCount: number
  /** providers used for each paid instalment, in order */
  paidProviders: PaymentProvider[]
  /** when true, the first unpaid instalment is marked overdue */
  overdueNext: boolean
}

function buildSchedule(a: BuildArgs): ScheduleEntry[] {
  const out: ScheduleEntry[] = []
  for (let i = 0; i < a.count; i++) {
    const monthAbs = a.startMonth0 + i
    const year = a.startYear + Math.floor(monthAbs / 12)
    const month0 = ((monthAbs % 12) + 12) % 12

    let status: ScheduleStatus
    let paidVia: PaymentProvider | undefined
    if (i < a.paidCount) {
      status = 'paid'
      paidVia = a.paidProviders[i] ?? 'Payme'
    } else if (i === a.paidCount && a.overdueNext) {
      status = 'overdue'
    } else {
      status = 'upcoming'
    }

    out.push({
      no: i + 1,
      dueDate: due(year, month0),
      amount: a.amount,
      status,
      paidVia,
    })
  }
  return out
}

function buildPayments(
  schedule: ScheduleEntry[],
  idPrefix: string,
): PaymentRecord[] {
  return schedule
    .filter((s) => s.status === 'paid')
    .map((s, idx) => ({
      id: `${idPrefix}-p${idx + 1}`,
      date: s.dueDate,
      amount: s.amount,
      provider: s.paidVia ?? 'Payme',
      txnId: `${s.paidVia === 'Click' ? 'CLK' : 'PME'}-${idPrefix}-${String(
        100037 + idx * 1289,
      )}`,
    }))
}

/* ── DEAL-1001 — active, TechShop Tashkent ──────────────────────────────── */
const sched1001 = buildSchedule({
  count: 12,
  amount: 139_916_700, // 1,399,167 so'm in tiyin
  startYear: 2026,
  startMonth0: 3, // April
  paidCount: 3,
  paidProviders: ['Payme', 'Click', 'Payme'],
  overdueNext: false,
})

/* ── DEAL-1002 — overdue, FurniturePlus ─────────────────────────────────── */
const sched1002 = buildSchedule({
  count: 6,
  amount: 135_000_000, // 1,350,000 so'm in tiyin
  startYear: 2026,
  startMonth0: 3, // April
  paidCount: 2,
  paidProviders: ['Payme', 'Click'],
  overdueNext: true,
})

/* ── DEAL-1003 — closed, SportMax ───────────────────────────────────────── */
const sched1003 = buildSchedule({
  count: 3,
  amount: 70_000_000, // 700,000 so'm in tiyin
  startYear: 2026,
  startMonth0: 0, // January
  paidCount: 3,
  paidProviders: ['Payme', 'Payme', 'Click'],
  overdueNext: false,
})

const DEALS: Deal[] = [
  {
    id: 'DEAL-1001',
    merchant: 'TechShop Tashkent',
    amount: 1_499_000_000, // 14,990,000 so'm
    status: 'active',
    tariffLabel: 'Standart 12 oy',
    termMonths: 12,
    markupPercent: 12,
    paymentsMade: 3,
    paymentsTotal: 12,
    nextPaymentDate: '2026-07-15',
    nextPaymentAmount: 139_916_700,
    schedule: sched1001,
    payments: buildPayments(sched1001, '1001'),
    contract: {
      number: 'KNT-1001',
      signed: true,
      signedAt: '2026-04-02',
      myIdVerified: true,
    },
  },
  {
    id: 'DEAL-1002',
    merchant: 'FurniturePlus',
    amount: 750_000_000, // 7,500,000 so'm
    status: 'overdue',
    tariffLabel: 'Standart 6 oy',
    termMonths: 6,
    markupPercent: 8,
    paymentsMade: 2,
    paymentsTotal: 6,
    nextPaymentDate: '2026-06-15',
    nextPaymentAmount: 135_000_000,
    overdueSince: '2026-06-15',
    schedule: sched1002,
    payments: buildPayments(sched1002, '1002'),
    contract: {
      number: 'KNT-1002',
      signed: true,
      signedAt: '2026-04-03',
      myIdVerified: true,
    },
  },
  {
    id: 'DEAL-1003',
    merchant: 'SportMax',
    amount: 210_000_000, // 2,100,000 so'm
    status: 'closed',
    tariffLabel: 'Aksiya 3 oy',
    termMonths: 3,
    markupPercent: 5,
    paymentsMade: 3,
    paymentsTotal: 3,
    nextPaymentDate: null,
    nextPaymentAmount: 0,
    schedule: sched1003,
    payments: buildPayments(sched1003, '1003'),
    contract: {
      number: 'KNT-1003',
      signed: true,
      signedAt: '2026-01-04',
      myIdVerified: true,
    },
  },
]

export const useDealsStore = defineStore('deals', {
  state: () => ({
    deals: DEALS as Deal[],
  }),

  getters: {
    activeDeals: (s): Deal[] =>
      s.deals.filter((d) => d.status === 'active' || d.status === 'overdue'),
    closedDeals: (s): Deal[] => s.deals.filter((d) => d.status === 'closed'),
    overdueDeals: (s): Deal[] => s.deals.filter((d) => d.status === 'overdue'),
    hasOverdue(): boolean {
      return this.overdueDeals.length > 0
    },
    totalPaid: (s): number =>
      s.deals.reduce(
        (sum, d) =>
          sum + d.payments.reduce((ps, p) => ps + p.amount, 0),
        0,
      ),
    nextPaymentDate: (s): string | null => {
      const upcoming = s.deals
        .filter((d) => d.nextPaymentDate !== null)
        .map((d) => d.nextPaymentDate as string)
        .sort()
      return upcoming[0] ?? null
    },
  },

  actions: {
    byId(id: string): Deal | undefined {
      return this.deals.find((d) => d.id === id)
    },
  },
})
