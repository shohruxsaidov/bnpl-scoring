import { defineStore } from 'pinia'
import type { Employee, EmployeeRole, Tenant } from '@/types'

interface MockCredential {
  password: string
  employee: Employee
}

const TENANT: Tenant = {
  id: 'tnt_001',
  name: 'TechnoMart LLC',
}

const MOCK_DB: Record<string, MockCredential> = {
  'admin@demo.com': {
    password: 'password',
    employee: {
      id: 'emp_001',
      fullName: 'Aziz Karimov',
      email: 'admin@demo.com',
      phone: '+998 90 123 45 67',
      roles: ['merchant_admin', 'agent'],
      active: true,
      tenantId: TENANT.id,
    },
  },
  'agent@demo.com': {
    password: 'password',
    employee: {
      id: 'emp_002',
      fullName: 'Dilnoza Yusupova',
      email: 'agent@demo.com',
      phone: '+998 93 765 43 21',
      roles: ['agent'],
      active: true,
      tenantId: TENANT.id,
    },
  },
}

const SESSION_KEY = 'auth_session'

interface PersistedSession {
  employee: Employee
  activeRole: EmployeeRole
}

function loadSession(): { employee: Employee | null; activeRole: EmployeeRole | null } {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return { employee: null, activeRole: null }
    const s = JSON.parse(raw) as PersistedSession
    return { employee: s.employee, activeRole: s.activeRole }
  } catch {
    return { employee: null, activeRole: null }
  }
}

interface AuthState {
  employee: Employee | null
  activeRole: EmployeeRole | null
  tenant: Tenant
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    ...loadSession(),
    tenant: TENANT,
  }),

  getters: {
    isAuthenticated: (s): boolean => s.employee !== null && s.activeRole !== null,
    isAdmin: (s): boolean => s.activeRole === 'merchant_admin',
    isAgent: (s): boolean => s.activeRole === 'agent',
    roleLabel: (s): string =>
      s.activeRole === 'merchant_admin' ? 'Merchant Admin' : 'Agent',
  },

  actions: {
    /** Validate credentials. Returns the matched employee or null. */
    validate(email: string, password: string): Employee | null {
      const record = MOCK_DB[email.trim().toLowerCase()]
      if (!record || record.password !== password) return null
      return record.employee
    },

    /** Establish a session with a chosen role. */
    login(employee: Employee, role: EmployeeRole) {
      this.employee = employee
      this.activeRole = role
      localStorage.setItem(SESSION_KEY, JSON.stringify({ employee, activeRole: role }))
    },

    setRole(role: EmployeeRole) {
      this.activeRole = role
      if (this.employee) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ employee: this.employee, activeRole: role }))
      }
    },

    logout() {
      this.employee = null
      this.activeRole = null
      localStorage.removeItem(SESSION_KEY)
    },
  },
})
