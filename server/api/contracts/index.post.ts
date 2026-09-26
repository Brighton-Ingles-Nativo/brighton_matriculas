import { randomBytes } from 'node:crypto'
import { assertCsrf, getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

type ContractPayload = {
  contractDepartment?: string
  contractProvince?: string
  contractDistrict?: string
  holderName?: string
  holderBirthDate?: string
  holderDni?: string
  holderEmail?: string
  holderAddress?: string
  holderDepartment?: string
  holderProvince?: string
  holderDistrict?: string
  holderPhone?: string
  beneficiary1Name?: string
  beneficiary1BirthDate?: string
  beneficiary1Dni?: string
  beneficiary1Email?: string
  beneficiary1Phone?: string
  beneficiary2Name?: string
  beneficiary2BirthDate?: string
  beneficiary2Dni?: string
  beneficiary2Email?: string
  beneficiary2Phone?: string
  currentSituation?: string
  housingType?: string
  strategy?: string
  paymentStartDate?: string
  modality?: string
  program?: string
  plan?: string
  paymentMode?: 'contado' | 'financiado'
  programValue?: string
  initialPayment?: string
  balance?: string
  installmentCount?: string
  installmentValue?: string
  otherPayment?: string
  notes?: string
  dataAuthorization?: boolean
  testimonials?: boolean
  dataUsage?: boolean
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const optionalText = (value: unknown) => text(value) || null
const money = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
const optionalDate = (value: unknown) => {
  const raw = text(value)
  if (!raw) return null
  const date = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

async function nextContractNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `${year}-`
  const last = await prisma.contract.findFirst({
    where: { contractNumber: { startsWith: prefix } },
    orderBy: { contractNumber: 'desc' },
    select: { contractNumber: true }
  })
  const current = last ? Number(last.contractNumber.split('-')[1]) || 1549 : 1549
  return `${year}-${String(current + 1).padStart(5, '0')}`
}

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  const body = await readBody<ContractPayload>(event)
  const required: Array<[string, unknown]> = [
    ['departamento de contrato', body.contractDepartment],
    ['provincia de contrato', body.contractProvince],
    ['equipo comercial', body.contractDistrict],
    ['nombre del titular', body.holderName],
    ['DNI del titular', body.holderDni],
    ['fecha de nacimiento del titular', body.holderBirthDate],
    ['correo del titular', body.holderEmail],
    ['dirección del titular', body.holderAddress],
    ['celular del titular', body.holderPhone],
    ['departamento de residencia', body.holderDepartment],
    ['provincia de residencia', body.holderProvince],
    ['distrito de residencia', body.holderDistrict],
    ['estrategia', body.strategy],
    ['modalidad', body.modality],
    ['programa', body.program],
    ['modalidad de pago', body.paymentMode],
    ['valor del programa', body.programValue]
  ]
  const missing = required.find(([, value]) => !text(value))
  if (missing) throw createError({ statusCode: 400, statusMessage: `El campo ${missing[0]} es obligatorio.` })
  if (!body.dataAuthorization) throw createError({ statusCode: 400, statusMessage: 'La autorización de datos personales es obligatoria.' })
  if (text(body.program) !== 'Kids' && !text(body.plan)) throw createError({ statusCode: 400, statusMessage: 'El plan es obligatorio para este programa.' })

  const programValue = money(body.programValue, -1)
  if (programValue < 0) throw createError({ statusCode: 400, statusMessage: 'El valor del programa no es válido.' })
  const contractNumber = await nextContractNumber()
  const paymentMode = body.paymentMode
  const token = randomBytes(32).toString('hex')

  try {
    const contract = await prisma.contract.create({
      data: {
        userId: user.id,
        registeredAt: new Date(),
        contractDepartment: text(body.contractDepartment),
        contractProvince: text(body.contractProvince),
        contractDistrict: text(body.contractDistrict),
        contractNumber,
        holderName: text(body.holderName),
        holderBirthDate: optionalDate(body.holderBirthDate)!,
        holderDni: text(body.holderDni),
        holderEmail: text(body.holderEmail),
        holderAddress: text(body.holderAddress),
        holderDepartment: optionalText(body.holderDepartment),
        holderProvince: optionalText(body.holderProvince),
        holderDistrict: optionalText(body.holderDistrict),
        holderPhone: text(body.holderPhone),
        beneficiary1Name: optionalText(body.beneficiary1Name),
        beneficiary1BirthDate: optionalDate(body.beneficiary1BirthDate),
        beneficiary1Dni: optionalText(body.beneficiary1Dni),
        beneficiary1Email: optionalText(body.beneficiary1Email),
        beneficiary1Phone: optionalText(body.beneficiary1Phone),
        beneficiary2Name: optionalText(body.beneficiary2Name),
        beneficiary2BirthDate: optionalDate(body.beneficiary2BirthDate),
        beneficiary2Dni: optionalText(body.beneficiary2Dni),
        beneficiary2Email: optionalText(body.beneficiary2Email),
        beneficiary2Phone: optionalText(body.beneficiary2Phone),
        currentSituation: text(body.currentSituation) || 'Empleado',
        housingType: text(body.housingType) || 'Propia',
        dataAuthorization: Boolean(body.dataAuthorization),
        strategy: text(body.strategy),
        paymentStartDate: optionalText(body.paymentStartDate),
        modality: text(body.modality),
        program: text(body.program),
        plan: text(body.program) === 'Kids' ? null : optionalText(body.plan),
        cashPayment: paymentMode === 'contado',
        financedPayment: paymentMode === 'financiado',
        programValue,
        initialPayment: money(body.initialPayment),
        balance: money(body.balance),
        installmentCount: Math.max(0, Math.trunc(Number(body.installmentCount) || 0)),
        installmentValue: money(body.installmentValue),
        otherPayment: optionalText(body.otherPayment),
        notes: optionalText(body.notes),
        status: '0',
        testimonials: Boolean(body.testimonials),
        dataUsage: Boolean(body.dataUsage),
        accessToken: token,
        tokenExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      },
      select: { id: true, contractNumber: true }
    })

    return { success: true, data: contract }
  } catch (error: any) {
    if (error?.code === 'P2002') throw createError({ statusCode: 409, statusMessage: 'El número de matrícula ya existe. Intenta nuevamente.' })
    console.error('Error creando matrícula:', error)
    throw createError({ statusCode: 500, statusMessage: 'No se pudo registrar la matrícula.' })
  }
})
