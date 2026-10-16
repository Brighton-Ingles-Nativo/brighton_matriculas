<script setup lang="ts">
import { BadgeCheck, Download, Printer } from '@lucide/vue'

definePageMeta({ middleware: 'auth', layout: false, ssr: false })

interface ContractPrint {
  id: string
  contractNumber: string
  registeredAt: string
  contractDepartment: string | null
  contractProvince: string | null
  contractDistrict: string | null
  holderName: string
  holderDni: string
  holderBirthDate: string
  holderEmail: string
  holderAddress: string
  holderDepartment: string | null
  holderProvince: string | null
  holderDistrict: string | null
  holderPhone: string
  students: Array<{ name: string; birthDate: string | null; dni: string | null; email: string | null; phone: string | null }>
  currentSituation: string
  housingType: string
  dataAuthorization: boolean
  strategy: string
  program: string
  plan: string | null
  modality: string | null
  paymentStartDate: string | null
  cashPayment: boolean
  financedPayment: boolean
  programValue: string
  initialPayment: string | null
  balance: string | null
  installmentCount: number | null
  installmentValue: string | null
  otherPayment: string | null
  notes: string | null
  testimonials: boolean
  dataUsage: boolean | null
  status: 'REVISION' | 'APROBADO' | 'ANULADO'
  signedAccept: boolean
  signedAt: string | null
  signedIp: string | null
  advisor: { name: string; username: string }
}

const route = useRoute()
const contract = ref<ContractPrint | null>(null)
const termsHtml = ref('')
const loading = ref(true)
const error = ref('')

const display = (value: unknown) => value === null || value === undefined || value === '' ? '—' : String(value)
const formatDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(value)) : '—'
const formatDateTime = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
const money = (value: string | null | undefined) => value ? new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value)) : '—'
const location = (district: string | null, province: string | null, department: string | null) => [district, province, department].filter(Boolean).join(', ') || '—'
const print = () => window.print()
const action = computed(() => route.query.accion === 'imprimir' ? 'imprimir' : 'descargar')
useHead(() => ({ title: contract.value ? `Contrato_${contract.value.contractNumber}` : 'Contrato' }))

