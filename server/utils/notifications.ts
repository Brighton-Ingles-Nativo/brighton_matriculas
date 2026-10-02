import { Prisma, type PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import webpush from 'web-push'
import { prisma } from './prisma'
import { publishToUser } from './realtime'

export const NOTIFICATION_CHANNELS = ['socket_io', 'web_push'] as const
export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number]
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical'

export type NotificationInput = {
  recipients: string[]
  type: string
  title: string
  message: string
  entityType?: string
  entityId?: string
  actionUrl?: string
  priority?: NotificationPriority
  data?: Record<string, unknown>
  dedupeKey?: string
  channels?: NotificationChannel[]
}

type DbClient = PrismaClient | Prisma.TransactionClient

export async function notify(input: NotificationInput, db: DbClient = prisma) {
  const recipients = [...new Set(input.recipients.filter(Boolean))]
  if (!recipients.length) return []

  const channels = [...new Set(input.channels ?? ['socket_io', 'web_push'])]
  const dedupeKey = input.dedupeKey ?? `event:${input.type}:${input.entityType ?? 'system'}:${input.entityId ?? randomUUID()}`
  const created = []

  for (const recipientId of recipients) {
    const existing = await db.notification.findUnique({ where: { recipientId_dedupeKey: { recipientId, dedupeKey } } })
    if (existing) continue

    let notification
    try {
      notification = await db.notification.create({
        data: {
          recipientId,
          type: input.type,
          title: input.title,
          message: input.message,
          entityType: input.entityType,
          entityId: input.entityId,
          actionUrl: input.actionUrl,
          priority: input.priority ?? 'normal',
          data: (input.data ?? {}) as Prisma.InputJsonValue,
          dedupeKey
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue
      throw error
    }

    if (channels.includes('socket_io')) {
      publishToUser(recipientId, {
        id: notification.id,
        type: 'notification.created',
        recipientId,
        payload: serializeNotification(notification),
        occurredAt: notification.createdAt.toISOString()
      })
    }
    created.push(notification)
    if (channels.includes('web_push')) void deliverWebPush(notification)
  }

  return created
}

async function deliverWebPush(notification: {
  id: string
  title: string
  message: string
  actionUrl: string | null
  priority: string
  recipientId: string
  data: Prisma.JsonValue
}) {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return

  webpush.setVapidDetails(subject, publicKey, privateKey)
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: notification.recipientId, active: true }
  })

  try {
    await Promise.all(subscriptions.map(async (subscription) => {
      const payload = JSON.stringify({
        notificationId: notification.id,
        title: notification.title,
        body: notification.message,
        url: notification.actionUrl,
        priority: notification.priority,
        data: notification.data
      })
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload)
        await prisma.pushSubscription.update({ where: { id: subscription.id }, data: { lastUsedAt: new Date() } })
      } catch (error: unknown) {
        const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0
        if (statusCode === 404 || statusCode === 410) await prisma.pushSubscription.update({ where: { id: subscription.id }, data: { active: false } })
        throw error
      }
    }))
  } catch (error) {
    console.error('[notifications] Web Push delivery failed', { notificationId: notification.id, error })
  }
}

export function serializeNotification(notification: {
  id: string
  recipientId: string
  type: string
  title: string
  message: string
  entityType: string | null
  entityId: string | null
  actionUrl: string | null
  priority: string
  data: Prisma.JsonValue
  readAt: Date | null
  createdAt: Date
}) {
  return {
    id: notification.id,
    recipientId: notification.recipientId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    entityType: notification.entityType,
    entityId: notification.entityId,
    actionUrl: notification.actionUrl,
    priority: notification.priority,
    data: notification.data,
    readAt: notification.readAt,
    createdAt: notification.createdAt
  }
}
