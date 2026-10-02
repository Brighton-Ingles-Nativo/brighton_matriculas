<script setup lang="ts">
import { ArrowLeft, CheckCircle2, CircleAlert, LoaderCircle, Send, XCircle } from '@lucide/vue'

definePageMeta({ middleware: 'auth', ssr: false })

const route = useRoute()
const loading = ref(true)
const error = ref('')
const contractId = ref('')
const status = ref('')
const observation = ref('')
const appointmentAt = ref('')
const appointmentType = ref('PRESENCIAL')
const advisoryRating = ref('')
const workflowLoading = ref(false)
const workflowError = ref('')
const { user, csrfHeaders } = useAuth()
const canCommercial = computed(() => ['admin', 'asistente_comercial'].includes(user.value?.role?.name || ''))
const canVerification = computed(() => ['admin', 'verificador'].includes(user.value?.role?.name || ''))
const canRejectCommercial = computed(() => canCommercial.value && ['PENDIENTE', 'EN_COMERCIAL', 'REBOTADO_COMERCIAL'].includes(status.value))
const canSendVerification = computed(() => canCommercial.value && ['PENDIENTE', 'EN_COMERCIAL', 'REBOTADO_COMERCIAL'].includes(status.value))
const canRejectVerification = computed(() => canVerification.value && ['EN_VERIFICACION', 'REBOTADO_VERIFICACION'].includes(status.value))
const canVerify = computed(() => canVerification.value && ['EN_VERIFICACION', 'CITA_PROGRAMADA', 'REBOTADO_VERIFICACION'].includes(status.value))

onMounted(async () => {
  try {
    const response = await $fetch<{ data: { contractId: string; status: string; observation?: string | null; appointmentAt?: string | null; appointmentType?: string | null } }>(`/api/expedients/${route.params.id}`, { credentials: 'include' })
    contractId.value = response.data.contractId
    status.value = response.data.status
    observation.value = response.data.observation || ''
    appointmentAt.value = response.data.appointmentAt ? response.data.appointmentAt.slice(0, 16) : ''
    appointmentType.value = response.data.appointmentType || 'PRESENCIAL'
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
          <p class="text-sm font-medium text-primary">Estado: {{ status }}</p>
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
              <UiButton v-if="canVerification && ['EN_VERIFICACION', 'REBOTADO_VERIFICACION'].includes(status)" variant="outline" :disabled="workflowLoading" @click="workflow('schedule_appointment')">Programar cita</UiButton>
              <UiButton v-if="canVerify" variant="outline" :disabled="workflowLoading" @click="workflow('verify_with_observations')"><CheckCircle2 class="mr-2 size-4" /> Verificar con observaciones</UiButton>
              <UiButton v-if="canVerify" :disabled="workflowLoading" @click="workflow('verify')"><CheckCircle2 class="mr-2 size-4" /> Verificar</UiButton>
            </div>
          </UiCardContent>
        </UiCard>
        <ExpedientDocumentsCard :contract-id="contractId" :contract-accepted="true" />
      </template>
      <UiButton variant="outline" as-child class="gap-2"><NuxtLink to="/expedientes"><ArrowLeft class="size-4" /> Volver a expedientes</NuxtLink></UiButton>
    </main>
  </div>
</template>
