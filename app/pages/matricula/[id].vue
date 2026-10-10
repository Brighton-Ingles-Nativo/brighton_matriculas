<script setup lang="ts">
import { ArrowLeft, Save } from '@lucide/vue'
import { ubigeoPeru } from '~/shared/ubigeo'

definePageMeta({ middleware: 'auth', ssr: false })

const route = useRoute(); 
const { csrfHeaders } = useAuth(); 
const { user } = useAuth()
const loading = ref(true); 
const saving = ref(false); 
const error = ref(''); 
const success = ref('')
const isLocked = ref(false)
const cancellationReason = ref('')
const cancellationRequest = ref<any>(null)
const cancellationLoading = ref(false)
const cancellationError = ref('')
const canRequestCancellation = computed(() => [ 'supervisor', 'admin'].includes(user.value?.role?.name || ''))
const canReviewCancellation = computed(() => ['supervisor', 'admin'].includes(user.value?.role?.name || ''))

const departments = Object.keys(ubigeoPeru).sort((a, b) => a.localeCompare(b, 'es'))
const teams = ref<{ id: string; name: string; site: { id: string; name: string } }[]>([])
const strategies = ref<{ id: string; code: string | null; name: string; description: string | null }[]>([])
type Beneficiary = { name: string; birthDate: string; dni: string; email: string; phone: string }
const emptyBeneficiary = (): Beneficiary => ({ name: '', birthDate: '', dni: '', email: '', phone: '' })

const installments = Array.from({ length: 13 }, (_, index) => index + 2)
const form = reactive<{ students: Beneficiary[]; [key: string]: any }>({
  contractDepartment: 'Arequipa', 
  contractProvince: 'Arequipa', 
  contractDistrict: '', 
  holderName: '', 
  holderBirthDate: '', 
  holderDni: '', 
  holderEmail: '', 
  holderAddress: '', 
  holderDepartment: '', 
  holderProvince: '', 
  holderDistrict: '', 
  holderPhone: '', 
  students: [] as Beneficiary[],
  currentSituation: 'Empleado', 
  housingType: 'Propia', 
  strategyId: '',
  paymentStartDate: '', 
  modality: '', 
  program: '',
  plan: '', 
  paymentMode: '', 
  programValue: '', 
  initialPayment: '0', 
  balance: '0', 
  installmentCount: '0', 
  installmentValue: '0', 
  otherPayment: '0', 
  notes: '', 
  dataAuthorization: false, 
  testimonials: false, 
  dataUsage: false 
})
const holderProvinces = computed(() => Object.keys(ubigeoPeru[form.holderDepartment] || {}).sort((a, b) => a.localeCompare(b, 'es')))
const holderDistricts = computed(() => ubigeoPeru[form.holderDepartment]?.[form.holderProvince] || [])

const contractNumber = ref(''); 
const isCash = computed(() => form.paymentMode === 'contado'); 
const isFinanced = computed(() => form.paymentMode === 'financiado'); 
const showPlan = computed(() => form.program && form.program !== 'Kids')

const applyDniLookup = (target: 'holder' | number, data: { nombres: string; apellidoPaterno: string; apellidoMaterno: string; fechaNacimiento?: string }) => {
  const name = `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`.replace(/\s+/g, ' ').trim()
  if (target === 'holder') {
    form.holderName = name
    if (data.fechaNacimiento) form.holderBirthDate = data.fechaNacimiento
  } else {
    const student = form.students[target]
    if (!student) return
    student.name = name
    if (data.fechaNacimiento) student.birthDate = data.fechaNacimiento
  }
}

const addBeneficiary = () => form.students.push(emptyBeneficiary())
const removeBeneficiary = (index: number) => {
  if (form.students.length > 1) form.students.splice(index, 1)
}

const dateInput = (value: string | null) => value ? value.slice(0, 10) : ''

const loadTeams = async () => {
  try {
    const response = await $fetch<{ data: typeof teams.value }>('/api/teams', { credentials: 'include' })
    teams.value = response.data
  } catch {
    error.value = 'No se pudieron cargar los equipos comerciales.'
  }
}

const loadStrategies = async () => {
  try {
    const response = await $fetch<{ data: typeof strategies.value }>('/api/strategies', { credentials: 'include' })
    strategies.value = response.data
  } catch {
    error.value = 'No se pudieron cargar las estrategias.'
  }
}

