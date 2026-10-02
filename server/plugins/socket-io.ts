import { installSocketIO } from '../utils/socket'
import type { Server as HttpServer } from 'node:http'
import type { Server as SocketIOServer } from 'socket.io'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    const server = event.node.req.socket?.server as (HttpServer & { __brightonSocketIO?: SocketIOServer }) | undefined
    if (server) installSocketIO(server)
  })
})
