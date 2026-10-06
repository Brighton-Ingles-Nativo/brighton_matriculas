import { getUserBySession } from '../../utils/auth'
import { assertContractAccess } from '../../utils/contract-access'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID de contrato requerido' })
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'ID de contrato inválido' })

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, username: true, email: true } },
      customer: true,
      students: { include: { student: true }, orderBy: { id: 'asc' } },
      otherData: true,
      strategyDefinition: { select: { id: true, code: true, name: true } },
      cancellationRequest: {
        include: {
          requestedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } }
        }
      },
      receipts: {
        orderBy: { registeredAt: 'desc' },
        select: {
          id: true,
          registeredRole: true,
          amount: true,
          concepts: true,
          otherConcept: true,
          paymentMethod: true,
          operationNumber: true,
          bank: true,
          transactionDate: true,
          registeredAt: true
        }
      }
    }
  })

  if (!contract) throw createError({ statusCode: 404, statusMessage: 'Contrato no encontrado' })
  await assertContractAccess(user, contract.id)

  const { accessToken: _accessToken, ...safeContract } = contract
  const students = contract.students.map(({ student }) => ({
    id: student.id,
    name: student.name,
    birthDate: student.birthDate,
    dni: student.dni,
    email: student.email,
    phone: student.phone
  }))
  const otherData = contract.otherData

  return {
    success: true,
    data: {
      ...safeContract,
      advisor: contract.user,
      holderName: contract.customer.name,
      holderBirthDate: contract.customer.birthDate,
      holderDni: contract.customer.dni,
      holderEmail: contract.customer.email,
      holderAddress: contract.customer.address,
      holderDepartment: contract.customer.department,
      holderProvince: contract.customer.province,
      holderDistrict: contract.customer.district,
      holderPhone: contract.customer.phone,
      students,
      beneficiary1Name: students[0]?.name ?? null,
      beneficiary1BirthDate: students[0]?.birthDate ?? null,
      beneficiary1Dni: students[0]?.dni ?? null,
      beneficiary1Email: students[0]?.email ?? null,
      beneficiary1Phone: students[0]?.phone ?? null,
      beneficiary2Name: students[1]?.name ?? null,
      beneficiary2BirthDate: students[1]?.birthDate ?? null,
      beneficiary2Dni: students[1]?.dni ?? null,
      beneficiary2Email: students[1]?.email ?? null,
      beneficiary2Phone: students[1]?.phone ?? null,
      currentSituation: otherData?.currentSituation ?? '—',
      housingType: otherData?.housingType ?? '—',
      notes: otherData?.notes ?? null,
      dataAuthorization: otherData?.dataAuthorization ?? false,
      testimonials: otherData?.testimonials ?? false,
      dataUsage: otherData?.dataUsage ?? null,
      strategyId: contract.strategyId,
      strategyNameSnapshot: contract.strategyNameSnapshot,
      strategy: contract.strategyNameSnapshot ?? contract.strategyDefinition?.name ?? otherData?.strategy ?? '—',
      programValue: contract.programValue.toString(),
      initialPayment: contract.initialPayment?.toString() ?? null,
      balance: contract.balance?.toString() ?? null,
      installmentValue: contract.installmentValue?.toString() ?? null,
      receipts: contract.receipts.map((receipt) => ({
        ...receipt,
        amount: receipt.amount?.toString() ?? null
      }))
    }
  }
})
