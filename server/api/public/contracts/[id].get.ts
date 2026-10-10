import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'

function tokenIsValid(token: unknown): token is string {
  return typeof token === 'string' && /^[0-9a-f]{64}$/i.test(token)
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getQuery(event).token
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !tokenIsValid(token)) {
    throw createError({ statusCode: 400, statusMessage: 'Enlace público inválido' })
  }

  const contract = await prisma.contract.findFirst({
    where: { id, accessToken: token, tokenExpiresAt: { gt: new Date() } },
    include: {
      customer: true,
      students: { include: { student: true }, orderBy: { id: 'asc' } },
      otherData: true,
      receipts: {
        orderBy: { registeredAt: 'desc' },
        select: { id: true, amount: true, concepts: true, otherConcept: true, paymentMethod: true, operationNumber: true, bank: true, transactionDate: true, registeredAt: true }
      }
    }
  })

  if (!contract) throw createError({ statusCode: 404, statusMessage: 'El enlace ha expirado o no es válido' })

  const { accessToken: _accessToken, ...safeContract } = contract
  const students = contract.students.map(({ student }) => student)

  return {
    success: true,
    data: {
      ...safeContract,
      holderName: contract.customer.name,
      holderBirthDate: contract.customer.birthDate,
      holderDni: contract.customer.dni,
      holderEmail: contract.customer.email,
      holderPhone: contract.customer.phone,
      holderAddress: contract.customer.address,
      holderDepartment: contract.customer.department,
      holderProvince: contract.customer.province,
      holderDistrict: contract.customer.district,
      students,
      currentSituation: contract.otherData?.currentSituation ?? '—',
      housingType: contract.otherData?.housingType ?? '—',
      strategy: contract.otherData?.strategy ?? '—',
      notes: contract.otherData?.notes ?? null,
      dataAuthorization: contract.otherData?.dataAuthorization ?? false,
      testimonials: contract.otherData?.testimonials ?? false,
      dataUsage: contract.otherData?.dataUsage ?? null,
      programValue: contract.programValue.toString(),
      initialPayment: contract.initialPayment?.toString() ?? null,
      balance: contract.balance?.toString() ?? null,
      installmentValue: contract.installmentValue?.toString() ?? null,
      receipts: contract.receipts.map((receipt) => ({ ...receipt, amount: receipt.amount?.toString() ?? null }))
    }
  }
})
