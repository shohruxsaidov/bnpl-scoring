import { defineStore } from 'pinia'
import type { Category, Employee, Product, Tariff } from '@/types'

let pid = 100
let cid = 100
let tid = 100

interface CatalogState {
  categories: Category[]
  products: Product[]
  tariffs: Tariff[]
  employees: Employee[]
}

export const useCatalogStore = defineStore('catalog', {
  state: (): CatalogState => ({
    categories: [
      { id: 'cat_1', name: 'Elektronika' },
      { id: 'cat_2', name: 'Mebel' },
      { id: 'cat_3', name: 'Maishiy texnika' },
      { id: 'cat_4', name: 'Kiyim' },
      { id: 'cat_5', name: 'Sport' },
    ],
    products: [
      { id: 'prd_1', name: 'iPhone 15 Pro 256GB', sku: 'APL-IP15P-256', price: 1499000000, categoryId: 'cat_1' },
      { id: 'prd_2', name: 'Samsung Galaxy S24', sku: 'SMS-GS24-128', price: 1099000000, categoryId: 'cat_1' },
      { id: 'prd_3', name: 'MacBook Air M3', sku: 'APL-MBA-M3', price: 1899000000, categoryId: 'cat_1' },
      { id: 'prd_4', name: 'Yumshoq divan "Comfort"', sku: 'MBL-SOFA-CMF', price: 750000000, categoryId: 'cat_2' },
      { id: 'prd_5', name: 'Oshxona stoli to\'plami', sku: 'MBL-TBL-SET', price: 420000000, categoryId: 'cat_2' },
      { id: 'prd_6', name: 'Kir yuvish mashinasi LG 8kg', sku: 'LG-WM-8KG', price: 580000000, categoryId: 'cat_3' },
      { id: 'prd_7', name: 'Muzlatgich Samsung 380L', sku: 'SMS-FRG-380', price: 690000000, categoryId: 'cat_3' },
      { id: 'prd_8', name: 'Qishki kurtka (erkaklar)', sku: 'CLO-JKT-M', price: 89000000, categoryId: 'cat_4' },
      { id: 'prd_9', name: 'Sport krossovkalari Nike', sku: 'NIK-SHO-42', price: 145000000, categoryId: 'cat_5' },
      { id: 'prd_10', name: 'Velosiped Trek Marlin 5', sku: 'TRK-BIK-M5', price: 620000000, categoryId: 'cat_5' },
    ],
    tariffs: [
      { id: 'trf_1', name: '3 oy · 5%', termMonths: 3, markupPercent: 5, creditMin: 50000000, creditMax: 800000000, active: true },
      { id: 'trf_2', name: '6 oy · 8%', termMonths: 6, markupPercent: 8, creditMin: 100000000, creditMax: 1500000000, active: true },
      { id: 'trf_3', name: '12 oy · 12%', termMonths: 12, markupPercent: 12, creditMin: 300000000, creditMax: 3000000000, active: true },
      { id: 'trf_4', name: '24 oy · 18%', termMonths: 24, markupPercent: 18, creditMin: 800000000, creditMax: 6000000000, active: false },
    ],
    employees: [
      {
        id: 'emp_001',
        fullName: 'Aziz Karimov',
        email: 'admin@demo.com',
        phone: '+998 90 123 45 67',
        roles: ['merchant_admin', 'agent'],
        active: true,
        tenantId: 'tnt_001',
      },
      {
        id: 'emp_002',
        fullName: 'Dilnoza Yusupova',
        email: 'agent@demo.com',
        phone: '+998 93 765 43 21',
        roles: ['agent'],
        active: true,
        tenantId: 'tnt_001',
      },
      {
        id: 'emp_003',
        fullName: 'Sardor To\'xtayev',
        email: 'sardor@demo.com',
        phone: '+998 97 222 11 00',
        roles: ['agent'],
        active: false,
        tenantId: 'tnt_001',
      },
    ],
  }),

  getters: {
    activeTariffs: (s): Tariff[] => s.tariffs.filter((t) => t.active),
    categoryName:
      (s) =>
      (id: string): string =>
        s.categories.find((c) => c.id === id)?.name ?? '—',
    productsByCategory:
      (s) =>
      (id: string | null): Product[] =>
        id ? s.products.filter((p) => p.categoryId === id) : s.products,
  },

  actions: {
    // -- Products --
    addProduct(input: Omit<Product, 'id'>) {
      this.products.push({ ...input, id: `prd_${++pid}` })
    },
    updateProduct(id: string, patch: Partial<Omit<Product, 'id'>>) {
      const p = this.products.find((x) => x.id === id)
      if (p) Object.assign(p, patch)
    },
    deleteProduct(id: string) {
      this.products = this.products.filter((p) => p.id !== id)
    },

    // -- Categories --
    addCategory(name: string) {
      this.categories.push({ id: `cat_${++cid}`, name })
    },
    updateCategory(id: string, name: string) {
      const c = this.categories.find((x) => x.id === id)
      if (c) c.name = name
    },
    deleteCategory(id: string) {
      this.categories = this.categories.filter((c) => c.id !== id)
    },

    // -- Tariffs --
    addTariff(input: Omit<Tariff, 'id'>) {
      this.tariffs.push({ ...input, id: `trf_${++tid}` })
    },
    updateTariff(id: string, patch: Partial<Omit<Tariff, 'id'>>) {
      const t = this.tariffs.find((x) => x.id === id)
      if (t) Object.assign(t, patch)
    },
    deleteTariff(id: string) {
      this.tariffs = this.tariffs.filter((t) => t.id !== id)
    },
    toggleTariffActive(id: string) {
      const t = this.tariffs.find((x) => x.id === id)
      if (t) t.active = !t.active
    },

    // -- Employees --
    toggleEmployeeActive(id: string) {
      const e = this.employees.find((x) => x.id === id)
      if (e) e.active = !e.active
    },
  },
})
