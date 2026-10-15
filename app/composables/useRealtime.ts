import type { Socket } from 'socket.io-client'

export interface RealtimeMessage<TPayload = Record<string, unknown>> {
  id: string
  type: string
  recipientId?: string
  payload: TPayload
  occurredAt: string
}

type RealtimeHandler = (message: RealtimeMessage) => void
type ConnectionHandler = (reconnected: boolean) => void

const handlers = new Map<string, Set<RealtimeHandler>>()
const connectionHandlers = new Set<ConnectionHandler>()
let activeSocket: Socket | null = null
let activeSocketUserId: string | null = null
let connectPromise: Promise<void> | null = null
let hasConnected = false

export const useRealtime = () => {
  const { user } = useAuth()
  const connected = useState<boolean>('realtime.connected', () => false)

  const on = <TPayload = Record<string, unknown>>(
    eventType: string,
    handler: (message: RealtimeMessage<TPayload>) => void
  ) => {
    const eventHandlers = handlers.get(eventType) ?? new Set<RealtimeHandler>()
    const typedHandler: RealtimeHandler = (message) => handler(message as RealtimeMessage<TPayload>)
    eventHandlers.add(typedHandler)
    handlers.set(eventType, eventHandlers)

    return () => {
      eventHandlers.delete(typedHandler)
      if (!eventHandlers.size) handlers.delete(eventType)
    }
  }

  const onConnected = (handler: ConnectionHandler) => {
    connectionHandlers.add(handler)
    return () => connectionHandlers.delete(handler)
  }

  const connect = async () => {
    if (!import.meta.client || !user.value) return
    const requestedUserId = user.value.id
    if (activeSocket && activeSocketUserId !== requestedUserId) disconnect()
    if (activeSocket) return

    if (connectPromise) {
      await connectPromise
      if (activeSocket && activeSocketUserId === requestedUserId) return
      if (user.value?.id !== requestedUserId) return
    }

    connectPromise = (async () => {
      const { io } = await import('socket.io-client')
      if (user.value?.id !== requestedUserId || activeSocket) return

      const socket = io({
        path: '/socket.io',
        withCredentials: true,
        transports: ['websocket'],
        upgrade: false
      })
      activeSocket = socket
      activeSocketUserId = requestedUserId

      socket.on('connect', () => {
        const reconnected = hasConnected
        hasConnected = true
        connected.value = true
        connectionHandlers.forEach((handler) => {
          try {
            handler(reconnected)
          } catch (error) {
            console.error('[realtime] connection handler failed', error)
          }
        })
      })
      socket.on('disconnect', () => { connected.value = false })
      socket.on('connect_error', () => { connected.value = false })
      socket.onAny((eventType, message: RealtimeMessage) => {
        if (!message || typeof message !== 'object') return
        handlers.get(eventType)?.forEach((handler) => {
          try {
            handler(message)
          } catch (error) {
            console.error(`[realtime] handler failed for ${eventType}`, error)
          }
        })
      })
    })().finally(() => { connectPromise = null })

    return connectPromise
  }

  const disconnect = () => {
    activeSocket?.removeAllListeners()
    activeSocket?.disconnect()
    activeSocket = null
    activeSocketUserId = null
    connected.value = false
    connectPromise = null
    hasConnected = false
  }

  return { connected, connect, disconnect, on, onConnected }
}
