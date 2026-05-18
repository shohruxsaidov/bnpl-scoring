import { defineStore } from 'pinia'
import type { BasketLine, Deal, ScheduleRow, ScoreFactor } from '@/types'

interface DealsState {
  deals: Deal[]
}

function schedule(total: number, term: number, startISO: string): ScheduleRow[] {
  const per = Math.round(total / term)
  const start = new Date(startISO)
  const rows: ScheduleRow[] = []
  for (let i = 0; i < term; i++) {
    const d = new Date(start)
    d.setMonth(d.getMonth() + i + 1)
    rows.push({
      index: i + 1,
      date: d.toISOString(),
      amount: i === term - 1 ? total - per * (term - 1) : per,
    })
  }
  return rows
}

function factors(score: number): ScoreFactor[] {
  return [
    { label: 'Monthly income', weight: 0.32, value: score > 700 ? 'High' : 'Medium' },
    { label: 'KATM overdue count', weight: -0.18, value: score > 700 ? '0' : '1' },
    { label: 'Active liabilities', weight: -0.12, value: score > 700 ? '1' : '3' },
    { label: 'Card score', weight: 0.21, value: String(Math.round(score * 0.9)) },
    { label: 'Employment tenure', weight: 0.12, value: score > 650 ? '36 mo' : '11 mo' },
  ]
}

function basket(...lines: [string, number, number][]): BasketLine[] {
  return lines.map(([name, quantity, price]) => ({ name, quantity, price }))
}

