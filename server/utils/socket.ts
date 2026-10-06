import { Server as SocketIOServer, type Socket } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import { getUserBySessionToken, sessionCookieName } from './auth'
import { subscribeToChannel, type RealtimeChannel } from './realtime'
import { serializeNotification } from './notifications'
import { prisma } from './prisma'

type RealtimeHttpServer = HttpServer & { __brightonSocketIO?: SocketIOServer }

function parseCookies(value: string | undefined): Record<string, string> {
  if (!value) return {}
  return Object.fromEntries(value.split(';').map((part) => {
    const index = part.indexOf('=')
    if (index < 0) return ['', '']
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]
  }).filter(([key]) => key))
}

function authenticate(io: SocketIOServer): void {
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie)
      const user = await getUserBySessionToken(cookies[sessionCookieName()])
      if (!user) return next(new Error('UNAUTHORIZED'))
      socket.data.user = user
      next()
    } catch {
      next(new Error('UNAUTHORIZED'))
    }
  })
}

function registerConnection(socket: Socket): void {
  const user = socket.data.user as { id: string; role?: { name?: string } }
  socket.join(`user:${user.id}`)
  if (user.role?.name) socket.join(`role:${user.role.name}`)

  const channels: RealtimeChannel[] = [`user:${user.id}`]
  if (user.role?.name) channels.push(`role:${user.role.name}`)
  const unsubscribers = channels.map((channel) => subscribeToChannel(channel, (message) => {
    socket.emit(message.type, message)
  }))

  // The in-process bus gives low-latency delivery, while this small database
  // poller also covers notifications created by another app instance.
  let cursor = new Date()
  const seenIds = new Set<string>()
  const poll = setInterval(async () => {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          recipientId: user.id,
          createdAt: { gte: cursor },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        orderBy: { createdAt: 'asc' },
        take: 100
      })
      for (const notification of notifications) {
        cursor = notification.createdAt
        if (seenIds.has(notification.id)) continue
        seenIds.add(notification.id)
        socket.emit('notification.created', {
          id: notification.id,
          type: 'notification.created',
          recipientId: user.id,
          payload: serializeNotification(notification),
          occurredAt: notification.createdAt.toISOString()
        })
      }
      if (seenIds.size > 500) {
        const oldest = [...seenIds].slice(0, 100)
        oldest.forEach((id) => seenIds.delete(id))
      }
    } catch (error) {
      console.error('[notifications] realtime polling failed', { userId: user.id, error })
    }
  }, 2000)
  poll.unref?.()

  socket.on('disconnect', () => unsubscribers.forEach((unsubscribe) => unsubscribe()))
  socket.on('disconnect', () => clearInterval(poll))
}

export function installSocketIO(httpServer: RealtimeHttpServer): SocketIOServer {
  if (httpServer.__brightonSocketIO) return httpServer.__brightonSocketIO

  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    cors: { origin: false },
    serveClient: false
  })
  authenticate(io)
  io.on('connection', registerConnection)
  httpServer.__brightonSocketIO = io
  return io
}
