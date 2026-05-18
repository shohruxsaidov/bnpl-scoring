import { defineStore } from 'pinia'
import type { ScoringModel, Tariff, Tenant } from '@/types'

interface TenantsState {
  tenants: Tenant[]
  scoringModels: Record<string, ScoringModel>
  tariffs: Record<string, Tariff[]>
}

const DEFAULT_MODEL: ScoringModel = {
  version: 'v3.2',
  updatedAt: '2026-04-02T08:00:00.000Z',
  hardDenyThreshold: 0.0,
  partialLimitThreshold: 0.8,
  criteria: {
    income: 0.32,
    katm_overdue_count: -0.24,
    active_liabilities: -0.18,
    card_score: 0.21,
    employment_months: 0.12,
    age_band: 0.06,
    region_risk: -0.05,
  },
  rules: [
    'Reject if KATM overdue_count > 3 in last 12 months',
    'Reject if PINFL not verified via MyID',
    'Partial limit if score in [0.0, 0.8)',
    'Full limit if score >= 0.8',
  ],
}

function model(version: string, overrides: Partial<ScoringModel['criteria']> = {}): ScoringModel {
  return {
    ...DEFAULT_MODEL,
    version,
    criteria: { ...DEFAULT_MODEL.criteria, ...overrides } as Record<string, number>,
  }
}

const STANDARD_TARIFFS: Tariff[] = [
  {
    id: 'trf_3',
    name: '3 oy · Ustama 5%',
    termMonths: 3,
    markupPercent: 5,
    creditMin: 50000000,
    creditMax: 1500000000,
    active: true,
  },
  {
    id: 'trf_6',
    name: '6 oy · Ustama 8%',
    termMonths: 6,
    markupPercent: 8,
    creditMin: 100000000,
    creditMax: 2500000000,
    active: true,
  },
  {
    id: 'trf_9',
    name: '9 oy · Ustama 11%',
    termMonths: 9,
    markupPercent: 11,
    creditMin: 100000000,
    creditMax: 3000000000,
    active: true,
  },
  {
    id: 'trf_12',
    name: '12 oy · Ustama 14%',
    termMonths: 12,
    markupPercent: 14,
    creditMin: 200000000,
    creditMax: 5000000000,
    active: false,
  },
]

const TENANTS: Tenant[] = [
  {
    id: 'tnt_techshop',
    name: 'TechShop Tashkent',
    slug: 'techshop',
    status: 'active',
    contactEmail: 'ceo@techshop.uz',
    dealCount: 312,
    employeeCount: 8,
    volume: 312_0000_000_00,
    overdueCount: 9,
    createdAt: '2025-08-14T09:00:00.000Z',
  },
  {
    id: 'tnt_furniture',
    name: 'FurniturePlus',
    slug: 'furniture',
    status: 'active',
    contactEmail: 'info@furnitureplus.uz',
    dealCount: 189,
    employeeCount: 4,
    volume: 198_5000_000_00,
    overdueCount: 5,
    createdAt: '2025-09-02T11:30:00.000Z',
  },
  {
    id: 'tnt_sportmax',
    name: 'SportMax',
    slug: 'sportmax',
    status: 'active',
    contactEmail: 'admin@sportmax.uz',
    dealCount: 98,
    employeeCount: 3,
    volume: 84_2000_000_00,
    overdueCount: 2,
    createdAt: '2025-10-19T14:10:00.000Z',
  },
  {
    id: 'tnt_elektromir',
    name: 'ElektroMir',
    slug: 'elektromir',
    status: 'suspended',
    contactEmail: 'support@elektromir.uz',
    dealCount: 45,
    employeeCount: 2,
    volume: 41_8000_000_00,
    overdueCount: 4,
    createdAt: '2025-11-05T08:45:00.000Z',
  },
  {
    id: 'tnt_mebelhouse',
    name: 'Mebel House Samarqand',
    slug: 'mebelhouse',
    status: 'active',
    contactEmail: 'sales@mebelhouse.uz',
    dealCount: 67,
    employeeCount: 3,
    volume: 56_3000_000_00,
    overdueCount: 1,
    createdAt: '2025-11-22T10:20:00.000Z',
  },
  {
    id: 'tnt_smartfon',
    name: 'Smartfon Olami',
    slug: 'smartfonolami',
    status: 'active',
    contactEmail: 'hello@smartfonolami.uz',
    dealCount: 134,
    employeeCount: 5,
    volume: 121_7000_000_00,
    overdueCount: 3,
    createdAt: '2025-12-01T09:15:00.000Z',
  },
  {
    id: 'tnt_uyjihoz',
    name: 'Uy Jihozlari Markazi',
    slug: 'uyjihoz',
    status: 'active',
    contactEmail: 'contact@uyjihoz.uz',
    dealCount: 52,
    employeeCount: 2,
    volume: 47_9000_000_00,
    overdueCount: 0,
    createdAt: '2026-01-08T13:00:00.000Z',
  },
  {
    id: 'tnt_avtoaksessuar',
    name: 'Avto Aksessuar Plus',
    slug: 'avtoaksessuar',
    status: 'suspended',
    contactEmail: 'info@avtoaksessuar.uz',
    dealCount: 19,
    employeeCount: 2,
    volume: 12_4000_000_00,
    overdueCount: 2,
    createdAt: '2026-01-21T15:40:00.000Z',
  },
  {
    id: 'tnt_kompyuter',
    name: 'Kompyuter Dunyosi',
    slug: 'kompyuter',
    status: 'active',
    contactEmail: 'pos@kompyuter.uz',
    dealCount: 88,
    employeeCount: 4,
    volume: 79_6000_000_00,
    overdueCount: 2,
    createdAt: '2026-02-03T08:30:00.000Z',
  },
  {
    id: 'tnt_maishiy',
    name: 'Maishiy Texnika Servis',
    slug: 'maishiy',
    status: 'active',
    contactEmail: 'servis@maishiy.uz',
    dealCount: 41,
    employeeCount: 2,
    volume: 38_1000_000_00,
    overdueCount: 1,
    createdAt: '2026-02-18T11:05:00.000Z',
  },
  {
    id: 'tnt_giftshop',
    name: 'Gift & More Bukhara',
    slug: 'giftshop',
    status: 'active',
    contactEmail: 'team@giftandmore.uz',
    dealCount: 23,
    employeeCount: 2,
    volume: 14_7000_000_00,
    overdueCount: 0,
    createdAt: '2026-03-09T09:50:00.000Z',
  },
  {
    id: 'tnt_velomir',
    name: 'Velo Mir Andijon',
    slug: 'velomir',
    status: 'active',
    contactEmail: 'shop@velomir.uz',
    dealCount: 16,
    employeeCount: 1,
    volume: 9_8000_000_00,
    overdueCount: 1,
    createdAt: '2026-04-01T10:10:00.000Z',
  },
]

