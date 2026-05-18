import { defineStore } from 'pinia'
import type { AppNotification } from '@/types'

const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'ntf_001',
    kind: 'overdue',
    title: 'Overdue payment',
    body: '1,350,000 so‘m was due Jun 15 for FurniturePlus. Please pay to avoid penalties.',
    createdAt: '2026-06-15T09:05:00',
    read: false,
  },
  {
    id: 'ntf_002',
    kind: 'payment',
    title: 'Payment confirmed',
    body: '1,399,167 so‘m received on Jun 15 for TechShop Tashkent. Thank you!',
    createdAt: '2026-06-15T14:22:00',
    read: true,
  },
  {
    id: 'ntf_003',
    kind: 'payment',
    title: 'Payment confirmed',
    body: '1,399,167 so‘m received on May 15 for TechShop Tashkent.',
    createdAt: '2026-05-15T13:40:00',
    read: true,
  },
  {
    id: 'ntf_004',
    kind: 'deal',
    title: 'New deal issued',
    body: 'A new instalment deal was issued at TechShop Tashkent for 14,990,000 so‘m.',
    createdAt: '2026-04-02T11:15:00',
    read: true,
  },
]

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: NOTIFICATIONS as AppNotification[],
  }),

  getters: {
    unreadCount: (s): number => s.items.filter((n) => !n.read).length,
    sorted: (s): AppNotification[] =>
      [...s.items].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
  },

  actions: {
    markAllRead() {
      this.items.forEach((n) => {
        n.read = true
      })
    },
    markRead(id: string) {
      const n = this.items.find((x) => x.id === id)
      if (n) n.read = true
    },
  },
})
