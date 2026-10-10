<script setup lang="ts">
import { ArrowLeft, Check, CheckCircle2, Copy, ExternalLink, FileDown, Mail } from '@lucide/vue'

interface Receipt {
  id: string
  registeredRole: string | null
  amount: string | null
  concepts: string | null
  otherConcept: string | null
  paymentMethod: string | null
  operationNumber: string | null
  bank: string | null
  transactionDate: string | null
  registeredAt: string
}

interface Contract {
  id: string
  contractNumber: string
  holderName: string
  holderDni: string
  holderBirthDate: string
  holderEmail: string
  holderAddress: string
  holderDepartment: string | null
  holderProvince: string | null
  holderDistrict: string | null
  holderPhone: string
  contractDepartment: string | null
  contractProvince: string | null
  contractDistrict: string | null
  registeredAt: string
  updatedAt: string
  strategy: string
  currentSituation: string
  housingType: string
  modality: string | null
  program: string
  plan: string | null
  cashPayment: boolean
  financedPayment: boolean
  paymentStartDate: string | null
  programValue: string
  initialPayment: string | null
  balance: string | null
  installmentCount: number | null
  installmentValue: string | null
  otherPayment: string | null
  notes: string | null
  dataAuthorization: boolean
  testimonials: boolean
  dataUsage: boolean | null
  status: 'REVISION' | 'FIRMADO' | 'ANULADO'
  signedAt: string | null
  signedIp: string | null
  advisor: { name: string; username: string }
  receipts: Receipt[]
  students?: Array<{ id?: string; name: string; birthDate: string | null; dni: string | null; email: string | null; phone: string | null }>
}

const props = defineProps<{
  open: boolean
  contract: Contract | null
  loading?: boolean
  error?: string
  actionLoading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  accept: []
  publicView: []
  pdf: []
}>()

const termsHtml = ref('')
const termsContainer = ref<HTMLElement | null>(null)
const termsLoading = ref(false)
const termsError = ref(false)
const termsRead = ref(false)
const acceptedChecked = ref(false)
const sendPreviewOpen = ref(false)
const sendLoading = ref(false)
const sendError = ref('')
const copyError = ref('')
const publicUrl = ref('')
const copiedTarget = ref<'message' | 'link' | null>(null)

const statusLabel = computed(() => {
  if (!props.contract) return '—'
  if (props.contract.status === 'ANULADO') return 'Anulado'
  if (props.contract.status === 'FIRMADO' || props.contract.signedAt) return 'Firmado'
  return 'Listo para firma'
})

const statusVariant = computed<'default' | 'outline' | 'destructive'>(() => {
  if (!props.contract) return 'outline'
  if (props.contract.status === 'ANULADO') return 'destructive'
  return props.contract.status === 'FIRMADO' || props.contract.signedAt ? 'default' : 'outline'
})

const termsAvailable = computed(() => Boolean(props.contract && (props.contract.status === 'REVISION' || props.contract.signedAt)))
const canAccept = computed(() => Boolean(props.contract && props.contract.status === 'REVISION' && !props.contract.signedAt && termsHtml.value && !termsError.value))

const formatDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(value)) : '—'
const formatDateTime = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const formatCurrency = (value: string | null | undefined) => value ? new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value)) : '—'
const display = (value: string | number | null | undefined) => value === null || value === undefined || value === '' ? '—' : value
const paymentMode = (contract: Contract) => contract.cashPayment ? 'CONTADO' : contract.financedPayment ? 'FINANCIADO' : '—'
const emailSubject = computed(() => props.contract ? `Tu matrícula Brighton - ${props.contract.contractNumber}` : '')
const emailMessage = computed(() => {
  if (!props.contract) return ''
  return `Hola ${props.contract.holderName},

Tu matrícula con Brighton Inglés Nativo está lista para ser visualizada y descargada.

Matrícula: ${props.contract.contractNumber}

Puedes revisar la información completa desde el siguiente enlace:
${publicUrl.value}

Este enlace es personal y estará disponible durante 5 días.

Saludos,
Brighton Inglés Nativo`
})

const loadTerms = async () => {
  if (!termsAvailable.value || termsHtml.value) return
  termsLoading.value = true
  termsError.value = false
  try {
    const response = await $fetch<{ success: boolean; html: string }>('/api/contracts/terms')
    termsHtml.value = response.html
  } catch {
    termsError.value = true
  } finally {
    termsLoading.value = false
  }
}

