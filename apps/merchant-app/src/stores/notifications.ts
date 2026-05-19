import { defineStore } from 'pinia'

export type NotificationType =
  | 'deal_approved'
  | 'deal_declined'
  | 'payment_received'
  | 'overdue'
  | 'scoring_complete'
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

const now = new Date()
const today = (h: number, m: number) => {
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
const daysAgo = (days: number, h = 10, m = 0) => {
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

const MOCK: AppNotification[] = [
  {
    id: 'n1',
    type: 'deal_approved',
    titleKey: 'notifications.types.dealApproved',
    bodyKey: 'notifications.bodies.dealApproved',
    params: { clientName: 'Jasur Rahimov', dealId: 'DEAL-1041', score: '742' },
    read: false,
    createdAt: today(9, 14),
    dealId: 'DEAL-1041',
  },
  {
    id: 'n2',
    type: 'payment_received',
    titleKey: 'notifications.types.paymentReceived',
    bodyKey: 'notifications.bodies.paymentReceived',
    params: { clientName: 'Malika Yusupova', dealId: 'DEAL-1005', amount: '1 249 167' },
    read: false,
    createdAt: today(10, 33),
    dealId: 'DEAL-1005',
  },
  {
    id: 'n3',
    type: 'overdue',
    titleKey: 'notifications.types.overdue',
    bodyKey: 'notifications.bodies.overdue',
    params: { clientName: 'Bobur Toshmatov', dealId: 'DEAL-1008', days: '5' },
    read: false,
    createdAt: today(8, 0),
    dealId: 'DEAL-1008',
  },
  {
    id: 'n4',
    type: 'scoring_complete',
    titleKey: 'notifications.types.scoringComplete',
    bodyKey: 'notifications.bodies.scoringComplete',
    params: { clientName: 'Nodira Karimova', score: '618' },
    read: true,
    createdAt: daysAgo(1, 15, 22),
  },
  {
    id: 'n5',
    type: 'deal_declined',
    titleKey: 'notifications.types.dealDeclined',
    bodyKey: 'notifications.bodies.dealDeclined',
    params: { clientName: 'Sherzod Ergashev', dealId: 'DEAL-1039', score: '481' },
    read: true,
    createdAt: daysAgo(1, 11, 5),
    dealId: 'DEAL-1039',
  },
  {
    id: 'n6',
    type: 'new_deal',
    titleKey: 'notifications.types.newDeal',
    bodyKey: 'notifications.bodies.newDeal',
    params: { agentName: 'Alisher Nazarov', dealId: 'DEAL-1040' },
    read: true,
    createdAt: daysAgo(1, 9, 48),
    dealId: 'DEAL-1040',
  },
  {
    id: 'n7',
    type: 'payment_received',
    titleKey: 'notifications.types.paymentReceived',
    bodyKey: 'notifications.bodies.paymentReceived',
    params: { clientName: 'Feruza Mirzaeva', dealId: 'DEAL-1012', amount: '874 000' },
    read: true,
    createdAt: daysAgo(3, 14, 17),
    dealId: 'DEAL-1012',
  },
  {
    id: 'n8',
    type: 'overdue',
    titleKey: 'notifications.types.overdue',
    bodyKey: 'notifications.bodies.overdue',
    params: { clientName: 'Otabek Holmatov', dealId: 'DEAL-998', days: '12' },
    read: true,
    createdAt: daysAgo(5, 8, 30),
    dealId: 'DEAL-998',
  },
]

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [...MOCK] as AppNotification[],
  }),
  getters: {
    unreadCount: (s) => s.items.filter((n) => !n.read).length,
    unread: (s) => s.items.filter((n) => !n.read),
    recent: (s) => s.items.slice(0, 5),
    getById: (s) => (id: string) => s.items.find((n) => n.id === id),
  },
  actions: {
    markRead(id: string) {
      const n = this.items.find((i) => i.id === id)
      if (n) n.read = true
    },
    markAllRead() {
      this.items.forEach((n) => (n.read = true))
    },
    clearRead() {
      this.items = this.items.filter((n) => !n.read)
    },
  },
})
