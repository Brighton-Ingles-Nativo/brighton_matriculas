import { toast } from '@/components/ui/sonner'

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

let notificationSubscriptions: Array<() => void> = []
let notificationStartPromise: Promise<void> | null = null
let notificationLoadPromise: Promise<void> | null = null
let notificationRefreshHandler: (() => void) | null = null
let notificationLoadedUserId: string | null = null
const realtimeNotifications = new Map<string, AppNotification>()
const toastedNotificationIds = new Set<string>()

const base64ToUint8Array = (value: string) => {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)))
}

export const useNotifications = () => {
  const { user, csrfHeaders } = useAuth()
  const realtime = useRealtime()
  const items = useState<AppNotification[]>('notifications.items', () => [])
  const unreadCount = useState<number>('notifications.unreadCount', () => 0)
  const pushEnabled = useState<boolean>('notifications.pushEnabled', () => false)
  const loading = useState<boolean>('notifications.loading', () => false)

  const load = async () => {
    if (!user.value) return
    if (notificationLoadPromise) return notificationLoadPromise
    const requestedUserId = user.value.id

    notificationLoadPromise = (async () => {
      loading.value = true
      try {
        const response = await $fetch<NotificationResponse>('/api/notifications', { credentials: 'include' })
        if (user.value?.id !== requestedUserId) return
        const isInitialLoad = notificationLoadedUserId !== requestedUserId
        const currentIds = new Set(items.value.map((notification) => notification.id))
        const responseIds = new Set(response.data.map((notification) => notification.id))
        const eventsDuringSync = [...realtimeNotifications.values()]
          .filter((notification) => !responseIds.has(notification.id))
        items.value = [...eventsDuringSync, ...response.data].slice(0, 100)
        unreadCount.value = response.unreadCount + eventsDuringSync.filter((notification) => !notification.readAt).length
        notificationLoadedUserId = requestedUserId
        if (!isInitialLoad) {
          response.data
            .filter((notification) => !currentIds.has(notification.id))
            .forEach(showToastOnce)
        }
      } finally {
        loading.value = false
      }
    })().finally(() => { notificationLoadPromise = null })

    return notificationLoadPromise
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

  const showToastOnce = (notification: AppNotification) => {
    if (notification.readAt || toastedNotificationIds.has(notification.id)) return
    toastedNotificationIds.add(notification.id)
    showToast(notification)
  }

  const handleCreated = (event: { payload?: AppNotification }) => {
    const notification = event.payload
    if (!notification) return
    realtimeNotifications.set(notification.id, notification)
    if (!items.value.some((item) => item.id === notification.id)) {
      items.value = [notification, ...items.value].slice(0, 100)
      unreadCount.value += 1
    }
    showToastOnce(notification)
  }

  const handleRead = (event: { payload?: { id?: string; readAt?: string } }) => {
    const id = event.payload?.id
    if (!id) return
    const notification = items.value.find((item) => item.id === id)
    if (notification && !notification.readAt) unreadCount.value = Math.max(0, unreadCount.value - 1)
    items.value = items.value.map((item) => item.id === id
      ? { ...item, readAt: event.payload?.readAt || new Date().toISOString() }
      : item)
    const liveNotification = realtimeNotifications.get(id)
    if (liveNotification) liveNotification.readAt = event.payload?.readAt || new Date().toISOString()
  }

  const start = async () => {
    if (!import.meta.client || !user.value) return
    if (notificationStartPromise) return notificationStartPromise

    notificationStartPromise = (async () => {
      const refresh = () => {
        if (!user.value || document.visibilityState !== 'visible') return
        void load().catch((error) => console.error('[notifications] refresh failed', error))
      }

      if (!notificationSubscriptions.length) {
        notificationSubscriptions = [
          realtime.on<AppNotification>('notification.created', (event) => handleCreated({ payload: event.payload })),
          realtime.on<{ id?: string; readAt?: string }>('notification.read', (event) => handleRead({ payload: event.payload })),
          realtime.onConnected(refresh)
        ]
      }

      if (!notificationRefreshHandler) {
        notificationRefreshHandler = refresh
        window.addEventListener('focus', refresh)
        document.addEventListener('visibilitychange', refresh)
      }

      await load().catch((error) => console.error('[notifications] initial load failed', error))
      await realtime.connect().catch((error) => console.error('[notifications] realtime connection failed', error))
    })().finally(() => { notificationStartPromise = null })
    return notificationStartPromise
  }

  const stop = () => {
    if (notificationRefreshHandler && import.meta.client) {
      window.removeEventListener('focus', notificationRefreshHandler)
      document.removeEventListener('visibilitychange', notificationRefreshHandler)
    }
    notificationRefreshHandler = null
    notificationSubscriptions.forEach((unsubscribe) => unsubscribe())
    notificationSubscriptions = []
    realtime.disconnect()
    notificationStartPromise = null
    realtimeNotifications.clear()
    toastedNotificationIds.clear()
    notificationLoadedUserId = null
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
    if (!import.meta.client || !('serviceWorker' in navigator)) {
      pushEnabled.value = false
      return
    }
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) {
      pushEnabled.value = false
      return
    }
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

  return { items, unreadCount, connected: realtime.connected, pushEnabled, loading, load, start, stop, markRead, enablePush, disablePush, syncPushState }
}
