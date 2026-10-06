import { installSocketIO } from '../utils/socket'
import { retryPendingWebPushDeliveries } from '../utils/notifications'
import type { Server as HttpServer } from 'node:http'
import type { Server as SocketIOServer } from 'socket.io'

export default defineNitroPlugin((nitroApp) => {
  const retry = () => retryPendingWebPushDeliveries().catch((error) => {
    console.error('[notifications] retry worker failed', error)
  })
  void retry()
  const retryTimer = setInterval(retry, 30_000)
  retryTimer.unref?.()

  nitroApp.hooks.hook('request', (event) => {
    const server = event.node.req.socket?.server as (HttpServer & { __brightonSocketIO?: SocketIOServer }) | undefined
    if (server) installSocketIO(server)
  })
})
