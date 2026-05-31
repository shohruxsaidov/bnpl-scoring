import { defineStore } from 'pinia'
import type { Employee } from '@/types'

interface EmployeesState {
  employees: Employee[]
}

const EMPLOYEES: Employee[] = [
  // TechShop Tashkent
  {
    id: 'emp_ts_1',
    fullName: 'Aziz Karimov',
    email: 'aziz@techshop.uz',
    phone: '+998 90 100 10 10',
    roles: ['merchant_admin', 'agent'],
    active: true,
    tenantId: 'tnt_techshop',
    lastLogin: '2026-05-16T18:22:00.000Z',
  },
  {
    id: 'emp_ts_2',
    fullName: 'Dilnoza Yusupova',
    email: 'dilnoza@techshop.uz',
    phone: '+998 93 200 20 20',
    roles: ['agent'],
    active: true,
    tenantId: 'tnt_techshop',
    lastLogin: '2026-05-17T09:05:00.000Z',
  },
  {
    id: 'emp_ts_3',
    fullName: 'Otabek Nazarov',
    email: 'otabek@techshop.uz',
    phone: '+998 97 300 30 30',
    roles: ['agent'],
    active: true,
    tenantId: 'tnt_techshop',
    lastLogin: '2026-05-15T14:48:00.000Z',
  },
  {
    id: 'emp_ts_4',
    fullName: 'Shahzoda Umarova',
    email: 'shahzoda@techshop.uz',
    phone: '+998 99 400 40 40',
    roles: ['agent'],
    active: false,
    tenantId: 'tnt_techshop',
    lastLogin: '2026-03-28T11:10:00.000Z',
  },
  // FurniturePlus
  {
    id: 'emp_fp_0',
    fullName: 'Bahodir Eshonov',
    email: 'bahodir@furnitureplus.uz',
    phone: '+998 90 510 51 51',
    roles: ['merchant_admin'],
    active: true,
    tenantId: 'tnt_furniture',
    lastLogin: '2026-05-16T10:30:00.000Z',
  },
  {
    id: 'emp_fp_1',
    fullName: 'Sardor Tursunov',
    email: 'sardor@furnitureplus.uz',
    phone: '+998 93 520 52 52',
    roles: ['agent'],
    active: true,
    tenantId: 'tnt_furniture',
    lastLogin: '2026-05-17T08:12:00.000Z',
  },
  {
    id: 'emp_fp_2',
    fullName: 'Nigora Yusupova',
    email: 'nigora@furnitureplus.uz',
    phone: '+998 97 530 53 53',
    roles: ['agent'],
    active: true,
    tenantId: 'tnt_furniture',
    lastLogin: '2026-05-14T16:40:00.000Z',
  },
  // SportMax
  {
    id: 'emp_sm_0',
    fullName: 'Akmal Sharipov',
    email: 'akmal@sportmax.uz',
    phone: '+998 90 610 61 61',
    roles: ['merchant_admin', 'agent'],
    active: true,
    tenantId: 'tnt_sportmax',
    lastLogin: '2026-05-15T12:00:00.000Z',
  },
  {
    id: 'emp_sm_1',
    fullName: 'Kamola Ergasheva',
    email: 'kamola@sportmax.uz',
    phone: '+998 93 620 62 62',
    roles: ['agent'],
    active: true,
    tenantId: 'tnt_sportmax',
    lastLogin: '2026-05-17T07:55:00.000Z',
  },
  // ElektroMir (suspended tenant)
  {
    id: 'emp_em_0',
    fullName: 'Jahongir Toshmatov',
    email: 'jahongir@elektromir.uz',
    phone: '+998 90 710 71 71',
    roles: ['merchant_admin'],
    active: false,
    tenantId: 'tnt_elektromir',
    lastLogin: '2026-02-20T09:30:00.000Z',
  },
  {
    id: 'emp_em_1',
    fullName: 'Lola Karimova',
    email: 'lola@elektromir.uz',
    phone: '+998 93 720 72 72',
    roles: ['agent'],
    active: false,
    tenantId: 'tnt_elektromir',
    lastLogin: '2026-02-18T15:20:00.000Z',
  },
  // Smartfon Olami
  {
    id: 'emp_so_1',
    fullName: 'Ulug\'bek Rahimov',
    email: 'ulugbek@smartfonolami.uz',
    phone: '+998 90 810 81 81',
    roles: ['merchant_admin', 'agent'],
    active: true,
    tenantId: 'tnt_smartfon',
    lastLogin: '2026-05-16T17:10:00.000Z',
  },
  {
    id: 'emp_so_2',
    fullName: 'Gulnoza Saidova',
    email: 'gulnoza@smartfonolami.uz',
    phone: '+998 93 820 82 82',
    roles: ['agent'],
    active: true,
    tenantId: 'tnt_smartfon',
    lastLogin: '2026-05-17T08:40:00.000Z',
  },
  // Mebel House
  {
    id: 'emp_mh_0',
    fullName: 'Davron Aliyev',
    email: 'davron@mebelhouse.uz',
    phone: '+998 90 910 91 91',
    roles: ['merchant_admin'],
    active: true,
    tenantId: 'tnt_mebelhouse',
    lastLogin: '2026-05-13T11:25:00.000Z',
  },
  {
    id: 'emp_mh_1',
    fullName: 'Jamshid Komilov',
    email: 'jamshid@mebelhouse.uz',
    phone: '+998 93 920 92 92',
    roles: ['agent'],
    active: true,
    tenantId: 'tnt_mebelhouse',
    lastLogin: '2026-05-16T14:05:00.000Z',
  },
  // Kompyuter Dunyosi
  {
    id: 'emp_kd_1',
    fullName: 'Sanjar Mahmudov',
    email: 'sanjar@kompyuter.uz',
    phone: '+998 90 110 11 12',
    roles: ['merchant_admin', 'agent'],
    active: true,
    tenantId: 'tnt_kompyuter',
    lastLogin: '2026-05-15T10:50:00.000Z',
  },
  {
    id: 'emp_kd_2',
    fullName: 'Malika Rasulova',
    email: 'malika@kompyuter.uz',
    phone: '+998 93 120 12 13',
    roles: ['agent'],
    active: true,
    tenantId: 'tnt_kompyuter',
    lastLogin: '2026-05-17T09:15:00.000Z',
  },
  // Uy Jihozlari
  {
    id: 'emp_uj_1',
    fullName: 'Farrux Bekmurodov',
    email: 'farrux@uyjihoz.uz',
    phone: '+998 90 130 13 14',
    roles: ['merchant_admin', 'agent'],
    active: true,
    tenantId: 'tnt_uyjihoz',
    lastLogin: '2026-05-14T13:30:00.000Z',
  },
]

let empSeq = 100

export const useEmployeesStore = defineStore('employees', {
  state: (): EmployeesState => ({
    employees: EMPLOYEES,
  }),

  getters: {
    total: (s): number => s.employees.length,
    activeCount: (s): number => s.employees.filter((e) => e.active).length,
    forTenant:
      (s) =>
      (tenantId: string): Employee[] =>
        s.employees.filter((e) => e.tenantId === tenantId),
    activeForTenant:
      (s) =>
      (tenantId: string): number =>
        s.employees.filter((e) => e.tenantId === tenantId && e.active).length,
  },

  actions: {
    toggleActive(id: string) {
      const e = this.employees.find((x) => x.id === id)
      if (e) e.active = !e.active
    },

    block(id: string) {
      const e = this.employees.find((x) => x.id === id)
      if (e) e.active = false
    },

    add(input: { fullName: string; email: string; phone: string; tenantId: string }) {
      this.employees.unshift({
        id: `emp_new_${empSeq++}`,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        roles: ['agent'],
        active: true,
        tenantId: input.tenantId,
        lastLogin: null,
      })
    },
  },
})
