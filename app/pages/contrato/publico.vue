<script setup lang="ts">
import { displayBirthDate } from '~/utils/birth-date'
import { CheckCircle2, LoaderCircle } from '@lucide/vue'
import ContractTermsContent from '@/components/contracts/ContractTermsContent.vue'

definePageMeta({ layout: 'public' })

interface Receipt { id: string; amount: string | null; concepts: string | null; paymentMethod: string | null; transactionDate: string | null; registeredAt: string }
interface Contract {
  id: string; 
  contractNumber: string; 
  holderName: string; 
  holderDni: string; 
  holderBirthDate: string; 
  holderEmail: string; 
  holderPhone: string; 
  holderAddress: string
  contractDepartment: string | null; 
  contractProvince: string | null; 
  contractDistrict: string | null
  program: string; 
  plan: string | null; 
  modality: string | null; 
  programValue: string; 
  initialPayment: string | null; 
  balance: string | null; 
  installmentCount: number | null; 
  installmentValue: string | null
  strategy: string; 
  currentSituation: string; 
  housingType: string; 
  paymentStartDate: string | null; notes: string | null; dataAuthorization: boolean; testimonials: boolean; dataUsage: boolean | null
  status: 'REVISION' | 'APROBADO' | 'ANULADO'; signedAccept: boolean; signedAt: string | null; signedIp: string | null; displayedAt: string; viewerIp: string; registeredAt: string; receipts: Receipt[]
  students: Array<{ name: string; birthDate: string | null; dni: string | null; email: string | null; phone: string | null }>
}

const route = useRoute()
const id = computed(() => String(route.query.id || ''))
const token = computed(() => String(route.query.token || ''))
const contract = ref<Contract | null>(null)
const termsHtml = ref('')
const termsContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const accepting = ref(false)
const acceptedChecked = ref(false)
const termsRead = ref(false)
const error = ref('')
const actionError = ref('')

const formatDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(value)) : '—'
const formatDateTime = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const money = (value: string | null | undefined) => value ? new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value)) : '—'
const display = (value: unknown) => value === null || value === undefined || value === '' ? '—' : String(value)
const isSigned = computed(() => Boolean(contract.value && (contract.value.signedAccept || contract.value.signedAt)))
const canSign = computed(() => Boolean(contract.value && contract.value.status !== 'ANULADO' && !isSigned.value))
const showTerms = computed(() => Boolean(contract.value && contract.value.status !== 'ANULADO'))
const status = computed(() => ({ REVISION: 'En revisión', APROBADO: 'Aprobado', ANULADO: 'Anulado' })[contract.value?.status || 'REVISION'])
const load = async () => {
  if (!id.value || !token.value) { error.value = 'El enlace del contrato está incompleto.'; loading.value = false; return }
  try {
    const response = await $fetch<{ data: Contract }>(`/api/public/contracts/${id.value}`, { query: { token: token.value } })
    contract.value = response.data
    const terms = await $fetch<{ html: string }>('/api/public/contracts/terms')
    termsHtml.value = terms.html
  } catch (err: any) { error.value = err?.data?.message || err?.data?.statusMessage || 'El enlace ha expirado o no es válido.' } finally { loading.value = false }
}

const accept = async () => {
  if (!canSign.value || !acceptedChecked.value || !termsRead.value) return
  accepting.value = true; actionError.value = ''
  try {
    const response = await $fetch<{ data: Pick<Contract, 'status' | 'signedAccept' | 'signedAt' | 'signedIp'> }>(`/api/public/contracts/${id.value}/accept`, { method: 'POST', query: { token: token.value } })
    if (contract.value) Object.assign(contract.value, response.data)
  } catch (err: any) { actionError.value = err?.data?.message || err?.data?.statusMessage || 'No se pudo aceptar el contrato.' } finally { accepting.value = false }
}

const updateTermsRead = () => {
  const target = termsContainer.value
  if (!target) return
  termsRead.value = target.scrollHeight - target.scrollTop <= target.clientHeight + 8
}

watch([loading, termsHtml], async () => {
  await nextTick()
  updateTermsRead()
})

onMounted(load)
</script>

