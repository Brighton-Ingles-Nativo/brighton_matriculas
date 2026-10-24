export const MATRICULA_INSTALLMENT_OPTIONS = Array.from({ length: 13 }, (_, index) => index + 2)

const standardLevelPrices = {
  Virtual: { 
    Light: 2250, 
    Elite: 2520, 
    Premium: 2700 },
  Presencial: { 
    Light: 2500, 
    Elite: 2800, 
    Premium: 3000 },
}

const matriculaPrices = {
  'Paquete Integral': {
    Virtual: { 
      Light: 5310, 
      Elite: 6210, 
      Premium: 7110 
    },
    Presencial: { 
      Light: 5900, 
      Elite: 6900, 
      Premium: 7900 
    },
  },
  'Nivel Básico': standardLevelPrices,
  'Nivel Intermedio': standardLevelPrices,
  'Nivel Avanzado': standardLevelPrices,
} as const

type MatriculaProgram = keyof typeof matriculaPrices | 'Kids'
type MatriculaPlan = 'Light' | 'Elite' | 'Premium' | ''

export function getMatriculaProgramPrice(
  program: string,
  plan: string,
  modality: string,
): string | null {
  if (program === 'Kids') return '5900.00'

  if (!Object.hasOwn(matriculaPrices, program)) return null

  const programPrices = matriculaPrices[program as Exclude<MatriculaProgram, 'Kids'>]
  const modalityPrices = modality === 'Virtual' ? programPrices.Virtual : programPrices.Presencial
  const price = modalityPrices[plan as MatriculaPlan]

  return price === undefined ? '' : String(price)
}

type EnrollmentAmountsInput = {
  paymentMode: string
  programValue: string | number
  initialPayment: string | number
  installmentCount: string | number
  otherPayment?: string | number
  applyCashDiscountToInitial?: boolean
  treatUnknownPaymentModeAsFinanced?: boolean
}

export type EnrollmentAmounts = {
  initialPayment: string
  balance: string
  installmentCount: string
  installmentValue: string
}

const numericValue = (value: string | number | undefined) => Number(value) || 0

export function calculateMatriculaAmounts(input: EnrollmentAmountsInput): EnrollmentAmounts | null {
  const programValue = numericValue(input.programValue)
  const initialPayment = numericValue(input.initialPayment)
  const initialPaymentValue = String(input.initialPayment ?? '')

  if (input.paymentMode === 'contado') {
    const discount = numericValue(input.otherPayment)
    return {
      initialPayment: input.applyCashDiscountToInitial
        ? Math.max(programValue - discount, 0).toFixed(2)
        : initialPaymentValue,
      balance: '0.00',
      installmentCount: '0',
      installmentValue: '0.00',
    }
  }

  if (input.paymentMode === 'financiado' || input.treatUnknownPaymentModeAsFinanced) {
    const balance = Math.max(programValue - initialPayment, 0)
    const installmentCount = numericValue(input.installmentCount)

    return {
      initialPayment: initialPaymentValue,
      balance: balance.toFixed(2),
      installmentCount: String(input.installmentCount ?? '0'),
      installmentValue: installmentCount > 0 ? (balance / installmentCount).toFixed(2) : '0.00',
    }
  }

  return null
}
