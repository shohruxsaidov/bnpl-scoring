import { defineStore } from 'pinia';
import type { PlatformAdmin } from '@/types';

const API = import.meta.env.VITE_API_URL ?? '';

interface AuthState {
  admin: PlatformAdmin | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({ admin: null }),

  getters: {
    isAuthenticated: (s): boolean => s.admin !== null,
    initials: (s): string =>
      s.admin
        ? s.admin.fullName
            .split(' ')
            .map((p) => p.charAt(0))
            .slice(0, 2)
            .join('')
            .toUpperCase()
        : '',
  },

  actions: {
    async restoreSession(): Promise<void> {
      const tryMe = async (): Promise<boolean> => {
        const res = await fetch(`${API}/auth/admin/me`, { credentials: 'include' });
        if (!res.ok) return false;
        const body = await res.json();
        this.admin = body.user;
        return true;
      };

      if (await tryMe()) return;

      const refreshRes = await fetch(`${API}/auth/admin/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (refreshRes.ok) await tryMe();
    },

    async login(email: string, password: string): Promise<void> {
      const res = await fetch(`${API}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.code ?? 'error');
      }
      const body = await res.json();
      this.admin = body.user;
    },

    async logout(): Promise<void> {
      await fetch(`${API}/auth/admin/logout`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
      this.admin = null;
    },
  },
});
