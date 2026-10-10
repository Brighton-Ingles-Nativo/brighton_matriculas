const csrfToken = async () => {
  const response = await fetch('/api/auth/csrf', { credentials: 'include' })
  if (!response.ok) throw new Error(`CSRF request failed: ${response.status}`)
  const data = await response.json()
  return data.token
}

const registerSubscription = async (subscription) => {
  if (!subscription) return
  const token = await csrfToken()
  const response = await fetch('/api/notifications/push-subscriptions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify({ ...subscription.toJSON(), userAgent: self.navigator?.userAgent || 'service-worker' })
  })
  if (!response.ok) throw new Error(`Subscription registration failed: ${response.status}`)
}

const markAsRead = async (notificationId) => {
  if (!notificationId) return
  const token = await csrfToken()
  const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'x-csrf-token': token }
  })
  if (!response.ok && response.status !== 404) throw new Error(`Read request failed: ${response.status}`)
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    if (!event.data) return
    let data
    try {
      data = event.data.json()
    } catch {
      return
    }
    await self.registration.showNotification(data.title || 'Brighton', {
      body: data.body || '',
      tag: data.notificationId,
      data: { notificationId: data.notificationId, url: data.url || '/' },
      icon: '/favicon.ico',
      badge: '/favicon.ico'
    })
  })())
})

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(registerSubscription(event.newSubscription))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const notificationData = event.notification.data || {}
    await markAsRead(notificationData.notificationId).catch(() => undefined)

    const target = new URL(notificationData.url || '/', self.location.origin)
    const url = target.origin === self.location.origin
      ? `${target.pathname}${target.search}${target.hash}`
      : '/'
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    const current = windows.find((client) => client.url.startsWith(self.location.origin))
    if (current) {
      await current.navigate(url)
      return current.focus()
    }
    return clients.openWindow(url)
  })())
})