const updateTermsRead = () => {
  const target = termsContainer.value
  if (!target) return
  termsRead.value = target.scrollHeight - target.scrollTop <= target.clientHeight + 8
}

const prepareSendPreview = async () => {
  if (!props.contract) return
  sendError.value = ''
  copyError.value = ''
  publicUrl.value = ''
  sendPreviewOpen.value = true
  sendLoading.value = true
  try {
    const response = await $fetch<{ success: boolean; url: string }>(`/api/contracts/${props.contract.id}/public-link`, { credentials: 'include' })
    publicUrl.value = response.url
  } catch (error: any) {
    sendError.value = error?.data?.statusMessage || 'No se pudo preparar el enlace público del contrato.'
  } finally {
    sendLoading.value = false
  }
}

const copyToClipboard = async (value: string, target: 'message' | 'link') => {
  try {
    await navigator.clipboard.writeText(value)
    copyError.value = ''
    copiedTarget.value = target
    window.setTimeout(() => {
      if (copiedTarget.value === target) copiedTarget.value = null
    }, 1800)
  } catch {
    copyError.value = 'No se pudo copiar el contenido. Copia el texto manualmente.'
  }
}

watch([() => props.open, termsHtml, termsLoading], async () => {
  await nextTick()
  updateTermsRead()
})

watch(() => props.open, (open) => {
  if (open) {
    termsRead.value = false
    acceptedChecked.value = false
    loadTerms()
  } else {
    sendPreviewOpen.value = false
  }
})

watch(() => props.contract?.id, () => {
  termsHtml.value = ''
  termsError.value = false
  termsRead.value = false
  acceptedChecked.value = false
  sendPreviewOpen.value = false
  publicUrl.value = ''
  sendError.value = ''
  loadTerms()
})
</script>