let tenantSeq = 13

export const useTenantsStore = defineStore('tenants', {
  state: (): TenantsState => ({
    tenants: TENANTS,
    scoringModels: {
      tnt_techshop: model('v3.2'),
      tnt_furniture: model('v3.1', { income: 0.3, card_score: 0.24 }),
      tnt_sportmax: model('v3.0', { region_risk: -0.08 }),
      tnt_elektromir: model('v2.9', { katm_overdue_count: -0.3 }),
    },
    tariffs: {
      tnt_techshop: STANDARD_TARIFFS,
      tnt_furniture: STANDARD_TARIFFS,
      tnt_sportmax: STANDARD_TARIFFS,
      tnt_elektromir: STANDARD_TARIFFS,
    },
  }),

  getters: {
    total: (s): number => s.tenants.length,
    activeCount: (s): number => s.tenants.filter((t) => t.status === 'active').length,
    suspendedCount: (s): number => s.tenants.filter((t) => t.status === 'suspended').length,
    totalVolume: (s): number => s.tenants.reduce((sum, t) => sum + t.volume, 0),
    byId: (s) => (id: string): Tenant | undefined => s.tenants.find((t) => t.id === id),
    options: (s) => s.tenants.map((t) => ({ label: t.name, value: t.id })),
    modelFor: (s) => (id: string): ScoringModel =>
      s.scoringModels[id] ?? { ...DEFAULT_MODEL },
    tariffsFor: (s) => (id: string): Tariff[] => s.tariffs[id] ?? STANDARD_TARIFFS,
  },

  actions: {
    toggleStatus(id: string) {
      const t = this.tenants.find((x) => x.id === id)
      if (t) t.status = t.status === 'active' ? 'suspended' : 'active'
    },

    setStatus(id: string, status: Tenant['status']) {
      const t = this.tenants.find((x) => x.id === id)
      if (t) t.status = status
    },

    remove(id: string) {
      this.tenants = this.tenants.filter((t) => t.id !== id)
    },

    add(input: { name: string; slug: string; contactEmail: string }) {
      const id = `tnt_new_${tenantSeq++}`
      this.tenants.unshift({
        id,
        name: input.name,
        slug: input.slug,
        status: 'active',
        contactEmail: input.contactEmail,
        dealCount: 0,
        employeeCount: 0,
        volume: 0,
        overdueCount: 0,
        createdAt: new Date().toISOString(),
      })
      this.scoringModels[id] = model('v3.2')
      this.tariffs[id] = STANDARD_TARIFFS
    },
  },
})
