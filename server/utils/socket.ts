import { Server as SocketIOServer, type Socket } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import { getUserBySessionToken, sessionCookieName } from './auth'
import { prisma } from './prisma'
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

      const [memberships, supervisedTeams] = await Promise.all([
        prisma.teamMember.findMany({ where: { userId: user.id }, select: { teamId: true } }),
        prisma.teamSupervisor.findMany({ where: { supervisorId: user.id }, select: { teamId: true } })
      ])

      const channels: RealtimeChannel[] = [
        `user:${user.id}`,
        ...(user.role?.name ? [`role:${user.role.name}`] : []),
        ...new Set([...memberships, ...supervisedTeams].map(({ teamId }) => `team:${teamId}` as const))
      ]

      socket.data.user = user
      socket.data.realtimeChannels = channels
      next()
    } catch {
      next(new Error('UNAUTHORIZED'))
    }
  })
}

function registerConnection(socket: Socket): void {
  const channels = socket.data.realtimeChannels as RealtimeChannel[]
  for (const channel of channels) socket.join(channel)
  const unsubscribers = channels.map((channel) => subscribeToChannel(channel, (message) => {
    socket.emit(message.type, message)
  }))

  socket.on('disconnect', () => unsubscribers.forEach((unsubscribe) => unsubscribe()))
}

export function installSocketIO(httpServer: RealtimeHttpServer): SocketIOServer {
  if (httpServer.__brightonSocketIO) return httpServer.__brightonSocketIO

  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    transports: ['websocket'],
    allowUpgrades: false,
    cors: { origin: false },
    serveClient: false
  })

  authenticate(io)
  io.on('connection', registerConnection)
  httpServer.__brightonSocketIO = io
  return io
}
