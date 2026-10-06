import type { Socket } from 'socket.io-client'
import { toast } from 'vue-sonner'

export interface AppNotification {
  id: string
  recipientId: string
  type: string
  title: string
  message: string
  entityType: string | null
  entityId: string | null
  actionUrl: string | null
  priority: string
  data: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

interface NotificationResponse {
  success: boolean
  data: AppNotification[]
  unreadCount: number
}

interface PushConfigResponse {
  success: boolean
  enabled: boolean
  publicKey: string | null
}

let activeSocket: Socket | null = null
let startPromise: Promise<void> | null = null

const base64ToUint8Array = (value: string) => {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)))
}

export const useNotifications = () => {
  const { user, csrfHeaders } = useAuth()
  const items = useState<AppNotification[]>('notifications.items', () => [])
  const unreadCount = useState<number>('notifications.unreadCount', () => 0)
  const connected = useState<boolean>('notifications.connected', () => false)
  const pushEnabled = useState<boolean>('notifications.pushEnabled', () => false)
  const loading = useState<boolean>('notifications.loading', () => false)

  const load = async () => {
    if (!user.value) return
    loading.value = true
    try {
      const response = await $fetch<NotificationResponse>('/api/notifications', { credentials: 'include' })
      items.value = response.data
      unreadCount.value = response.unreadCount
    } finally {
      loading.value = false
    }
  }

  const showToast = (notification: AppNotification) => {
    toast(notification.title, {
      description: notification.message,
      duration: notification.priority === 'critical' || notification.priority === 'high' ? 9000 : 5000,
      action: notification.actionUrl
        ? { label: 'Ver', onClick: () => navigateTo(notification.actionUrl!) }
        : undefined
    })
  }

  const handleCreated = (event: { payload?: AppNotification }) => {
    const notification = event.payload
    if (!notification || items.value.some((item) => item.id === notification.id)) return
    items.value = [notification, ...items.value].slice(0, 100)
    unreadCount.value += 1
    showToast(notification)
  }

  const start = async () => {
    if (!import.meta.client || !user.value || activeSocket || startPromise) return startPromise
    startPromise = (async () => {
      await load()
      const { io } = await import('socket.io-client')
      activeSocket = io({ path: '/socket.io', withCredentials: true, transports: ['websocket', 'polling'] })
      activeSocket.on('connect', () => {
        const reconnecting = connected.value
        connected.value = true
        if (reconnecting) void load()
      })
      activeSocket.on('disconnect', () => { connected.value = false })
      activeSocket.on('notification.created', handleCreated)
      activeSocket.on('notification.read', (event: { payload?: { id?: string; readAt?: string } }) => {
        const id = event.payload?.id
        if (!id) return
        const notification = items.value.find((item) => item.id === id)
        if (notification && !notification.readAt) unreadCount.value = Math.max(0, unreadCount.value - 1)
        items.value = items.value.map((item) => item.id === id ? { ...item, readAt: event.payload?.readAt || new Date().toISOString() } : item)
      })
    })().finally(() => { startPromise = null })
    return startPromise
  }

  const stop = () => {
    activeSocket?.removeAllListeners()
    activeSocket?.disconnect()
    activeSocket = null
    connected.value = false
    startPromise = null
    items.value = []
    unreadCount.value = 0
    pushEnabled.value = false
  }

  const markRead = async (notification: AppNotification) => {
    if (notification.readAt) return
    await $fetch(`/api/notifications/${notification.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: await csrfHeaders()
    })
    notification.readAt = new Date().toISOString()
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }

  const enablePush = async () => {
    if (!import.meta.client || !user.value || !('serviceWorker' in navigator) || !('PushManager' in window)) return false
    const config = await $fetch<PushConfigResponse>('/api/notifications/push-config', { credentials: 'include' })
    if (!config.enabled || !config.publicKey || !('Notification' in window)) return false
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    if (permission !== 'granted') return false
    const registration = await navigator.serviceWorker.register('/sw.js')
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(config.publicKey) })
    await $fetch('/api/notifications/push-subscriptions', {
      method: 'POST',
      credentials: 'include',
      headers: await csrfHeaders(),
      body: { ...subscription.toJSON(), userAgent: navigator.userAgent }
    })
    pushEnabled.value = true
    return true
  }

  const disablePush = async () => {
    if (!import.meta.client || !('serviceWorker' in navigator)) return
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return
    await $fetch('/api/notifications/push-subscriptions', {
      method: 'DELETE',
      credentials: 'include',
      headers: await csrfHeaders(),
      body: { endpoint: subscription.endpoint }
    })
    await subscription.unsubscribe()
    pushEnabled.value = false
  }

  const syncPushState = async () => {
    if (!import.meta.client || !('serviceWorker' in navigator)) {
      pushEnabled.value = false
      return
    }
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    pushEnabled.value = Boolean(await registration?.pushManager.getSubscription())
  }

  return { items, unreadCount, connected, pushEnabled, loading, load, start, stop, markRead, enablePush, disablePush, syncPushState }
}