<template>
  <div class="min-h-screen bg-muted/20 text-foreground">
    <header class="border-b bg-primary px-4 py-5 text-primary-foreground">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div>
          <p class="text-lg font-semibold">BRIGHTON INGLÉS NATIVO S.A.C.</p>
          <p class="text-sm opacity-80">Vista pública de matrícula</p>
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <UiSkeleton v-if="loading" class="h-96 w-full" />
      <UiAlert v-else-if="error" variant="destructive">
        <UiAlertDescription>{{ error }}</UiAlertDescription>
      </UiAlert>
      <template v-else-if="contract">
        <UiAlert v-if="actionError" variant="destructive">
          <UiAlertDescription>{{ actionError }}</UiAlertDescription>
        </UiAlert>
        <section class="rounded-lg border bg-card p-6 shadow-sm">
          <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p class="text-sm text-muted-foreground">Matrícula</p>
              <h1 class="text-2xl font-semibold">{{ contract.contractNumber }}</h1>
              <p class="mt-1 text-sm text-muted-foreground">Registrada el {{ formatDateTime(contract.registeredAt) }}
              </p>
            </div>
            <div class="flex gap-2">
              <!--<UiBadge variant="outline">Estado: {{ status }}</UiBadge>-->
              <UiBadge>{{ isSigned ? 'Firmado' : 'No firmado' }}</UiBadge>
            </div>
          </div>
        </section>
        <section class="rounded-lg border bg-card p-6 shadow-sm">
          <h2 class="mb-4 text-lg font-semibold">Datos del titular</h2>
          <dl class="grid gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nombre completo</dt>
              <dd>{{ contract.holderName }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">DNI / CE</dt>
              <dd>{{ contract.holderDni }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Fecha de nacimiento</dt>
              <dd>{{ displayBirthDate(contract.holderBirthDate) }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Correo</dt>
              <dd class="break-all">{{ contract.holderEmail }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Celular</dt>
              <dd>{{ contract.holderPhone }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dirección</dt>
              <dd>{{ contract.holderAddress }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Lugar de suscripción</dt>
              <dd>{{ display(contract.contractDistrict) }}, {{ display(contract.contractProvince) }}, {{
                display(contract.contractDepartment) }}</dd>
            </div>
          </dl>
          <div v-if="contract.students.length" class="mt-5 border-t pt-5">
            <h2 class="mb-3 text-lg font-semibold">Beneficiarios</h2>
            <div v-for="(student, index) in contract.students" :key="index" class="border-b py-2 last:border-0">
              <p>{{ index + 1 }}. {{ student.name }}</p>
              <p class="text-sm text-muted-foreground">DNI: {{ display(student.dni) }} · {{ display(student.phone) }}
              </p>
            </div>
          </div>
        </section>
        <section class="rounded-lg border bg-card p-6 shadow-sm">
          <h2 class="mb-4 text-lg font-semibold">Programa y pagos</h2>
          <dl class="grid gap-4 sm:grid-cols-3">
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Programa</dt>
              <dd>{{ contract.program }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Plan</dt>
              <dd>{{ display(contract.plan) }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Modalidad</dt>
              <dd>{{ display(contract.modality) }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Valor del programa</dt>
              <dd>{{ money(contract.programValue) }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Cuota inicial</dt>
              <dd>{{ money(contract.initialPayment) }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Saldo</dt>
              <dd>{{ money(contract.balance) }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Número de cuotas</dt>
              <dd>{{ display(contract.installmentCount) }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Valor de cuota</dt>
              <dd>{{ money(contract.installmentValue) }}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Inicio de pago</dt>
              <dd>{{ display(contract.paymentStartDate) }}</dd>
            </div>
          </dl>
          <p v-if="contract.notes" class="mt-4 whitespace-pre-line text-sm text-muted-foreground">{{ contract.notes }}
          </p>
        </section>
        <section class="rounded-lg border bg-card p-6 shadow-sm">
          <h2 class="mb-4 text-lg font-semibold">Autorizaciones</h2>
          <div class="grid gap-2 text-sm">
            <p>Datos personales: <strong>{{ contract.dataAuthorization ? 'Autorizado' : 'No autorizado' }}</strong></p>
            <p>Testimonios: <strong>{{ contract.testimonials ? 'Autorizado' : 'No autorizado' }}</strong></p>
            <p>Uso de imagen y datos: <strong>{{ contract.dataUsage ? 'Autorizado' : 'No autorizado' }}</strong></p>
          </div>
        </section>
        <section v-if="contract.receipts.length" class="rounded-lg border bg-card p-6 shadow-sm">
          <h2 class="mb-4 text-lg font-semibold">Pagos registrados</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="border-b">
                  <th class="p-2">Concepto</th>
                  <th class="p-2">Importe</th>
                  <th class="p-2">Método</th>
                  <th class="p-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="receipt in contract.receipts" :key="receipt.id" class="border-b last:border-0">
                  <td class="p-2">{{ receipt.concepts || 'Pago registrado' }}</td>
                  <td class="p-2">{{ money(receipt.amount) }}</td>
                  <td class="p-2">{{ display(receipt.paymentMethod) }}</td>
                  <td class="p-2">{{ formatDate(receipt.transactionDate || receipt.registeredAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section v-if="showTerms" class="rounded-lg border bg-card p-6 shadow-sm">
          <h2 class="mb-4 text-lg font-semibold">Términos y condiciones</h2>
          <div ref="termsContainer" class="max-h-[28rem] overflow-y-auto rounded-md border p-4 print:max-h-none print:overflow-visible" @scroll="updateTermsRead">
            <ContractTermsContent :html="termsHtml" :signed="isSigned" :signed-at="contract.signedAt" :fallback-at="contract.displayedAt" :signed-ip="contract.signedIp" :fallback-ip="contract.viewerIp" />
          </div>
          <div v-if="canSign" class="mt-5 space-y-4"><label class="flex items-start gap-3 text-sm">
              <UiCheckbox v-model="acceptedChecked" :disabled="!termsRead" /><span>Declaro haber leído y acepto los
                términos y condiciones.</span>
            </label>
            <UiButton :disabled="!termsRead || !acceptedChecked || accepting" class="gap-2" @click="accept">
              <LoaderCircle v-if="accepting" class="size-4 animate-spin" />
              <CheckCircle2 v-else class="size-4" />{{ accepting ? 'Procesando…' : 'Firmar y aceptar contrato' }}
            </UiButton>
            <p v-if="!termsRead" class="text-xs text-muted-foreground">Lee los términos hasta el final para habilitar la
              firma.</p>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