onMounted(async () => {
  try {
    const id = String(route.params.id)
    const [contractResponse, termsResponse] = await Promise.all([
      $fetch<{ data: ContractPrint }>(`/api/contracts/${id}`),
      $fetch<{ html: string }>('/api/contracts/terms'),
    ])
    contract.value = contractResponse.data
    termsHtml.value = termsResponse.html
    await nextTick()
    if (document.fonts?.ready) await document.fonts.ready
    await Promise.all(Array.from(document.images, image => image.decode().catch(() => undefined)))
    if (action.value === 'imprimir') {
      window.setTimeout(() => window.print(), 250)
      window.addEventListener('afterprint', () => {
        if (route.query.incrustado === '1') window.parent.postMessage({ type: 'contract-print-complete', contractId: contract.value?.id }, window.location.origin)
      }, { once: true })
    }
  } catch (err: any) {
    error.value = err?.data?.message || err?.data?.statusMessage || 'No se pudo preparar el contrato para imprimir.'
    if (route.query.incrustado === '1') window.parent.postMessage({ type: 'contract-print-error', contractId: route.params.id, message: error.value }, window.location.origin)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="print-page">
    <header class="legacy-header"><strong>BRIGHTON INGLÉS NATIVO S.A.C.</strong></header>
    <div class="toolbar no-print">
      <p>{{ action === 'descargar' ? 'Elige “Guardar como PDF” en el diálogo para descargar el documento.' : 'Se abrirá el diálogo de impresión.' }}</p>
      <button type="button" @click="print"><Download v-if="action === 'descargar'" :size="16" /><Printer v-else :size="16" /> {{ action === 'descargar' ? 'Guardar como PDF' : 'Imprimir contrato' }}</button>
    </div>

    <p v-if="loading" class="message">Preparando el contrato…</p>
    <p v-else-if="error" class="message error">{{ error }}</p>

    <article v-else-if="contract" class="document">
      <section class="contract-meta">
        <div><label>Nro. Contrato</label><strong>{{ contract.contractNumber }}</strong></div>
        <div><label>Fecha de registro</label><strong>{{ formatDateTime(contract.registeredAt) }}</strong></div>
        <div><label>Lugar de suscripción</label><strong>{{ location(contract.contractDistrict, contract.contractProvince, contract.contractDepartment) }}</strong></div>
      </section>

      <section class="section">
        <h2>Datos del titular</h2>
        <div class="data-grid">
          <div class="span-4"><label>Nombre completo</label><strong>{{ contract.holderName }}</strong></div>
          <div class="span-2"><label>DNI / CE</label><strong>{{ contract.holderDni }}</strong></div>
          <div class="span-2"><label>Fecha de nacimiento</label><strong>{{ formatDate(contract.holderBirthDate) }}</strong></div>
          <div class="span-2"><label>Estrategia</label><strong>{{ display(contract.strategy) }}</strong></div>
          <div class="span-3"><label>Situación laboral</label><strong>{{ display(contract.currentSituation) }}</strong></div>
          <div class="span-3"><label>Tipo de vivienda</label><strong>{{ display(contract.housingType) }}</strong></div>
          <div class="span-3"><label>Correo</label><strong>{{ display(contract.holderEmail) }}</strong></div>
          <div class="span-3"><label>Celular</label><strong>{{ display(contract.holderPhone) }}</strong></div>
          <div class="span-6"><label>Dirección</label><strong>{{ display(contract.holderAddress) }}</strong></div>
          <div class="span-6"><label>Residencia</label><strong>{{ location(contract.holderDistrict, contract.holderProvince, contract.holderDepartment) }}</strong></div>
        </div>
      </section>

      <section v-for="(student, index) in contract.students" :key="`${student.dni}-${index}`" class="section">
        <h2>Beneficiario {{ index + 1 }}</h2>
        <div class="data-grid">
          <div class="span-4"><label>Nombre completo</label><strong>{{ student.name }}</strong></div>
          <div class="span-2"><label>Fecha de nacimiento</label><strong>{{ formatDate(student.birthDate) }}</strong></div>
          <div class="span-2"><label>DNI / CE</label><strong>{{ display(student.dni) }}</strong></div>
          <div class="span-2"><label>Correo</label><strong>{{ display(student.email) }}</strong></div>
          <div class="span-2"><label>Celular</label><strong>{{ display(student.phone) }}</strong></div>
        </div>
      </section>

      <section class="section">
        <h2>Información del programa</h2>
        <div class="data-grid">
          <div class="span-3"><label>Modalidad</label><strong>{{ display(contract.modality) }}</strong></div>
          <div class="span-3"><label>Programa</label><strong>{{ contract.program }}</strong></div>
          <div v-if="contract.plan" class="span-3"><label>Plan</label><strong>{{ contract.plan }}</strong></div>
          <div class="span-3"><label>Modalidad de pago</label><strong>{{ contract.cashPayment ? 'CONTADO' : contract.financedPayment ? 'FINANCIADO' : '—' }}</strong></div>
          <div class="span-3"><label>Fecha de inicio de pago</label><strong>{{ display(contract.paymentStartDate) }}</strong></div>
        </div>
      </section>

      <section class="section">
        <h2>Detalles económicos</h2>
        <div class="data-grid">
          <div class="span-3"><label>Valor del programa</label><strong>{{ money(contract.programValue) }}</strong></div>
          <template v-if="contract.cashPayment">
            <div v-if="contract.otherPayment" class="span-3"><label>Descuento</label><strong>{{ money(contract.otherPayment) }}</strong></div>
            <div class="span-3"><label>Cuota inicial (pago total)</label><strong>{{ money(contract.initialPayment) }}</strong></div>
          </template>
          <template v-else>
            <div v-if="contract.initialPayment" class="span-3"><label>Cuota inicial</label><strong>{{ money(contract.initialPayment) }}</strong></div>
            <div v-if="contract.balance" class="span-2"><label>Saldo</label><strong>{{ money(contract.balance) }}</strong></div>
            <div v-if="contract.installmentCount" class="span-2"><label>Nro. cuotas</label><strong>{{ contract.installmentCount }}</strong></div>
            <div v-if="contract.installmentValue" class="span-2"><label>Valor de cuota</label><strong>{{ money(contract.installmentValue) }}</strong></div>
            <div v-if="contract.otherPayment" class="span-3"><label>Descuento</label><strong>{{ money(contract.otherPayment) }}</strong></div>
            <div v-if="contract.notes" class="span-12"><label>Observaciones</label><strong>{{ contract.notes }}</strong></div>
          </template>
        </div>
      </section>

      <section class="section">
        <h2>Autorizaciones</h2>
        <div class="data-grid">
          <div class="span-4"><label>Uso de datos personales</label><strong>{{ contract.dataAuthorization ? 'AUTORIZADO' : 'NO AUTORIZADO' }}</strong></div>
          <div class="span-4"><label>Testimonios grabados</label><strong>{{ contract.testimonials ? 'AUTORIZADO' : 'NO AUTORIZADO' }}</strong></div>
          <div class="span-4"><label>Uso de imagen y datos en campañas</label><strong>{{ contract.dataUsage === null ? '—' : contract.dataUsage ? 'AUTORIZADO' : 'NO AUTORIZADO' }}</strong></div>
        </div>
      </section>

      <section class="terms section">
        <h2>Términos y condiciones del servicio</h2>
        <div class="text-xs leading-relaxed" v-html="termsHtml" />
        <div v-if="contract.signedAccept || contract.signedAt" class="relative mt-4 mb-2 grid grid-cols-[minmax(0,1fr)_minmax(180px,260px)] items-center gap-3 rounded-md border-2 border-emerald-200 bg-white p-4 text-green-800 print:break-inside-avoid before:absolute before:inset-[5px_-6px_-6px_5px] before:-z-10 before:bg-gray-100 before:content-['']" role="status">
          <div class="flex items-center gap-3">
            <BadgeCheck class="size-8 shrink-0 fill-emerald-900 text-white" aria-hidden="true" />
            <div class="min-w-0 text-emerald-950">
              <strong class="mb-1 block text-lg font-semibold leading-tight">Contrato Aceptado Digitalmente</strong>
              <p class="text-justify text-[10px] leading-relaxed">Este documento fue validado el {{ formatDateTime(contract.signedAt) }}.</p>
              <p class="mt-1 text-[10px] leading-relaxed text-slate-500">Registro de Seguridad (IP): {{ display(contract.signedIp) }}</p>
            </div>
          </div>
          <div class="flex justify-center"><img class="w-full max-w-[260px] rotate-[9.75deg]" src="/assets/images/firma_gerencia-brighton.jpg" alt="Firma de gerencia Brighton"></div>
        </div>
      </section>

      <footer class="document-footer">Asesor: {{ contract.advisor.name }} <!--· Estado: {{ contract.status }} --></footer>
    </article>
  </main>
</template>

<style>
@page { size: A4; margin: 14mm 12mm; }
* { box-sizing: border-box; }
body { margin: 0; background: #f3f4f6; color: #212529; font-family: Arial, Helvetica, sans-serif; font-size: 11px; }
.print-page { padding: 24px; }
.legacy-header { margin: -24px -24px 20px; background: #004aad; padding: 16px 28px; color: white; font-size: 16px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 0 auto 20px; max-width: 900px; color: #475569; font-size: 14px; }
.toolbar p { margin: 0; }
.toolbar button { display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 6px; background: #204bb3; padding: 10px 14px; color: white; font: inherit; cursor: pointer; }
.message { margin: 48px auto; max-width: 900px; font-size: 15px; }
.error { color: #b4232f; }
.document { max-width: 900px; margin: 0 auto; border-radius: 8px; background: white; padding: 32px; box-shadow: 0 2px 8px #0f172a20; }
.contract-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 18px; border-radius: 5px; background: #f1f3f5; padding: 12px; }
.contract-meta div, .data-grid > div { min-width: 0; }
label { display: block; margin-bottom: 3px; color: #6c757d; font-size: 9px; font-weight: 700; text-transform: uppercase; }
.contract-meta strong, .data-grid strong { display: block; overflow-wrap: anywhere; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; font-size: 11px; font-weight: 500; }
.contract-meta strong { color: #004aad; font-weight: 700; }
.section { margin-top: 16px; break-inside: avoid; }
.section h2 { margin: 0 0 9px; border-left: 4px solid #004aad; background: #e9ecef; padding: 7px 10px; color: #004aad; font-size: 10px; text-transform: uppercase; }
.data-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 9px 12px; }
.span-2 { grid-column: span 2; }.span-3 { grid-column: span 3; }.span-4 { grid-column: span 4; }.span-6 { grid-column: span 6; }.span-12 { grid-column: span 12; }
.terms h2 { margin-bottom: 14px; }
.document-footer { margin-top: 22px; border-top: 1px solid #d1d5db; padding-top: 8px; color: #6c757d; font-size: 9px; }
@media print {
  body { background: white; font-size: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-page { padding: 0; }
  .document { max-width: none; margin: 0; border-radius: 0; padding: 0; box-shadow: none; }
  .legacy-header { margin: 0 0 16px; padding: 12px; }
  .no-print { display: none !important; }
  .section { break-inside: avoid; }
  .terms { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
