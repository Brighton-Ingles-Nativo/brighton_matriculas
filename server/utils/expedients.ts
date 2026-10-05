import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { prisma } from './prisma'
import { getUserBySession } from './auth'
import { assertContractAccess } from './contract-access'

export const EXPEDIENT_ROLES = ['admin', 'asesor', 'supervisor', 'asistente_comercial', 'verificador'] as const
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
export const DOCUMENT_TYPES = ['DNI', 'VOUCHER', 'ADICIONAL'] as const
export type ExpedientDocumentType = typeof DOCUMENT_TYPES[number]

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}

export const isExpedientRole = (role: string | undefined): boolean => EXPEDIENT_ROLES.includes(role as typeof EXPEDIENT_ROLES[number])

export async function requireExpedientUser(event: H3Event) {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  if (!isExpedientRole(user.role?.name)) throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para gestionar expedientes' })
  return user
}

export async function getAccessibleContract(contractId: string, user: Awaited<ReturnType<typeof requireExpedientUser>>) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true, userId: true, signedAt: true }
  })
  if (!contract) throw createError({ statusCode: 404, statusMessage: 'Matrícula no encontrada' })
  await assertContractAccess(user, contractId)
  return contract
}

export function uploadRoot(): string {
  const configured = String(useRuntimeConfig().expedientUploadDir || '.data/expedients')
  return resolve(process.cwd(), configured)
}

export function validateDocumentType(value: unknown): asserts value is ExpedientDocumentType {
  if (!DOCUMENT_TYPES.includes(value as ExpedientDocumentType)) {
    throw createError({ statusCode: 400, statusMessage: 'Tipo de documento inválido' })
  }
}

export function validateUpload(file: { data?: Buffer; type?: string; filename?: string }): void {
  const mimeType = String(file.type || '').toLowerCase()
  if (!MIME_EXTENSIONS[mimeType]) {
    throw createError({ statusCode: 400, statusMessage: 'Solo se permiten archivos PDF, JPG, PNG o WEBP.' })
  }
  if (!file.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'El archivo está vacío.' })
  }
  if (file.data.length > MAX_DOCUMENT_SIZE) {
    throw createError({ statusCode: 413, statusMessage: 'Cada archivo puede pesar como máximo 10 MB.' })
  }
}

export async function storeUpload(contractId: string, file: { data?: Buffer; type?: string; filename?: string }) {
  validateUpload(file)
  const mimeType = String(file.type).toLowerCase()
  const extension = MIME_EXTENSIONS[mimeType]
  const directory = join(uploadRoot(), contractId)
  await mkdir(directory, { recursive: true })
  const storedName = `${randomUUID()}${extension}`
  const relativePath = join(contractId, storedName)
  await writeFile(join(directory, storedName), file.data as Buffer, { flag: 'wx' })
  return {
    fileName: String(file.filename || storedName).slice(0, 255),
    filePath: relativePath,
    mimeType,
    fileSize: (file.data as Buffer).length
  }
}

export async function removeStoredFile(filePath: string | null | undefined): Promise<void> {
  if (!filePath) return
  const root = resolve(uploadRoot())
  const target = resolve(root, filePath)
  if (target !== root && !target.startsWith(`${root}/`)) return
  await unlink(target).catch(() => undefined)
}

export function safeRelativePath(filePath: string): string {
  const root = resolve(uploadRoot())
  const target = resolve(root, filePath)
  const path = relative(root, target)
  if (!path || path.startsWith('..') || path.includes(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
    throw createError({ statusCode: 400, statusMessage: 'Ruta de documento inválida' })
  }
  return path
}
