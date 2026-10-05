<script setup lang="ts">
import { ArrowLeft, CheckCircle2, CircleAlert, History, LoaderCircle, Send, XCircle } from '@lucide/vue'

definePageMeta({ middleware: 'auth', ssr: false })

const route = useRoute()
const loading = ref(true)
const error = ref('')
const contractId = ref('')
const status = ref('')
const currentLocation = ref('')
const observation = ref('')
const firstContactAt = ref('')
const appointmentAt = ref('')
const appointmentRescheduledAt = ref('')
const appointmentType = ref('PRESENCIAL')
const advisoryRating = ref('')
const strategyConfirmed = ref('')
const strategyObservation = ref('')
const advisorValidationConfirmed = ref('')
const advisorValidationName = ref('')
const classStartDate = ref('')
const paymentDate = ref('')
const verificationSaving = ref(false)
const verificationError = ref('')
const verificationSuccess = ref('')
const workflowLoading = ref(false)
const workflowError = ref('')
const showFullHistory = ref(false)
const verificationReturnLocation = ref<'ASISTENTE_COMERCIAL' | 'SUPERVISOR'>('ASISTENTE_COMERCIAL')
const movements = ref<Array<{
  id: string
  fromStatus: string | null
  toStatus: string | null
  fromLocation: string | null
  toLocation: string | null
  observation: string | null
  createdAt: string
  user: { name: string; username: string }
}>>([])
const { user, csrfHeaders } = useAuth()
const canAdvisor = computed(() => user.value?.role?.name === 'asesor')
const canSupervisor = computed(() => ['admin', 'supervisor'].includes(user.value?.role?.name || ''))
const canCommercial = computed(() => ['admin', 'asistente_comercial'].includes(user.value?.role?.name || ''))
const canVerification = computed(() => ['admin', 'verificador'].includes(user.value?.role?.name || ''))
const canEditVerification = computed(() => canVerification.value && currentLocation.value === 'VERIFICACION')
const isAtAdvisor = computed(() => ['CREADO', 'REBOTADO'].includes(status.value) && currentLocation.value === 'ASESOR')
const isAtSupervisor = computed(() => ['CREADO', 'REBOTADO'].includes(status.value) && currentLocation.value === 'SUPERVISOR')
const isAtCommercial = computed(() => status.value === 'CREADO' && currentLocation.value === 'ASISTENTE_COMERCIAL')
const isAtVerification = computed(() => ['CREADO', 'AGENDADO'].includes(status.value) && currentLocation.value === 'VERIFICACION')
const canSendSupervisor = computed(() => canAdvisor.value && isAtAdvisor.value)
const canApproveSupervisor = computed(() => canSupervisor.value && isAtSupervisor.value)
const canRejectSupervisor = computed(() => canSupervisor.value && isAtSupervisor.value)
const canRejectCommercial = computed(() => canCommercial.value && isAtCommercial.value)
const canSendVerification = computed(() => canCommercial.value && isAtCommercial.value)
const canRejectVerification = computed(() => canVerification.value && isAtVerification.value)
const canVerify = computed(() => canVerification.value && isAtVerification.value)
const statusLabel = (value: string) => ({ CREADO: 'Creado', REBOTADO: 'Rebotado', AGENDADO: 'Agendado', OBSERVADO: 'Observado', VERIFICADO: 'Verificado' }[value] || value)
const locationLabel = (value: string) => ({ ASESOR: 'Asesor', SUPERVISOR: 'Supervisor', ASISTENTE_COMERCIAL: 'Asistente comercial', VERIFICACION: 'Verificación' }[value] || value)
const toLocalDateTimeInput = (value: string | null | undefined) => {
  if (!value) return ''
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const toIsoDateTime = (value: string) => value ? new Date(value).toISOString() : null

watch([firstContactAt, appointmentAt, appointmentRescheduledAt, appointmentType, advisoryRating, strategyConfirmed, strategyObservation, advisorValidationConfirmed, advisorValidationName, classStartDate, paymentDate], () => {
  verificationSuccess.value = ''
})

interface ExpedientDetail {
  contractId: string
  status: string
  currentLocation: string
  observation?: string | null
  firstContactAt?: string | null
  appointmentAt?: string | null
  appointmentRescheduledAt?: string | null
  appointmentType?: string | null
  advisoryRating?: number | null
  strategyConfirmed?: boolean | null
  strategyObservation?: string | null
  advisorValidationConfirmed?: boolean | null
  advisorValidationName?: string | null
  classStartDate?: string | null
  paymentDate?: string | null
  movements: typeof movements.value
}

onMounted(async () => {
  try {
    const response = await $fetch<{ data: ExpedientDetail }>(`/api/expedients/${route.params.id}`, { credentials: 'include' })
    contractId.value = response.data.contractId
    status.value = response.data.status
    currentLocation.value = response.data.currentLocation
    observation.value = response.data.observation || ''
    firstContactAt.value = toLocalDateTimeInput(response.data.firstContactAt)
    appointmentAt.value = toLocalDateTimeInput(response.data.appointmentAt)
    appointmentRescheduledAt.value = toLocalDateTimeInput(response.data.appointmentRescheduledAt)
    appointmentType.value = response.data.appointmentType || 'PRESENCIAL'
    advisoryRating.value = response.data.advisoryRating === null || response.data.advisoryRating === undefined ? '' : String(response.data.advisoryRating)
    strategyConfirmed.value = response.data.strategyConfirmed === null || response.data.strategyConfirmed === undefined ? '' : String(response.data.strategyConfirmed)
    strategyObservation.value = response.data.strategyObservation || ''
    advisorValidationConfirmed.value = response.data.advisorValidationConfirmed === null || response.data.advisorValidationConfirmed === undefined ? '' : String(response.data.advisorValidationConfirmed)
    advisorValidationName.value = response.data.advisorValidationName || ''
    classStartDate.value = response.data.classStartDate?.slice(0, 10) || ''
    paymentDate.value = response.data.paymentDate?.slice(0, 10) || ''
    movements.value = response.data.movements || []
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'No se pudo cargar el expediente.'
  } finally {
    loading.value = false
  }
})

const saveVerification = async (showSuccess = true): Promise<boolean> => {
  verificationSaving.value = true
  verificationError.value = ''
  verificationSuccess.value = ''
  try {
    await $fetch(`/api/expedients/${route.params.id}/verification`, {
      method: 'PATCH', credentials: 'include', headers: await csrfHeaders(),
      body: {
        firstContactAt: toIsoDateTime(firstContactAt.value),
        appointmentAt: toIsoDateTime(appointmentAt.value),
        appointmentRescheduledAt: toIsoDateTime(appointmentRescheduledAt.value),
        appointmentType: appointmentType.value,
        advisoryRating: advisoryRating.value === '' ? null : Number(advisoryRating.value),
        strategyConfirmed: strategyConfirmed.value === '' ? null : strategyConfirmed.value === 'true',
        strategyObservation: strategyConfirmed.value === 'false' ? strategyObservation.value : null,
        advisorValidationConfirmed: advisorValidationConfirmed.value === '' ? null : advisorValidationConfirmed.value === 'true',
        advisorValidationName: advisorValidationConfirmed.value === 'false' ? advisorValidationName.value : null,
        classStartDate: classStartDate.value || null,
        paymentDate: paymentDate.value || null
      }
    })
    if (showSuccess) verificationSuccess.value = 'Datos de verificación guardados.'
    return true
  } catch (err: any) {
    verificationError.value = err?.data?.statusMessage || 'No se pudieron guardar los datos de verificación.'
    return false
  } finally {
    verificationSaving.value = false
  }
}

const workflow = async (action: string) => {
  workflowLoading.value = true
  workflowError.value = ''
  try {
    if (canVerification.value && ['reject_verification', 'schedule_appointment', 'verify_with_observations', 'verify'].includes(action)) {
      if (!await saveVerification(false)) return
    }
    const response = await $fetch<{ data: { status: string; currentLocation: string; observation?: string | null } }>(`/api/expedients/${route.params.id}/workflow`, {
      method: 'PATCH', credentials: 'include', headers: await csrfHeaders(),
      body: {
        action,
        observation: observation.value,
        appointmentAt: toIsoDateTime(appointmentAt.value) || undefined,
        appointmentType: appointmentType.value,
        advisoryRating: advisoryRating.value === '' ? undefined : Number(advisoryRating.value),
        returnTo: action === 'reject_verification' ? verificationReturnLocation.value : undefined
      }
    })
    status.value = response.data.status
    currentLocation.value = response.data.currentLocation
    observation.value = response.data.observation || observation.value
    const history = await $fetch<{ data: typeof movements.value }>(`/api/expedients/${route.params.id}/movements`, { credentials: 'include' })
    movements.value = history.data
  } catch (err: any) {
    workflowError.value = err?.data?.statusMessage || 'No se pudo actualizar el flujo del expediente.'
  } finally {
    workflowLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader title="Gestionar expediente" subtitle="Documentación de la matrícula" back-to="/expedientes" />
    <main class="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <UiAlert v-if="error" variant="destructive"><UiAlertDescription>{{ error }}</UiAlertDescription></UiAlert>
      <div v-else-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle class="size-4 animate-spin" /> Cargando expediente…</div>
      <template v-else>
        <section>
          <p class="text-sm font-medium text-primary">Estado: {{ statusLabel(status) }} · Ubicación: {{ locationLabel(currentLocation) }}</p>
          <h1 class="mt-1 text-3xl font-semibold tracking-tight">Documentos del expediente</h1>
        </section>
        <UiAlert v-if="workflowError" variant="destructive"><UiAlertDescription>{{ workflowError }}</UiAlertDescription></UiAlert>
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Datos de verificación</UiCardTitle>
            <UiCardDescription>Registra el contacto, la cita y los datos confirmados con el cliente.</UiCardDescription>
          </UiCardHeader>
          <UiCardContent class="space-y-4">
            <UiAlert v-if="verificationError" variant="destructive"><UiAlertDescription>{{ verificationError }}</UiAlertDescription></UiAlert>
            <UiAlert v-if="verificationSuccess"><UiAlertDescription>{{ verificationSuccess }}</UiAlertDescription></UiAlert>
            <fieldset :disabled="!canEditVerification || verificationSaving || workflowLoading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 disabled:opacity-70">
              <div class="space-y-2"><label class="text-sm font-medium" for="first-contact-at">Primer contacto</label><UiInput id="first-contact-at" v-model="firstContactAt" type="datetime-local" /></div>
              <div class="space-y-2"><label class="text-sm font-medium" for="appointment-at">Fecha de cita</label><UiInput id="appointment-at" v-model="appointmentAt" type="datetime-local" /></div>
              <div class="space-y-2"><label class="text-sm font-medium" for="appointment-rescheduled-at">Cita reprogramada para</label><UiInput id="appointment-rescheduled-at" v-model="appointmentRescheduledAt" type="datetime-local" /></div>
              <div class="space-y-2"><label class="text-sm font-medium" for="appointment-type">Tipo de cita</label><select id="appointment-type" v-model="appointmentType" class="h-9 w-full rounded-lg border bg-background px-2 text-sm"><option value="PRESENCIAL">Presencial</option><option value="VIRTUAL">Virtual</option></select></div>
              <div class="space-y-2"><label class="text-sm font-medium" for="advisory-rating">Calificación de asesoría (0 a 10)</label><UiInput id="advisory-rating" v-model="advisoryRating" type="number" min="0" max="10" step="1" /></div>
              <div class="space-y-2"><label class="text-sm font-medium" for="strategy-confirmed">¿Confirma la estrategia?</label><select id="strategy-confirmed" v-model="strategyConfirmed" class="h-9 w-full rounded-lg border bg-background px-2 text-sm"><option value="">Sin confirmar</option><option value="true">Sí</option><option value="false">No</option></select></div>
              <div v-if="strategyConfirmed === 'false'" class="space-y-2 sm:col-span-2 lg:col-span-3"><label class="text-sm font-medium" for="strategy-observation">Estrategia indicada por el cliente</label><UiTextarea id="strategy-observation" v-model="strategyObservation" maxlength="1000" /></div>
              <div class="space-y-2"><label class="text-sm font-medium" for="advisor-confirmed">¿Confirma al asesor?</label><select id="advisor-confirmed" v-model="advisorValidationConfirmed" class="h-9 w-full rounded-lg border bg-background px-2 text-sm"><option value="">Sin confirmar</option><option value="true">Sí</option><option value="false">No</option></select></div>
              <div v-if="advisorValidationConfirmed === 'false'" class="space-y-2 sm:col-span-2"><label class="text-sm font-medium" for="advisor-name">Asesor indicado por el cliente</label><UiInput id="advisor-name" v-model="advisorValidationName" maxlength="200" /></div>
              <div class="space-y-2"><label class="text-sm font-medium" for="class-start-date">Inicio de clases</label><UiInput id="class-start-date" v-model="classStartDate" type="date" /></div>
              <div class="space-y-2"><label class="text-sm font-medium" for="payment-date">Fecha de pago</label><UiInput id="payment-date" v-model="paymentDate" type="date" /></div>
            </fieldset>
            <UiButton v-if="canEditVerification" :disabled="verificationSaving || workflowLoading" @click="saveVerification()"><LoaderCircle v-if="verificationSaving" class="mr-2 size-4 animate-spin" />Guardar datos de verificación</UiButton>
          </UiCardContent>
        </UiCard>
        <UiCard v-if="canAdvisor || canSupervisor || canCommercial || canVerification">
          <UiCardHeader><UiCardTitle>Flujo de revisión</UiCardTitle><UiCardDescription>Actualiza el estado y comunica las observaciones a los usuarios relacionados.</UiCardDescription></UiCardHeader>
          <UiCardContent class="space-y-4">
            <div class="space-y-2">
              <label class="text-sm font-medium" for="workflow-observation">Observaciones</label>
              <UiTextarea id="workflow-observation" v-model="observation" placeholder="Describe los errores o indicaciones para corregir el expediente." />
            </div>
            <div v-if="canRejectVerification" class="space-y-2">
              <label class="text-sm font-medium" for="verification-return-location">Devolver a</label>
              <select id="verification-return-location" v-model="verificationReturnLocation" class="h-9 w-full rounded-lg border bg-background px-2 text-sm sm:max-w-sm">
                <option value="ASISTENTE_COMERCIAL">Asistente comercial</option>
                <option value="SUPERVISOR">Supervisor</option>
              </select>
            </div>
            <div class="flex flex-wrap gap-2">
              <UiButton v-if="canSendSupervisor" :disabled="workflowLoading" @click="workflow('send_supervisor')"><Send class="mr-2 size-4" /> Enviar a supervisor</UiButton>
              <UiButton v-if="canApproveSupervisor" :disabled="workflowLoading" @click="workflow('approve_supervisor')"><Send class="mr-2 size-4" /> Enviar a Comercial</UiButton>
              <UiButton v-if="canRejectSupervisor" variant="destructive" :disabled="workflowLoading" @click="workflow('reject_supervisor')"><XCircle class="mr-2 size-4" /> Rebotar al asesor</UiButton>
              <UiButton v-if="canRejectCommercial" variant="destructive" :disabled="workflowLoading" @click="workflow('reject_commercial')"><XCircle class="mr-2 size-4" /> Rebotar comercial</UiButton>
              <UiButton v-if="canSendVerification" :disabled="workflowLoading" @click="workflow('send_verification')"><Send class="mr-2 size-4" /> Enviar a verificación</UiButton>
              <UiButton v-if="canRejectVerification" variant="destructive" :disabled="workflowLoading" @click="workflow('reject_verification')"><CircleAlert class="mr-2 size-4" /> Rebotar verificación</UiButton>
              <UiButton v-if="canVerification && status === 'CREADO' && currentLocation === 'VERIFICACION'" variant="outline" :disabled="workflowLoading" @click="workflow('schedule_appointment')">Programar cita</UiButton>
              <UiButton v-if="canVerify" variant="outline" :disabled="workflowLoading" @click="workflow('verify_with_observations')"><CheckCircle2 class="mr-2 size-4" /> Verificar con observaciones</UiButton>
              <UiButton v-if="canVerify" :disabled="workflowLoading" @click="workflow('verify')"><CheckCircle2 class="mr-2 size-4" /> Verificar</UiButton>
            </div>
          </UiCardContent>
        </UiCard>
        <ExpedientDocumentsCard :contract-id="contractId" :contract-accepted="true" />
        <UiCard>
          <UiCardHeader class="flex flex-row items-start justify-between gap-4">
            <div>
              <UiCardTitle class="flex items-center gap-2"><History class="size-4" /> Historial de movimientos</UiCardTitle>
              <UiCardDescription>Últimos cambios de estado y ubicación del expediente.</UiCardDescription>
            </div>
            <UiButton v-if="movements.length > 3" variant="outline" size="sm" @click="showFullHistory = !showFullHistory">
              {{ showFullHistory ? 'Ver últimos 3' : 'Ver historial completo' }}
            </UiButton>
          </UiCardHeader>
          <UiCardContent>
            <div v-if="!movements.length" class="py-6 text-center text-sm text-muted-foreground">Todavía no hay movimientos registrados.</div>
            <div v-else class="space-y-3">
              <div v-for="movement in (showFullHistory ? movements : movements.slice(0, 3))" :key="movement.id" class="rounded-lg border p-3">
                <div class="flex flex-wrap items-center gap-2 text-sm">
                  <UiBadge variant="outline">{{ statusLabel(movement.fromStatus || '—') }} → {{ statusLabel(movement.toStatus || '—') }}</UiBadge>
                  <span class="text-muted-foreground">{{ movement.fromLocation ? `${locationLabel(movement.fromLocation)} → ` : '' }}{{ locationLabel(movement.toLocation || '—') }}</span>
                </div>
                <p v-if="movement.observation" class="mt-2 text-sm">{{ movement.observation }}</p>
                <p class="mt-2 text-xs text-muted-foreground">{{ movement.user.name }} · {{ new Date(movement.createdAt).toLocaleString('es-PE') }}</p>
              </div>
            </div>
          </UiCardContent>
        </UiCard>
      </template>
      <UiButton variant="outline" as-child class="gap-2"><NuxtLink to="/expedientes"><ArrowLeft class="size-4" /> Volver a expedientes</NuxtLink></UiButton>
    </main>
  </div>
</template>
