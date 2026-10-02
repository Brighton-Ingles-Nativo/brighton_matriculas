import { EventEmitter } from 'node:events'

export type RealtimeEvent = {
  id: string
  type: string
  recipientId: string
  payload: Record<string, unknown>
  occurredAt: string
}

export type RealtimeChannel = `user:${string}` | `role:${string}` | `team:${string}` | `entity:${string}:${string}`

type RealtimeBus = EventEmitter & { __brightonRealtime?: EventEmitter }

const globalBus = globalThis as unknown as RealtimeBus
const bus = globalBus.__brightonRealtime ?? new EventEmitter()
bus.setMaxListeners(0)
globalBus.__brightonRealtime = bus

export function publishToChannel(channel: RealtimeChannel, event: RealtimeEvent): void {
  bus.emit(channel, event)
}

export function publishToUser(userId: string, event: RealtimeEvent): void {
  publishToChannel(`user:${userId}`, event)
}

export function subscribeToChannel(channel: RealtimeChannel, listener: (event: RealtimeEvent) => void): () => void {
  bus.on(channel, listener)
  return () => bus.off(channel, listener)
}

export function subscribeToUser(userId: string, listener: (event: RealtimeEvent) => void): () => void {
  return subscribeToChannel(`user:${userId}`, listener)
}