const RAW: Array<Omit<Deal, 'schedule' | 'factors'>> = [
  {
    id: 'DEAL-2041',
    tenantId: 'tnt_techshop',
    clientName: 'Jasur Rahimov',
    clientPinfl: '31203016740011',
    status: 'active',
    amount: 1499000000,
    totalPayable: 1618920000,
    score: 742,
    decision: 'approved',
    agentId: 'emp_ts_2',
    agentName: 'Dilnoza Yusupova',
    tariffName: '6 oy · Ustama 8%',
    termMonths: 6,
    clientPhone: '+998 90 123 45 67',
    basket: basket(['iPhone 15 Pro 256GB', 1, 1499000000]),
    createdAt: '2026-04-12T10:24:00.000Z',
  },
  {
    id: 'DEAL-2042',
    tenantId: 'tnt_furniture',
    clientName: 'Madina Sobirova',
    clientPinfl: '52109026740022',
    status: 'overdue',
    amount: 580000000,
    totalPayable: 609000000,
    score: 631,
    decision: 'partial',
    agentId: 'emp_fp_1',
    agentName: 'Sardor Tursunov',
    tariffName: '3 oy · Ustama 5%',
    termMonths: 3,
    clientPhone: '+998 93 765 43 21',
    basket: basket(['Divan "Komfort" 3-o\'rinli', 1, 480000000], ['Jurnal stoli', 1, 100000000]),
    createdAt: '2026-03-28T14:02:00.000Z',
  },
  {
    id: 'DEAL-2043',
    tenantId: 'tnt_sportmax',
    clientName: 'Bekzod Aliyev',
    clientPinfl: '30501996740033',
    status: 'closed',
    amount: 4200000000,
    totalPayable: 4410000000,
    score: 798,
    decision: 'approved',
    agentId: 'emp_sm_1',
    agentName: 'Kamola Ergasheva',
    tariffName: '3 oy · Ustama 5%',
    termMonths: 3,
    clientPhone: '+998 97 222 11 00',
    basket: basket(['Velotrenajyor Pro', 1, 2800000000], ['Gantel to\'plami 40kg', 1, 1400000000]),
    createdAt: '2026-02-09T09:11:00.000Z',
  },
  {
    id: 'DEAL-2044',
    tenantId: 'tnt_techshop',
    clientName: 'Nilufar Qodirova',
    clientPinfl: '61807036740044',
    status: 'active',
    amount: 920000000,
    totalPayable: 1020800000,
    score: 705,
    decision: 'approved',
    agentId: 'emp_ts_3',
    agentName: 'Otabek Nazarov',
    tariffName: '9 oy · Ustama 11%',
    termMonths: 9,
    clientPhone: '+998 90 555 66 77',
    basket: basket(['MacBook Air M3 13"', 1, 920000000]),
    createdAt: '2026-04-30T16:48:00.000Z',
  },
  {
    id: 'DEAL-2045',
    tenantId: 'tnt_smartfon',
    clientName: 'Sherzod Mirzayev',
    clientPinfl: '30911006740055',
    status: 'overdue',
    amount: 760000000,
    totalPayable: 821800000,
    score: 588,
    decision: 'partial',
    agentId: 'emp_so_2',
    agentName: 'Gulnoza Saidova',
    tariffName: '6 oy · Ustama 8%',
    termMonths: 6,
    clientPhone: '+998 99 100 20 30',
    basket: basket(['Samsung Galaxy S24', 1, 760000000]),
    createdAt: '2026-04-05T12:15:00.000Z',
  },
  {
    id: 'DEAL-2046',
    tenantId: 'tnt_mebelhouse',
    clientName: 'Aziza Yo\'ldosheva',
    clientPinfl: '50204026740066',
    status: 'active',
    amount: 1850000000,
    totalPayable: 2109000000,
    score: 721,
    decision: 'approved',
    agentId: 'emp_mh_1',
    agentName: 'Jamshid Komilov',
    tariffName: '9 oy · Ustama 11%',
    termMonths: 9,
    clientPhone: '+998 91 444 33 22',
    basket: basket(['Oshxona garnituri "Lux"', 1, 1850000000]),
    createdAt: '2026-05-02T10:05:00.000Z',
  },
  {
    id: 'DEAL-2047',
    tenantId: 'tnt_kompyuter',
    clientName: 'Rustam Xolmatov',
    clientPinfl: '30107996740077',
    status: 'closed',
    amount: 540000000,
    totalPayable: 567000000,
    score: 812,
    decision: 'approved',
    agentId: 'emp_kd_2',
    agentName: 'Malika Rasulova',
    tariffName: '3 oy · Ustama 5%',
    termMonths: 3,
    clientPhone: '+998 94 777 88 99',
    basket: basket(['Gaming PC RTX 4070', 1, 540000000]),
    createdAt: '2026-03-14T15:30:00.000Z',
  },
  {
    id: 'DEAL-2048',
    tenantId: 'tnt_techshop',
    clientName: 'Dilshod Ismoilov',
    clientPinfl: '31405016740088',
    status: 'scoring',
    amount: 1290000000,
    totalPayable: 1470600000,
    score: 0,
    decision: 'manual_review',
    agentId: 'emp_ts_2',
    agentName: 'Dilnoza Yusupova',
    tariffName: '9 oy · Ustama 11%',
    termMonths: 9,
    clientPhone: '+998 90 321 12 21',
    basket: basket(['iPad Pro 12.9"', 1, 1290000000]),
    createdAt: '2026-05-15T09:42:00.000Z',
  },
  {
    id: 'DEAL-2049',
    tenantId: 'tnt_furniture',
    clientName: 'Feruza Abdullayeva',
    clientPinfl: '60302036740099',
    status: 'declined',
    amount: 2400000000,
    totalPayable: 2736000000,
    score: 412,
    decision: 'declined',
    agentId: 'emp_fp_1',
    agentName: 'Sardor Tursunov',
    tariffName: '9 oy · Ustama 11%',
    termMonths: 9,
    clientPhone: '+998 93 010 02 03',
    basket: basket(['Yotoqxona to\'plami "Premium"', 1, 2400000000]),
    createdAt: '2026-04-22T11:18:00.000Z',
  },
  {
    id: 'DEAL-2050',
    tenantId: 'tnt_sportmax',
    clientName: 'Oybek Tursunov',
    clientPinfl: '30808026740100',
    status: 'active',
    amount: 680000000,
    totalPayable: 734400000,
    score: 689,
    decision: 'approved',
    agentId: 'emp_sm_1',
    agentName: 'Kamola Ergasheva',
    tariffName: '6 oy · Ustama 8%',
    termMonths: 6,
    clientPhone: '+998 97 600 50 40',
    basket: basket(['Yugurish yo\'lakchasi', 1, 680000000]),
    createdAt: '2026-05-10T13:55:00.000Z',
  },
]

const SEEDED: Deal[] = RAW.map((d) => ({
  ...d,
  schedule: schedule(d.totalPayable, d.termMonths, d.createdAt),
  factors: d.status === 'scoring' ? [] : factors(d.score),
}))

export const useDealsStore = defineStore('deals', {
  state: (): DealsState => ({
    deals: SEEDED,
  }),

  getters: {
    total: (s): number => s.deals.length,
    overdueCount: (s): number => s.deals.filter((d) => d.status === 'overdue').length,
    platformVolume: (s): number =>
      s.deals
        .filter((d) => ['active', 'overdue', 'closed'].includes(d.status))
        .reduce((sum, d) => sum + d.amount, 0),
    recent:
      (s) =>
      (limit: number): Deal[] =>
        [...s.deals]
          .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
          .slice(0, limit),
    forTenant:
      (s) =>
      (tenantId: string): Deal[] =>
        s.deals.filter((d) => d.tenantId === tenantId),
    byId:
      (s) =>
      (id: string): Deal | undefined =>
        s.deals.find((d) => d.id === id),
  },
})
