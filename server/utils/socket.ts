import { Server as SocketIOServer, type Socket } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import { getUserBySessionToken, sessionCookieName } from './auth'
import { subscribeToChannel, type RealtimeChannel } from './realtime'

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
  socket.on('disconnect', () => unsubscribers.forEach((unsubscribe) => unsubscribe()))
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
