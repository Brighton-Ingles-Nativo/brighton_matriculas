import { assertCsrf, getUserBySession } from '../../../utils/auth'
import { assertContractAccess } from '../../../utils/contract-access'
import { prisma } from '../../../utils/prisma'
import { sendEmail } from '../../../utils/mailer'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, message: 'Sesión no válida' })

  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, message: 'ID de matrícula inválido' })

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: {
      id: true,
      contractNumber: true,
      accessToken: true,
      tokenExpiresAt: true,
      customer: { select: { name: true, email: true, phone: true } },
    }
  })
  if (!contract) throw createError({ statusCode: 404, message: 'Matrícula no encontrada' })
  await assertContractAccess(user, id)

  if (!contract.customer.email) throw createError({ statusCode: 400, message: 'La matrícula no tiene un correo de cliente registrado.' })
  if (!contract.accessToken || !contract.tokenExpiresAt || contract.tokenExpiresAt <= new Date()) {
    throw createError({ statusCode: 409, message: 'El enlace público ha expirado. Regenera el enlace antes de enviarlo.' })
  }

  const config = useRuntimeConfig()
  const baseUrl = String(config.public.siteUrl || '').replace(/\/$/, '') || getRequestURL(event).origin
  const publicUrl = `${baseUrl}/contrato/publico?id=${id}&token=${contract.accessToken}`
  const text = `Hola ${contract.customer.name},

Tu matrícula con Brighton Inglés Nativo está lista para ser visualizada y descargada.

Matrícula: ${contract.contractNumber}

Puedes revisar la información completa desde el siguiente enlace:
${publicUrl}

Este enlace es personal y estará disponible durante 5 días.

Saludos,
Brighton Inglés Nativo`

  await sendEmail({
    to: contract.customer.email,
    subject: `Tu matrícula Brighton - ${contract.contractNumber}`,
    text,
    name: contract.customer.name,
    email: contract.customer.email,
    phone: contract.customer.phone || '',
  })

  return { success: true, message: 'Correo enviado correctamente' }
})
