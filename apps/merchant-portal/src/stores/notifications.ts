import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch, API } from '@/utils/apiFetch'

export type NotificationType =
  | 'deal_approved'
  | 'deal_declined'
  | 'payment_received'
  | 'overdue'
  | 'scoring_complete'
  | 'new_deal'
  | 'admin_message'

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
  if (raw.type === 'admin_message') {
    return {
      id: raw.id,
      type: 'admin_message',
      titleKey: raw.params.title ?? '',
      bodyKey: raw.params.body ?? '',
      params: {},
      read: raw.read,
      createdAt: raw.createdAt,
    }
  }

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

let _source: EventSource | null = null

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<AppNotification[]>([])
  const pushEnabled = ref(false)

  const unreadCount = computed(() => items.value.filter((n) => !n.read).length)
  const unread = computed(() => items.value.filter((n) => !n.read))
  const recent = computed(() => items.value.slice(0, 5))

  function getById(id: string) {
    return items.value.find((n) => n.id === id)
  }

  async function fetchAll() {
    try {
      const data = await apiFetch<{ notifications: ApiNotification[] }>('/notifications')
      items.value = data.notifications.map(toAppNotification)
    } catch {
      // non-fatal: leave existing items
    }
  }

  function connectSSE() {
    if (_source) return
    const source = new EventSource(`${API}/notifications/stream`, {
      withCredentials: true,
    })
    source.addEventListener('notification', (e) => {
      const raw = JSON.parse((e as MessageEvent).data) as ApiNotification
      const n = toAppNotification(raw)
      items.value = [n, ...items.value]
    })
    source.onerror = () => {
      source.close()
      _source = null
    }
    _source = source
  }

  function disconnectSSE() {
    _source?.close()
    _source = null
  }

  async function markRead(id: string) {
    const n = items.value.find((i) => i.id === id)
    if (!n || n.read) return
    n.read = true
    apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {
      n.read = false
    })
  }

  async function markAllRead() {
    const unreadItems = items.value.filter((n) => !n.read)
    unreadItems.forEach((n) => (n.read = true))
    apiFetch('/notifications/read-all', { method: 'POST' }).catch(() => {
      unreadItems.forEach((n) => (n.read = false))
    })
  }

  async function clearRead() {
    const before = items.value
    items.value = items.value.filter((n) => !n.read)
    apiFetch('/notifications', { method: 'DELETE' }).catch(() => {
      items.value = before
    })
  }

  function listenForPushMessages() {
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data?.type === 'push_notification') {
        const raw = event.data.payload as ApiNotification
        const n = toAppNotification(raw)
        if (!items.value.find((x) => x.id === n.id)) {
          items.value = [n, ...items.value]
        }
      }
    })
  }

  async function checkPushStatus() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    pushEnabled.value = !!sub
  }

  async function enablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const keyRes = await fetch(`${API}/merchant/push/vapid-key`, { credentials: 'include' })
    const { publicKey } = await keyRes.json()

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKey,
    })

    const { endpoint, keys } = sub.toJSON() as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    await fetch(`${API}/merchant/push/subscribe`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    })

    pushEnabled.value = true
  }

  async function disablePush() {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return

    await fetch(`${API}/merchant/push/subscribe`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })

    await sub.unsubscribe()
    pushEnabled.value = false
  }

  return {
    items,
    pushEnabled,
    unreadCount,
    unread,
    recent,
    getById,
    fetchAll,
    connectSSE,
    disconnectSSE,
    markRead,
    markAllRead,
    clearRead,
    listenForPushMessages,
    checkPushStatus,
    enablePush,
    disablePush,
  }
})
