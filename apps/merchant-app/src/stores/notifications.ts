import { defineStore } from 'pinia'
import { apiFetch, API } from '@/utils/apiFetch'

export type NotificationType =
  | 'deal_approved'
  | 'deal_declined'
  | 'payment_received'
  | 'overdue'
  | 'new_deal'

export interface AppNotification {
  id: string
  type: NotificationType
  titleKey: string
  bodyKey: string
  params: Record<string, string>
  read: boolean
  createdAt: string
  dealId?: string
}

interface ApiNotification {
  id: string
  type: string
  params: Record<string, string>
  read: boolean
  createdAt: string
}

function toAppNotification(raw: ApiNotification): AppNotification {
  const camel = raw.type.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  return {
    id: raw.id,
    type: raw.type as NotificationType,
    titleKey: `notifications.types.${camel}`,
    bodyKey: `notifications.bodies.${camel}`,
    params: raw.params,
    read: raw.read,
    createdAt: raw.createdAt,
    dealId: raw.params.dealId,
  }
}

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [] as AppNotification[],
    _source: null as EventSource | null,
  }),

  getters: {
    unreadCount: (s) => s.items.filter((n) => !n.read).length,
    unread: (s) => s.items.filter((n) => !n.read),
    recent: (s) => s.items.slice(0, 5),
    getById: (s) => (id: string) => s.items.find((n) => n.id === id),
  },

  actions: {
    async fetchAll() {
      try {
        const data = await apiFetch<{ notifications: ApiNotification[] }>('/api/v1/notifications')
        this.items = data.notifications.map(toAppNotification)
      } catch {
        // non-fatal: leave existing items
      }
    },

    connectSSE() {
      if (this._source) return
      const source = new EventSource(`${API}/api/v1/notifications/stream`, {
        withCredentials: true,
      })
      source.addEventListener('notification', (e) => {
        const raw = JSON.parse((e as MessageEvent).data) as ApiNotification
        const n = toAppNotification(raw)
        this.items = [n, ...this.items]
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

    async markRead(id: string) {
      const n = this.items.find((i) => i.id === id)
      if (!n || n.read) return
      n.read = true
      apiFetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {
        n.read = false
      })
    },

    async markAllRead() {
      const unread = this.items.filter((n) => !n.read)
      unread.forEach((n) => (n.read = true))
      apiFetch('/api/v1/notifications/read-all', { method: 'POST' }).catch(() => {
        unread.forEach((n) => (n.read = false))
      })
    },

    async clearRead() {
      const before = this.items
      this.items = this.items.filter((n) => !n.read)
      apiFetch('/api/v1/notifications', { method: 'DELETE' }).catch(() => {
        this.items = before
      })
    },
  },
})