<template>
  <UiDialog :open="open" @update:open="emit('update:open', $event)">
    <UiDialogScrollContent :class="['flex min-w-0 flex-col max-h-[calc(100vh-4rem)] overflow-hidden p-0', sendPreviewOpen ? 'max-w-2xl' : 'max-w-6xl']">
      <div class="flex shrink-0 items-center justify-between border-b bg-background px-6 py-4 pr-25">
        <UiButton type="button" variant="ghost" size="sm" class="-ml-3 gap-2" @click="sendPreviewOpen = false"><ArrowLeft class="size-4" /> Regresar</UiButton>
        <div>
          <UiDialogTitle>{{ sendPreviewOpen ? 'Preparar envío del contrato' : contract ? `Contrato ${contract.contractNumber}` : 'Detalle del contrato' }}</UiDialogTitle>
          <UiDialogDescription>{{ sendPreviewOpen ? 'Revisa y copia el contenido para enviarlo manualmente al cliente.' : 'Detalle completo del registro, contrato y movimientos de pago.' }}</UiDialogDescription>
        </div>
        <div v-if="contract && !sendPreviewOpen" class="flex flex-wrap justify-end gap-2"><UiButton variant="outline" size="sm" class="gap-2" :disabled="sendLoading" @click="prepareSendPreview"><Mail class="size-4" /> {{ sendLoading ? 'Preparando…' : 'Enviar contrato' }}</UiButton><UiButton variant="outline" size="sm" class="gap-2" @click="emit('publicView')"><ExternalLink class="size-4" /> Vista pública</UiButton><UiButton variant="outline" size="sm" class="gap-2" @click="emit('pdf')"><FileDown class="size-4" /> Abrir PDF</UiButton></div>
      </div>

      <div v-if="sendPreviewOpen" class="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto p-6">

        <!-- <UiAlert class="border-amber-200 bg-amber-50 text-amber-950">
          <UiAlertDescription>Este botón no envía correos automáticamente. Copia el contenido y envíalo desde tu correo o medio habitual.</UiAlertDescription>
        </UiAlert> -->

        <div v-if="sendLoading" class="space-y-3 py-2">
          <UiSkeleton class="h-5 w-2/3" />
          <UiSkeleton class="h-10 w-full" />
          <UiSkeleton class="h-40 w-full" />
          <p class="text-sm text-muted-foreground">Preparando el enlace público del contrato…</p>
        </div>
        <UiAlert v-else-if="sendError" variant="destructive"><UiAlertDescription>{{ sendError }}</UiAlertDescription></UiAlert>
        <div v-else-if="contract" class="min-w-0 space-y-4">
          <div class="min-w-0 space-y-2">
            <UiLabel for="contract-email-recipient">Destinatario</UiLabel>
            <UiInput id="contract-email-recipient" :model-value="contract.holderEmail" readonly />
          </div>
          <div class="min-w-0 space-y-2">
            <UiLabel for="contract-email-subject">Asunto</UiLabel>
            <UiInput id="contract-email-subject" :model-value="emailSubject" readonly />
          </div>
          <div class="min-w-0 space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <UiLabel for="contract-email-message">Contenido del mensaje</UiLabel>
              <UiButton type="button" variant="outline" size="sm" class="gap-2" @click="copyToClipboard(emailMessage, 'message')"><Check v-if="copiedTarget === 'message'" class="size-4" /><Copy v-else class="size-4" />{{ copiedTarget === 'message' ? 'Copiado' : 'Copiar mensaje' }}</UiButton>
            </div>
            <UiTextarea id="contract-email-message" :model-value="emailMessage" readonly wrap="soft" rows="12" class="min-h-64 min-w-0 w-full max-w-full resize-y bg-muted/20 field-sizing-fixed" />
          </div>
          <div class="min-w-0 space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <UiLabel for="contract-public-link">Enlace público</UiLabel>
              <UiButton type="button" variant="outline" size="sm" class="gap-2" @click="copyToClipboard(publicUrl, 'link')"><Check v-if="copiedTarget === 'link'" class="size-4" /><Copy v-else class="size-4" />{{ copiedTarget === 'link' ? 'Copiado' : 'Copiar enlace' }}</UiButton>
            </div>
            <UiInput id="contract-public-link" :model-value="publicUrl" readonly class="font-mono text-xs" />
          </div>
          <UiAlert v-if="copyError" variant="destructive"><UiAlertDescription>{{ copyError }}</UiAlertDescription></UiAlert>
        </div>

      </div>

      <div v-else-if="loading" class="min-h-0 flex-1 space-y-4 overflow-y-auto p-6"><UiSkeleton v-for="item in 10" :key="item" class="h-12 w-full" /></div>
      <UiAlert v-else-if="error" variant="destructive" class="m-6"><UiAlertDescription>{{ error }}</UiAlertDescription></UiAlert>
      <div v-else-if="contract" class="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto bg-muted/20 p-6">
        <section class="rounded-lg border bg-card p-5 shadow-sm">
          <div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div class="flex items-center gap-4"><div class="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground"><CheckCircle2 class="size-6" /></div><div><h2 class="text-lg font-semibold">Contrato {{ contract.contractNumber }}</h2><p class="text-sm text-muted-foreground">{{ contract.signedAt ? `Firmado digitalmente el ${formatDateTime(contract.signedAt)}.` : 'Seguimiento del contrato registrado.' }}</p></div></div>
            <UiBadge :variant="statusVariant">{{ statusLabel }}</UiBadge>
          </div>
        </section>

        <section class="rounded-lg border bg-card p-5 shadow-sm">
          <div class="grid gap-4 rounded-md bg-muted/50 p-4 sm:grid-cols-3"><div><p class="label">Nro. contrato</p><p class="value text-primary">{{ contract.contractNumber }}</p></div><div><p class="label">Fecha registro</p><p class="value">{{ formatDateTime(contract.registeredAt) }}</p></div><div><p class="label">Lugar de suscripción</p><p class="value">{{ display(contract.contractDistrict) }}, {{ display(contract.contractProvince) }}, {{ display(contract.contractDepartment) }}</p></div></div>
          <h3 class="section-title">Datos del titular</h3>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div class="lg:col-span-2"><p class="label">Nombre completo</p><p class="value uppercase">{{ contract.holderName }}</p></div><div><p class="label">DNI / CE</p><p class="value">{{ contract.holderDni }}</p></div><div><p class="label">Fecha nacimiento</p><p class="value">{{ formatDate(contract.holderBirthDate) }}</p></div><div><p class="label">Estrategia</p><p class="value">{{ contract.strategy }}</p></div><div><p class="label">Situación laboral</p><p class="value">{{ contract.currentSituation }}</p></div><div><p class="label">Tipo vivienda</p><p class="value">{{ contract.housingType }}</p></div><div><p class="label">Email</p><p class="value break-all">{{ contract.holderEmail }}</p></div><div><p class="label">Celular</p><p class="value">{{ contract.holderPhone }}</p></div><div class="sm:col-span-2"><p class="label">Dirección</p><p class="value">{{ contract.holderAddress }}</p></div><div class="sm:col-span-2"><p class="label">Residencia</p><p class="value">{{ display(contract.holderDistrict) }}, {{ display(contract.holderProvince) }}, {{ display(contract.holderDepartment) }}</p></div></div>

          <template v-for="(student, index) in contract.students || []" :key="student.id || index"><h3 class="section-title">Beneficiario {{ index + 1 }}</h3><div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><div class="lg:col-span-2"><p class="label">Nombre completo</p><p class="value">{{ student.name }}</p></div><div><p class="label">Fecha nacimiento</p><p class="value">{{ formatDate(student.birthDate) }}</p></div><div><p class="label">DNI / CE</p><p class="value">{{ display(student.dni) }}</p></div><div><p class="label">Celular</p><p class="value">{{ display(student.phone) }}</p></div><div class="sm:col-span-2 lg:col-span-5"><p class="label">Email</p><p class="value">{{ display(student.email) }}</p></div></div></template>

          <h3 class="section-title">Información del programa</h3><div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><div><p class="label">Modalidad</p><p class="value">{{ display(contract.modality) }}</p></div><div><p class="label">Programa</p><p class="value font-semibold">{{ contract.program }}</p></div><div><p class="label">Plan</p><p class="value font-semibold">{{ display(contract.plan) }}</p></div><div><p class="label">Modalidad de pago</p><p class="value font-semibold">{{ paymentMode(contract) }}</p></div><div><p class="label">Fecha inicio pago</p><p class="value">{{ display(contract.paymentStartDate) }}</p></div></div>
          <h3 class="section-title">Detalles económicos</h3><div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><div><p class="label">Valor programa</p><p class="value font-semibold text-primary">{{ formatCurrency(contract.programValue) }}</p></div><div><p class="label">Cuota inicial{{ contract.cashPayment ? ' (pago total)' : '' }}</p><p class="value">{{ formatCurrency(contract.initialPayment) }}</p></div><div v-if="!contract.cashPayment"><p class="label">Saldo</p><p class="value">{{ formatCurrency(contract.balance) }}</p></div><div v-if="!contract.cashPayment"><p class="label">Nro. cuotas</p><p class="value">{{ display(contract.installmentCount) }}</p></div><div v-if="!contract.cashPayment"><p class="label">Valor cuota</p><p class="value">{{ formatCurrency(contract.installmentValue) }}</p></div><div><p class="label">Descuento / otro pago</p><p class="value text-emerald-700">{{ display(contract.otherPayment) }}</p></div><div v-if="contract.notes" class="sm:col-span-2 lg:col-span-5"><p class="label">Observaciones</p><p class="value whitespace-pre-line">{{ contract.notes }}</p></div></div>
          <h3 class="section-title">Autorizaciones</h3><div class="space-y-3"><div class="authorization"><span>Autorización y refrendación de uso de datos personales</span><UiBadge :variant="contract.dataAuthorization ? 'default' : 'secondary'">{{ contract.dataAuthorization ? '✓ AUTORIZADO' : '✗ NO AUTORIZADO' }}</UiBadge></div><div class="authorization"><span>Autorización para proporcionar testimonios grabados</span><UiBadge :variant="contract.testimonials ? 'default' : 'secondary'">{{ contract.testimonials ? '✓ AUTORIZADO' : '✗ NO AUTORIZADO' }}</UiBadge></div><div class="authorization"><span>Autorización para uso de imagen y datos en campañas publicitarias</span><UiBadge :variant="contract.dataUsage ? 'default' : 'secondary'">{{ contract.dataUsage ? '✓ AUTORIZADO' : '✗ NO AUTORIZADO' }}</UiBadge></div></div>
        </section>

        <section class="rounded-lg border bg-card p-5 shadow-sm"><div class="flex items-center justify-between"><h3 class="section-title m-0">Recibos</h3><UiBadge variant="secondary">{{ contract.receipts.length }}</UiBadge></div><div v-if="contract.receipts.length" class="mt-4 overflow-x-auto"><table class="w-full min-w-[680px] text-left text-sm"><thead><tr class="border-b text-xs uppercase text-muted-foreground"><th class="p-3">Concepto</th><th class="p-3">Importe</th><th class="p-3">Método</th><th class="p-3">Operación</th><th class="p-3">Fecha</th></tr></thead><tbody><tr v-for="receipt in contract.receipts" :key="receipt.id" class="border-b last:border-0"><td class="p-3">{{ receipt.concepts || 'Pago registrado' }}</td><td class="p-3 font-medium">{{ formatCurrency(receipt.amount) }}</td><td class="p-3">{{ display(receipt.paymentMethod) }}</td><td class="p-3">{{ display(receipt.operationNumber) }}</td><td class="p-3">{{ formatDate(receipt.transactionDate || receipt.registeredAt) }}</td></tr></tbody></table></div><p v-else class="mt-4 text-sm text-muted-foreground">No hay recibos registrados.</p></section>

        <section v-if="termsAvailable" class="rounded-lg border bg-card p-5 shadow-sm"><h3 class="section-title m-0">Términos y condiciones del servicio</h3><UiAlert v-if="termsError" variant="destructive"><UiAlertDescription>No se pudieron cargar los términos y condiciones.</UiAlertDescription></UiAlert><div v-else ref="termsContainer" class="terms-container mt-4" @scroll="updateTermsRead"><div v-if="termsLoading" class="space-y-3"><UiSkeleton class="h-6 w-3/4" /><UiSkeleton v-for="item in 8" :key="item" class="h-4 w-full" /></div><div v-else class="legacy-terms" v-html="termsHtml" /></div><div v-if="canAccept" class="mt-5 space-y-4"><label class="flex items-start gap-3 text-sm"><UiCheckbox v-model="acceptedChecked" :disabled="!termsRead" /><span>Declaro haber leído y acepto los Términos y Condiciones de Licencia de Uso de Curso Educativo y Compraventa de Libros de BRIGHTON INGLÉS NATIVO S.A.C.</span></label><UiButton :disabled="!termsRead || !acceptedChecked || actionLoading" class="gap-2" @click="emit('accept')"><CheckCircle2 class="size-4" /> Firmar y aceptar contrato</UiButton><p v-if="!termsRead" class="text-xs text-muted-foreground">Lee los términos hasta el final para habilitar la aceptación.</p></div><div v-else-if="contract.signedAt" class="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><p class="font-semibold">Contrato aceptado digitalmente</p><p>Validado el {{ formatDateTime(contract.signedAt) }}. IP: {{ display(contract.signedIp) }}</p></div></section><section v-else class="rounded-lg border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900">El contrato anulado no está disponible para firma.</section>

        <section class="rounded-lg border bg-card p-5 shadow-sm"><h3 class="section-title m-0">Ficha del registro</h3><dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt class="label">Asesor</dt><dd class="value">{{ contract.advisor.name }}</dd></div><div><dt class="label">Última actualización</dt><dd class="value">{{ formatDateTime(contract.updatedAt) }}</dd></div><div><dt class="label">Firma</dt><dd class="value">{{ contract.signedAt ? 'Sí' : 'No' }}</dd></div><div><dt class="label">Fecha de firma</dt><dd class="value">{{ formatDateTime(contract.signedAt) }}</dd></div></dl></section>
      </div>
    </UiDialogScrollContent>
  </UiDialog>
</template>

<style scoped>
.label { color: var(--muted-foreground); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.025em; text-transform: uppercase; }
.value { min-height: 1.5rem; margin-top: 0.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.25rem; font-size: 0.875rem; }
.section-title { margin: 1.5rem 0 1rem; border-left: 4px solid var(--primary); background: var(--muted); padding: 0.5rem 0.75rem; color: var(--primary); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.025em; text-transform: uppercase; }
.authorization { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid var(--border); border-radius: 0.375rem; background: color-mix(in srgb, var(--muted) 30%, transparent); padding: 0.75rem; font-size: 0.875rem; }
  .terms-container { max-height: 400px; overflow-y: auto; border: 1px solid var(--border); border-radius: 0.375rem; background: var(--card); color: var(--card-foreground); padding: 1.25rem; font-size: 0.875rem; line-height: 1.5rem; }
.legacy-terms :deep(p), .legacy-terms :deep(li) { text-align: justify; }
.legacy-terms :deep(h5) { margin: 0 0 1rem; text-align: center; line-height: 1.5; }
</style>
