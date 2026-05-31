import { defineStore } from 'pinia';
import type { AppNotification, NotificationKind } from '@/types';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface ApiNotification {
  id: string;
  type: string;
  params: Record<string, string>;
  read: boolean;
  createdAt: string;
}

const KIND_MAP: Record<string, NotificationKind> = {
  overdue: 'overdue',
  payment_received: 'payment',
  deal_approved: 'deal',
  deal_declined: 'deal',
  new_deal: 'deal',
  deal_issued: 'deal',
  payment_due: 'payment',
  admin_message: 'message',
};

function toAppNotification(raw: ApiNotification): AppNotification {
  if (raw.type === 'admin_message') {
    return {
      id: raw.id,
      kind: 'message',
      title: raw.params.title ?? '',
      body: raw.params.body ?? '',
      createdAt: raw.createdAt,
      read: raw.read,
    };
  }
  return {
    id: raw.id,
    kind: KIND_MAP[raw.type] ?? 'deal',
    title: raw.params.title ?? raw.type,
    body: raw.params.body ?? '',
    createdAt: raw.createdAt,
    read: raw.read,
  };
}


export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [] as AppNotification[],
    pushEnabled: false,
  }),

  getters: {
    unreadCount: (s): number => s.items.filter((n) => !n.read).length,
    sorted: (s): AppNotification[] =>
      [...s.items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
  },

  actions: {
    async fetchAll() {
      try {
        const res = await fetch(`${API}/notifications`, { credentials: 'include' });
        if (!res.ok) return;
        const data: { notifications: ApiNotification[] } = await res.json();
        this.items = data.notifications.map(toAppNotification);
      } catch {
        // non-fatal
      }
    },

    /** Called from main.ts after SW is registered to wire up postMessage. */
    listenForPushMessages() {
      navigator.serviceWorker?.addEventListener('message', (event) => {
        if (event.data?.type === 'push_notification') {
          const raw = event.data.payload as ApiNotification;
          const n = toAppNotification(raw);
          if (!this.items.find((x) => x.id === n.id)) {
            this.items = [n, ...this.items];
          }
        }
      });
    },

    async checkPushStatus() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      this.pushEnabled = !!sub;
    },

    async enablePush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const keyRes = await fetch(`${API}/client/push/vapid-key`, { credentials: 'include' });
      const { publicKey } = await keyRes.json();

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      const { endpoint, keys } = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      await fetch(`${API}/client/push/subscribe`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
      });

      this.pushEnabled = true;
    },

    async disablePush() {
      if (!('serviceWorker' in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;

      await fetch(`${API}/client/push/subscribe`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });

      await sub.unsubscribe();
      this.pushEnabled = false;
    },

    markAllRead() {
      const unread = this.items.filter((n) => !n.read);
      unread.forEach((n) => (n.read = true));
      fetch(`${API}/notifications/read-all`, {
        method: 'POST',
        credentials: 'include',
        body: '{}',
      }).catch(() => {
        unread.forEach((n) => (n.read = false));
      });
    },

    markRead(id: string) {
      const n = this.items.find((x) => x.id === id);
      if (!n || n.read) return;
      n.read = true;
      fetch(`${API}/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
        body: '{}',
      }).catch(() => {
        n.read = false;
      });
    },
  },
});
