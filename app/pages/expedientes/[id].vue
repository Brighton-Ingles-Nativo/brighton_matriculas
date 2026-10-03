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
const appointmentAt = ref('')
const appointmentType = ref('PRESENCIAL')
const advisoryRating = ref('')
const workflowLoading = ref(false)
const workflowError = ref('')
const showFullHistory = ref(false)
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
const canCommercial = computed(() => ['admin', 'asistente_comercial'].includes(user.value?.role?.name || ''))
const canVerification = computed(() => ['admin', 'verificador'].includes(user.value?.role?.name || ''))
const isAtCommercial = computed(() => status.value === 'CREADO' && currentLocation.value === 'ASISTENTE_COMERCIAL')
const isAtVerification = computed(() => ['CREADO', 'AGENDADO'].includes(status.value) && currentLocation.value === 'VERIFICACION')
const canRejectCommercial = computed(() => canCommercial.value && isAtCommercial.value)
const canSendVerification = computed(() => canCommercial.value && isAtCommercial.value)
const canRejectVerification = computed(() => canVerification.value && isAtVerification.value)
const canVerify = computed(() => canVerification.value && isAtVerification.value)
const statusLabel = (value: string) => ({ CREADO: 'Creado', REBOTADO: 'Rebotado', AGENDADO: 'Agendado', OBSERVADO: 'Observado', VERIFICADO: 'Verificado' }[value] || value)
const locationLabel = (value: string) => ({ ASESOR: 'Asesor', SUPERVISOR: 'Supervisor', ASISTENTE_COMERCIAL: 'Asistente comercial', VERIFICACION: 'Verificación' }[value] || value)

onMounted(async () => {
  try {
    const response = await $fetch<{ data: { contractId: string; status: string; currentLocation: string; observation?: string | null; appointmentAt?: string | null; appointmentType?: string | null; movements: typeof movements.value } }>(`/api/expedients/${route.params.id}`, { credentials: 'include' })
    contractId.value = response.data.contractId
    status.value = response.data.status
    currentLocation.value = response.data.currentLocation
    observation.value = response.data.observation || ''
    appointmentAt.value = response.data.appointmentAt ? response.data.appointmentAt.slice(0, 16) : ''
    appointmentType.value = response.data.appointmentType || 'PRESENCIAL'
    movements.value = response.data.movements || []
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'No se pudo cargar el expediente.'
  } finally {
    loading.value = false
  }
})

const workflow = async (action: string) => {
  workflowLoading.value = true
  workflowError.value = ''
  try {
    const response = await $fetch<{ data: { status: string; observation?: string | null } }>(`/api/expedients/${route.params.id}/workflow`, {
      method: 'PATCH', credentials: 'include', headers: await csrfHeaders(),
      body: { action, observation: observation.value, appointmentAt: appointmentAt.value || undefined, appointmentType: appointmentType.value, advisoryRating: advisoryRating.value ? Number(advisoryRating.value) : undefined }
    })
    status.value = response.data.status
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
        <UiCard v-if="canCommercial || canVerification">
          <UiCardHeader><UiCardTitle>Flujo de revisión</UiCardTitle><UiCardDescription>Actualiza el estado y comunica las observaciones a los usuarios relacionados.</UiCardDescription></UiCardHeader>
          <UiCardContent class="space-y-4">
            <div v-if="canCommercial || canVerification" class="space-y-2">
              <label class="text-sm font-medium" for="workflow-observation">Observaciones</label>
              <UiTextarea id="workflow-observation" v-model="observation" placeholder="Describe los errores o indicaciones para corregir el expediente." />
            </div>
            <div v-if="canVerification" class="grid gap-4 sm:grid-cols-3">
              <div class="space-y-2"><label class="text-sm font-medium" for="appointment-at">Fecha de cita</label><UiInput id="appointment-at" v-model="appointmentAt" type="datetime-local" /></div>
              <div class="space-y-2"><label class="text-sm font-medium" for="appointment-type">Tipo de cita</label><select id="appointment-type" v-model="appointmentType" class="h-9 w-full rounded-lg border bg-background px-2 text-sm"><option value="PRESENCIAL">Presencial</option><option value="VIRTUAL">Virtual</option></select></div>
              <div class="space-y-2"><label class="text-sm font-medium" for="advisory-rating">Calificación asesoría</label><UiInput id="advisory-rating" v-model="advisoryRating" type="number" min="0" max="10" placeholder="0 a 10" /></div>
            </div>
            <div class="flex flex-wrap gap-2">
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