const money = (value: unknown) => Number(value || 0).toFixed(2)

const loadContract = async () => { 
  try { 
    const response = await $fetch<any>(`/api/contracts/${route.params.id}`, { 
      credentials: 'include' 
    }); 
    const contract = response.data; 
    cancellationRequest.value = contract.cancellationRequest || null
    isLocked.value = Boolean(contract.signedAt) || contract.status !== 'REVISION'
    contractNumber.value = 
    contract.contractNumber; 
    const loadedStudents = Array.isArray(contract.students)
      ? contract.students.map((student: any) => ({
          name: student.name ?? '', birthDate: dateInput(student.birthDate), dni: student.dni ?? '',
          email: student.email ?? '', phone: student.phone ?? ''
        }))
      : []
    Object.assign(form, { 
      ...contract, 
      students: loadedStudents.length ? loadedStudents : [emptyBeneficiary()],
      holderBirthDate: dateInput(contract.holderBirthDate), 
      paymentMode: contract.cashPayment ? 'contado' : 'financiado', 
      programValue: money(contract.programValue), 
      initialPayment: money(contract.initialPayment), 
      balance: money(contract.balance), 
      installmentValue: money(contract.installmentValue), 
      installmentCount: String(contract.installmentCount || 0), 
      otherPayment: contract.otherPayment || '' 
    }) 
  } catch (err: any) { 
    error.value = err?.data?.statusMessage || 'No pudimos cargar la matrícula.' 
  } finally { 
    loading.value = false 
  } 
}

const requestCancellation = async () => {
  cancellationLoading.value = true
  cancellationError.value = ''
  try {
    const response = await $fetch<{ data: any }>(`/api/contracts/${route.params.id}/cancellation-requests`, { method: 'POST', headers: await csrfHeaders(), credentials: 'include', body: { reason: cancellationReason.value } })
    cancellationRequest.value = { ...response.data, reason: cancellationReason.value }
    cancellationReason.value = ''
  } catch (err: any) {
    cancellationError.value = err?.data?.statusMessage || 'No se pudo registrar la solicitud.'
  } finally { cancellationLoading.value = false }
}

const reviewCancellation = async (decision: 'APROBAR' | 'RECHAZAR') => {
  if (!cancellationRequest.value) return
  cancellationLoading.value = true
  cancellationError.value = ''
  try {
    const response = await $fetch<{ data: any }>(`/api/cancellation-requests/${cancellationRequest.value.id}`, { method: 'PATCH', headers: await csrfHeaders(), credentials: 'include', body: { decision } })
    cancellationRequest.value = { ...cancellationRequest.value, ...response.data }
    if (decision === 'APROBAR') isLocked.value = true
  } catch (err: any) {
    cancellationError.value = err?.data?.statusMessage || 'No se pudo revisar la solicitud.'
  } finally { cancellationLoading.value = false }
}

const calculateAmounts = () => { 
  const total = Number(form.programValue) || 0; 
  const initial = Number(form.initialPayment) || 0; 
  if (isCash.value) { 
    form.balance = '0.00'; 
    form.installmentCount = '0'; 
    form.installmentValue = '0.00' 
  } else { 
    const balance = Math.max(total - initial, 0); 
    form.balance = balance.toFixed(2); 
    form.installmentValue = Number(form.installmentCount) > 0 ? (balance / Number(form.installmentCount)).toFixed(2) : '0.00' 
  } 
}

watch(() => [
  form.paymentMode, 
  form.programValue, 
  form.initialPayment, 
  form.installmentCount], 
  calculateAmounts
)
watch(() => form.holderDepartment, () => {
  if (!holderProvinces.value.includes(form.holderProvince)) {
    form.holderProvince = ''
    form.holderDistrict = ''
  }
})
watch(() => form.holderProvince, () => {
  if (!holderDistricts.value.includes(form.holderDistrict)) form.holderDistrict = ''
})

const submit = async () => { 
  if (isLocked.value) {
    error.value = 'No se puede editar una matrícula firmada.'
    return
  }
  saving.value = true; 
  error.value = ''; 
  success.value = ''; 
  try { 
    const { strategy: _strategy, strategyNameSnapshot: _strategyNameSnapshot, strategyDefinition: _strategyDefinition, ...editableForm } = form
    await $fetch<any>(`/api/contracts/${route.params.id}`, { 
      method: 'PUT' as any, 
      headers: await csrfHeaders(), 
      credentials: 'include', 
      body: editableForm
    }); 
    success.value = 'Matrícula actualizada correctamente.' 
  } catch (err: any) { 
    error.value = err?.data?.statusMessage || 'No pudimos actualizar la matrícula.' 
  } finally { 
    saving.value = false 
  } 
}

