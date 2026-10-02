self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(self.registration.showNotification(data.title || 'Brighton', {
    body: data.body || '',
    tag: data.notificationId,
    data: { url: data.url || '/' },
    icon: '/favicon.ico',
    badge: '/favicon.ico'
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const current = windows.find((client) => 'focus' in client)
    if (current) {
      current.navigate(url)
      return current.focus()
    }
    return clients.openWindow(url)
  }))
})
