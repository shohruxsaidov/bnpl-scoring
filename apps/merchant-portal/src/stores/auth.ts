import { defineStore } from "pinia";
import type { EmployeeRole } from "@/types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// A granted Feature key (e.g. 'view_deals', 'create_deal', 'manage_products').
export type Permission = string;

export interface AuthEmployee {
  id: string;
  fullName: string;
  phone: string;
  merchantId: string;
  branchId: string;
  mustChangePassword: boolean;
}

interface RolePickerState {
  token: string;
  roles: EmployeeRole[];
  user: { id: string; fullName: string; phone: string };
}

interface AuthState {
  employee: AuthEmployee | null;
  activeRole: EmployeeRole | null;
  permissions: Permission[];
  rolePicker: RolePickerState | null;
}

function extractPermissions(user: any): Permission[] {
  return Array.isArray(user.permissions) ? user.permissions : [];
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    employee: null,
    activeRole: null,
    permissions: [],
    rolePicker: null,
  }),

  getters: {
    isAuthenticated: (s): boolean =>
      s.employee !== null && s.activeRole !== null,
    isAdmin: (s): boolean => s.activeRole === "merchant_admin",
    isAgent: (s): boolean => s.activeRole === "agent",
    requiresRolePicker: (s): boolean => s.rolePicker !== null,
    roleLabel: (s): string => {
      if (s.activeRole === "merchant_admin") return "Merchant Admin";
      return "Agent";
    },
    can: (s) => (feature: Permission): boolean => s.permissions.includes(feature),
  },

  actions: {
    async login(phone: string, password: string): Promise<void> {
      const res = await fetch(`${API}/auth/merchant/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.code ?? "error");
      }
      const body = await res.json();

      if (body.requiresRolePicker) {
        this.rolePicker = {
          token: body.pickerToken,
          roles: body.roles,
          user: body.user,
        };
      } else {
        this.employee = body.user;
        this.activeRole = body.user.role;
        this.permissions = extractPermissions(body.user);
        this.rolePicker = null;
      }
    },

    async selectRole(role: EmployeeRole): Promise<void> {
      if (!this.rolePicker) throw new Error("no picker state");
      const res = await fetch(`${API}/auth/merchant/select-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pickerToken: this.rolePicker.token, role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.code ?? "error");
      }
      const body = await res.json();
      this.employee = body.user;
      this.activeRole = body.user.role;
      this.permissions = extractPermissions(body.user);
      this.rolePicker = null;
    },

    async restoreSession(): Promise<void> {
      const tryMe = async (): Promise<boolean> => {
        const res = await fetch(`${API}/auth/merchant/me`, {
          credentials: "include",
        });
        if (!res.ok) return false;
        const body = await res.json();
        this.employee = body.user;
        this.activeRole = body.user.role;
        this.permissions = extractPermissions(body.user);
        return true;
      };

      if (await tryMe()) return;

      // Access token may have expired — try refreshing first
      const refreshRes = await fetch(`${API}/auth/merchant/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (refreshRes.ok) await tryMe();
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
      const res = await fetch(`${API}/auth/merchant/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.code ?? 'error');
      }
      if (this.employee) {
        this.employee.mustChangePassword = false;
      }
    },

    async logout(): Promise<void> {
      await fetch(`${API}/auth/merchant/logout`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
      this.employee = null;
      this.activeRole = null;
      this.permissions = [];
      this.rolePicker = null;
    },
  },
});
