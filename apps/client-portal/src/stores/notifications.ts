import { defineStore } from 'pinia'
import type { AppNotification, NotificationKind } from '@/types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

interface ApiNotification {
  id: string
  type: string
  params: Record<string, string>
  read: boolean
  createdAt: string
}

const KIND_MAP: Record<string, NotificationKind> = {
  overdue: 'overdue',
  payment_received: 'payment',
  deal_approved: 'deal',
  deal_declined: 'deal',
  new_deal: 'deal',
  admin_message: 'message',
}

function toAppNotification(raw: ApiNotification): AppNotification {
  // admin_message carries free-text title + body in params
  if (raw.type === 'admin_message') {
    return {
      id: raw.id,
      kind: 'message',
      title: raw.params.title ?? '',
      body: raw.params.body ?? '',
      createdAt: raw.createdAt,
      read: raw.read,
    }
  }
  return {
    id: raw.id,
    kind: KIND_MAP[raw.type] ?? 'deal',
    title: raw.params.title ?? raw.type,
    body: raw.params.body ?? '',
    createdAt: raw.createdAt,
    read: raw.read,
  }
}

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [] as AppNotification[],
    _source: null as EventSource | null,
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
        const res = await fetch(`${API}/api/v1/notifications`, { credentials: 'include' })
        if (!res.ok) return
        const data: { notifications: ApiNotification[] } = await res.json()
        this.items = data.notifications.map(toAppNotification)
      } catch {
        // non-fatal
      }
    },

    connectSSE() {
      if (this._source) return
      const source = new EventSource(`${API}/api/v1/notifications/stream`, {
        withCredentials: true,
      })
      source.addEventListener('notification', (e) => {
        const raw = JSON.parse((e as MessageEvent).data) as ApiNotification
        this.items = [toAppNotification(raw), ...this.items]
      })
      source.onerror = () => {
        source.close()
        this._source = null
      }
      this._source = source
    },

    disconnectSSE() {
      this._source?.close()
      this._source = null
    },

    markAllRead() {
      const unread = this.items.filter((n) => !n.read)
      unread.forEach((n) => (n.read = true))
      fetch(`${API}/api/v1/notifications/read-all`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {
        unread.forEach((n) => (n.read = false))
      })
    },

    markRead(id: string) {
      const n = this.items.find((x) => x.id === id)
      if (!n || n.read) return
      n.read = true
      fetch(`${API}/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      }).catch(() => {
        n.read = false
      })
    },
  },
})