onMounted(async () => { await Promise.all([loadTeams(), loadStrategies(), loadContract()]) })
</script>

<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader :title="`Editar matrícula ${contractNumber}`" subtitle="Actualiza el contenido registrado"
      back-to="/matriculas" />
    <main class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section class="flex items-end justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-primary">Edición de matrícula</p>
          <h1 class="mt-1 text-3xl font-semibold tracking-tight">{{ contractNumber || 'Cargando…' }}</h1>
          <p class="mt-2 text-muted-foreground">Modifica los datos necesarios y guarda los cambios.</p>
        </div>
        <UiButton variant="outline" as-child>
          <NuxtLink to="/matriculas">
            <ArrowLeft class="mr-2 size-4" /> Volver
          </NuxtLink>
        </UiButton>
      </section>
      <UiSkeleton v-if="loading" class="h-96 w-full" />
      <UiAlert v-else-if="error" variant="destructive">
        <UiAlertDescription>{{ error }}</UiAlertDescription>
      </UiAlert>
      <form v-else class="space-y-6" @submit.prevent="submit">
        <UiCard v-if="canRequestCancellation || cancellationRequest">
          <UiCardHeader><UiCardTitle>Solicitud de anulación</UiCardTitle><UiCardDescription>La solicitud será notificada al supervisor responsable.</UiCardDescription></UiCardHeader>
          <UiCardContent class="space-y-4">
            <UiAlert v-if="cancellationError" variant="destructive"><UiAlertDescription>{{ cancellationError }}</UiAlertDescription></UiAlert>
            <div v-if="cancellationRequest" class="rounded-xl border bg-muted/30 p-4 text-sm">
              <p><span class="font-medium">Estado:</span> {{ cancellationRequest.status }}</p>
              <p class="mt-1"><span class="font-medium">Motivo:</span> {{ cancellationRequest.reason }}</p>
            </div>
            <template v-if="canRequestCancellation && !cancellationRequest">
              <UiTextarea v-model="cancellationReason" placeholder="Indica el motivo de la solicitud de anulación." />
              <UiButton type="button" variant="destructive" :disabled="cancellationLoading || !cancellationReason.trim()" @click="requestCancellation">Solicitar anulación</UiButton>
            </template>
            <div v-if="canReviewCancellation && cancellationRequest?.status === 'PENDIENTE'" class="flex flex-wrap gap-2">
              <UiButton type="button" :disabled="cancellationLoading" @click="reviewCancellation('APROBAR')">Aprobar anulación</UiButton>
              <UiButton type="button" variant="outline" :disabled="cancellationLoading" @click="reviewCancellation('RECHAZAR')">Rechazar anulación</UiButton>
            </div>
          </UiCardContent>
        </UiCard>
        <UiAlert v-if="isLocked" class="border-amber-200 bg-amber-50 text-amber-900">
          <UiAlertDescription>Esta matrícula está firmada. El registro es de solo lectura y no admite modificaciones.</UiAlertDescription>
        </UiAlert>
        <fieldset :disabled="isLocked" class="space-y-6">
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Datos del titular</UiCardTitle>
            <UiCardDescription>Información principal y ubicación de residencia.</UiCardDescription>
          </UiCardHeader>
          <UiCardContent class="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div class="space-y-2 lg:col-span-2">
              <UiLabel>Nombre completo</UiLabel>
              <UiInput v-model="form.holderName" required />
            </div>
            <div class="space-y-2">
              <UiLabel>DNI / CE</UiLabel>
              <DniLookupField v-model="form.holderDni" required @lookup="applyDniLookup('holder', $event)" />
            </div>
            <div class="space-y-2">
              <UiLabel>Fecha nacimiento</UiLabel>
              <UiDatePicker v-model="form.holderBirthDate" required />
            </div>
            <div class="space-y-2">
              <UiLabel>Email</UiLabel>
              <UiInput v-model="form.holderEmail" type="email" required />
            </div>
            <div class="space-y-2">
              <UiLabel>Celular</UiLabel>
              <UiInput v-model="form.holderPhone" required />
            </div>
            <div class="space-y-2 lg:col-span-2">
              <UiLabel>Dirección</UiLabel>
              <UiInput v-model="form.holderAddress" required />
            </div>
            <div class="space-y-2">
              <UiLabel>Departamento</UiLabel><UiSelect v-model="form.holderDepartment"><UiSelectTrigger class="w-full"><UiSelectValue placeholder="Seleccione..." /></UiSelectTrigger><UiSelectContent><UiSelectItem v-for="item in departments" :key="item" :value="item">{{ item }}</UiSelectItem></UiSelectContent></UiSelect>
            </div>
            <div class="space-y-2">
              <UiLabel>Provincia</UiLabel><UiSelect v-model="form.holderProvince"><UiSelectTrigger class="w-full"><UiSelectValue placeholder="Seleccione..." /></UiSelectTrigger><UiSelectContent><UiSelectItem v-for="item in holderProvinces" :key="item" :value="item">{{ item }}</UiSelectItem></UiSelectContent></UiSelect>
            </div>
            <div class="space-y-2">
              <UiLabel>Distrito</UiLabel><UiSelect v-model="form.holderDistrict"><UiSelectTrigger class="w-full"><UiSelectValue placeholder="Seleccione..." /></UiSelectTrigger><UiSelectContent><UiSelectItem v-for="item in holderDistricts" :key="item" :value="item">{{ item }}</UiSelectItem></UiSelectContent></UiSelect>
            </div>
            <div class="space-y-2">
              <UiLabel>Situación laboral</UiLabel>
              <UiInput v-model="form.currentSituation" />
            </div>
            <div class="space-y-2">
              <UiLabel>Tipo de vivienda</UiLabel>
              <UiInput v-model="form.housingType" />
            </div>
            <div class="space-y-2">
              <UiLabel>Estrategia</UiLabel>
              <UiSelect v-model="form.strategyId" required>
                <UiSelectTrigger class="w-full">
                  <UiSelectValue placeholder="Seleccione una estrategia" />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectItem v-for="item in strategies" :key="item.id" :value="item.id">{{ item.name }}</UiSelectItem>
                </UiSelectContent>
              </UiSelect>
            </div>
          </UiCardContent>
        </UiCard>
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Ubicación, beneficiarios y programa</UiCardTitle>
          </UiCardHeader>
          <UiCardContent class="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div class="space-y-2">
              <UiLabel>Departamento contrato</UiLabel><UiSelect v-model="form.contractDepartment"><UiSelectTrigger class="w-full"><UiSelectValue placeholder="Seleccione..." /></UiSelectTrigger><UiSelectContent><UiSelectItem v-for="item in departments" :key="item" :value="item">{{ item }}</UiSelectItem></UiSelectContent></UiSelect>
            </div>
            <div class="space-y-2">
              <UiLabel>Provincia contrato</UiLabel><UiSelect v-model="form.contractProvince"><UiSelectTrigger class="w-full"><UiSelectValue placeholder="Seleccione..." /></UiSelectTrigger><UiSelectContent><UiSelectItem value="Arequipa">Arequipa</UiSelectItem></UiSelectContent></UiSelect>
            </div>
            <div class="space-y-2">
              <UiLabel>Equipo comercial</UiLabel><UiSelect v-model="form.contractDistrict"><UiSelectTrigger class="w-full"><UiSelectValue placeholder="Seleccione..." /></UiSelectTrigger><UiSelectContent><UiSelectItem v-for="item in teams" :key="item.id" :value="item.name">{{ item.name }} · {{ item.site.name }}</UiSelectItem></UiSelectContent></UiSelect>
            </div>
            <div class="space-y-2">
              <UiLabel>Modalidad</UiLabel>
              <UiInput v-model="form.modality" required />
            </div>
            <div class="space-y-2">
              <UiLabel>Programa</UiLabel>
              <UiInput v-model="form.program" required />
            </div>
            <div class="space-y-2">
              <UiLabel>Plan</UiLabel>
              <UiInput v-model="form.plan" :disabled="!showPlan" />
            </div>
            <div class="space-y-2">
              <UiLabel>Inicio de pago</UiLabel>
              <UiInput v-model="form.paymentStartDate" />
            </div>
            <div class="space-y-2">
              <UiLabel>Modalidad de pago</UiLabel><UiSelect v-model="form.paymentMode"><UiSelectTrigger class="w-full"><UiSelectValue placeholder="Seleccione..." /></UiSelectTrigger><UiSelectContent><UiSelectItem value="contado">Contado</UiSelectItem><UiSelectItem value="financiado">Financiado</UiSelectItem></UiSelectContent></UiSelect>
            </div>
            <div v-for="(student, index) in form.students" :key="index"
              class="grid gap-3 rounded-lg border p-4 sm:col-span-2 sm:grid-cols-2">
              <div class="flex items-center justify-between sm:col-span-2">
                <p class="font-medium">Beneficiario {{ index + 1 }}</p>
                <UiButton v-if="form.students.length > 1" type="button" variant="outline" size="sm" @click="removeBeneficiary(index)">Eliminar</UiButton>
              </div>
              <UiInput v-model="student.name" placeholder="Nombre completo" />
              <DniLookupField v-model="student.dni" @lookup="applyDniLookup(index, $event)" />
              <UiDatePicker v-model="student.birthDate" />
              <UiInput v-model="student.email" type="email" placeholder="Email" />
              <UiInput v-model="student.phone" placeholder="Celular" />
            </div>
            <UiButton type="button" variant="outline" class="sm:col-span-2" @click="addBeneficiary">Agregar beneficiario</UiButton>
          </UiCardContent>
        </UiCard>
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Detalles económicos y autorizaciones</UiCardTitle>
          </UiCardHeader>
          <UiCardContent class="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div class="space-y-2">
              <UiLabel>Valor programa</UiLabel>
              <UiInput v-model="form.programValue" type="number" min="0" step="0.01" required />
            </div>
            <div class="space-y-2">
              <UiLabel>Cuota inicial</UiLabel>
              <UiInput v-model="form.initialPayment" type="number" min="0" step="0.01" />
            </div>
            <div class="space-y-2">
              <UiLabel>Saldo</UiLabel>
              <UiInput v-model="form.balance" type="number" readonly />
            </div>
            <div v-if="isFinanced" class="space-y-2">
              <UiLabel>Nro. cuotas</UiLabel><UiSelect v-model="form.installmentCount"><UiSelectTrigger class="w-full"><UiSelectValue /></UiSelectTrigger><UiSelectContent><UiSelectItem value="0">0</UiSelectItem><UiSelectItem v-for="item in installments" :key="item" :value="String(item)">{{ item }}</UiSelectItem></UiSelectContent></UiSelect>
            </div>
            <div v-if="isFinanced" class="space-y-2">
              <UiLabel>Valor cuota</UiLabel>
              <UiInput v-model="form.installmentValue" readonly />
            </div>
            <div class="space-y-2 sm:col-span-2 lg:col-span-4">
              <UiLabel>Observaciones</UiLabel>
              <UiTextarea v-model="form.notes" rows="3" />
            </div>
            <div class="space-y-4 sm:col-span-2 lg:col-span-4"><label class="flex items-center gap-3 text-sm">
                <UiCheckbox v-model="form.dataAuthorization" /> Autorización de uso de datos personales *
              </label><label class="flex items-center gap-3 text-sm">
                <UiCheckbox v-model="form.testimonials" /> Autorización para testimonios grabados
              </label><label class="flex items-center gap-3 text-sm">
                <UiCheckbox v-model="form.dataUsage" /> Autorización para uso de imagen y datos
              </label></div>
            <UiAlert v-if="error || success" :variant="error ? 'destructive' : 'default'"
              class="sm:col-span-2 lg:col-span-4">
              <UiAlertDescription>{{ error || success }}</UiAlertDescription>
            </UiAlert>
          </UiCardContent>
        </UiCard>
        </fieldset>
        <div class="flex justify-end gap-3">
          <UiButton variant="outline" as-child>
            <NuxtLink to="/matriculas">Cancelar</NuxtLink>
          </UiButton>
          <UiButton type="submit" class="gap-2" :disabled="saving || isLocked">
            <Save class="size-4" /> {{ isLocked ? 'Edición bloqueada' : saving ? 'Guardando…' : 'Guardar cambios' }}
          </UiButton>
        </div>
      </form>
    </main>
  </div>
</template>

<style scoped>
.select {
  height: 2.25rem;
  width: 100%;
  border: 1px solid var(--input);
  border-radius: 0.5rem;
  background: var(--background);
  padding: 0 0.625rem;
  font-size: 0.875rem;
}
</style>
