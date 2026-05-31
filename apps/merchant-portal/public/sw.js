self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.params?.title ?? data.type ?? 'Уведомление'
  const options = { body: data.params?.body ?? '', tag: data.id ?? data.type }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const focused = clientList.find((c) => c.focused)
      if (focused) {
        focused.postMessage({ type: 'push_notification', payload: data })
        return
      }
      if (clientList.length) clientList[0].postMessage({ type: 'push_notification', payload: data })
      return self.registration.showNotification(title, options)
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length) return clientList[0].focus()
      return self.clients.openWindow('/')
    }),
  )
})
