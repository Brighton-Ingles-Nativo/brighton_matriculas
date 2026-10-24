export const MATRICULA_FINANCED_INSTALLMENT_OPTIONS = [3, 7, 14] as const
export const MATRICULA_PROGRAM = 'Brighton' as const

const planPrices = {
  Virtual: {
    Light: {
      contado: 5600,
      financiado: { 3: 6150, 7: 6720, 14: 7700 },
    },
    Elite: {
      contado: 6600,
      financiado: { 3: 7200, 7: 7700, 14: 8680 },
    },
    Premium: {
      contado: 7600,
      financiado: { 3: 8100, 7: 8750, 14: 9660 },
    },
  },
  Presencial: {
    Light: {
      contado: 5900,
      financiado: { 3: 6450, 7: 7000, 14: 7980 },
    },
    Elite: {
      contado: 6900,
      financiado: { 3: 7500, 7: 8050, 14: 8960 },
    },
    Premium: {
      contado: 7900,
      financiado: { 3: 8400, 7: 9030, 14: 9940 },
    },
  },
} as const

export function isPlanBasedMatriculaProgram(program: string): boolean {
  return program === MATRICULA_PROGRAM
}

export function getMatriculaProgramPrice(
  program: string,
  plan: string,
  modality: string,
  paymentMode: string,
  installmentCount: string | number,
): string | null {
  if (!isPlanBasedMatriculaProgram(program)) return null
  if (paymentMode !== 'contado' && paymentMode !== 'financiado') return null
  if (!['Virtual', 'Presencial', 'Híbrido'].includes(modality)) return ''

  const modalityPrices = modality === 'Virtual' ? planPrices.Virtual : planPrices.Presencial
  if (!Object.hasOwn(modalityPrices, plan)) return ''

  const planPrice = modalityPrices[plan as keyof typeof modalityPrices]
  if (paymentMode === 'contado') return planPrice.contado.toFixed(2)

  const count = Number(installmentCount)
  const financedPrice = planPrice.financiado[count as keyof typeof planPrice.financiado]
  return financedPrice === undefined ? '' : financedPrice.toFixed(2)
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
