<script setup lang="ts">
import { ArrowLeft, Save } from '@lucide/vue'

definePageMeta({ middleware: 'auth', ssr: false })

const strategies = ['Lead de Fb.', 'Lead de Instagram.', 'Lead de Tiktok.', 'Referido.', 'Cadena de referido.', 'Webinar.', 'Página web.', 'Panel.', 'Pesquisa.', 'Módulo', 'Convenio', 'Informe de oficina', 'Influencer', 'Mercado natural', 'Remarketing', 'Feria', 'Base de datos', 'LinkedIn']
const departments = ['Amazonas', 'Ancash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco', 'Huancavelica', 'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 'Loreto', 'Madre de Dios', 'Moquegua', 'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali']
const residenceDistricts = ['Arequipa', 'Alto Selva Alegre', 'Cayma', 'Cerro Colorado', 'Characato', 'Jacobo Hunter', 'José Luis Bustamante y Rivero', 'Mariano Melgar', 'Miraflores', 'Paucarpata', 'Sabandía', 'Sachaca', 'Socabaya', 'Tiabaya', 'Yanahuara', 'Yura', 'La Joya']
const teams = ['Yanahuara', 'José Luis Bustamante y Rivero', 'Virtual']
const installments = Array.from({ length: 13 }, (_, index) => index + 2)

const form = reactive({
  contractDepartment: 'Arequipa', contractProvince: 'Arequipa', contractDistrict: '',
  holderName: '', holderBirthDate: '', holderDni: '', holderEmail: '', holderAddress: '', holderDepartment: '', holderProvince: '', holderDistrict: '', holderPhone: '',
  beneficiary1Name: '', beneficiary1BirthDate: '', beneficiary1Dni: '', beneficiary1Email: '', beneficiary1Phone: '', beneficiary2Name: '', beneficiary2BirthDate: '', beneficiary2Dni: '', beneficiary2Email: '', beneficiary2Phone: '',
  currentSituation: 'Empleado', housingType: 'Propia', strategy: '', paymentStartDate: '', modality: '', program: '', plan: '', paymentMode: '', programValue: '', initialPayment: '0', balance: '0', installmentCount: '0', installmentValue: '0', otherPayment: '0', notes: '', dataAuthorization: false, testimonials: false, dataUsage: false,
})

const saving = ref(false)
const formError = ref('')
const { csrfHeaders } = useAuth()
const today = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' }).format(new Date())
const isCash = computed(() => form.paymentMode === 'contado')
const isFinanced = computed(() => form.paymentMode === 'financiado')
const showPlan = computed(() => form.program !== '' && form.program !== 'Kids')

const calculateAmounts = () => {
  const programValue = Number(form.programValue) || 0
  const initial = Number(form.initialPayment) || 0
  if (isCash.value) {
    const discount = Number(form.otherPayment) || 0
    form.initialPayment = Math.max(programValue - discount, 0).toFixed(2)
    form.balance = '0.00'
    form.installmentCount = '0'
    form.installmentValue = '0.00'
  } else if (isFinanced.value) {
    const balance = Math.max(programValue - initial, 0)
    form.balance = balance.toFixed(2)
    form.installmentValue = form.installmentCount && Number(form.installmentCount) > 0 ? (balance / Number(form.installmentCount)).toFixed(2) : '0.00'
  }
}

const calculatePrice = () => {
  if (!isCash.value) return
  if (form.program === 'Kids') form.programValue = '5900.00'
  else if (form.program === 'Paquete Integral') {
    const prices = form.modality === 'Virtual' ? { Light: 5310, Elite: 6210, Premium: 7110 } : { Light: 5900, Elite: 6900, Premium: 7900 }
    form.programValue = String(prices[form.plan as keyof typeof prices] || '')
  } else if (['Nivel Básico', 'Nivel Intermedio', 'Nivel Avanzado'].includes(form.program)) {
    const prices = form.modality === 'Virtual' ? { Light: 2250, Elite: 2520, Premium: 2700 } : { Light: 2500, Elite: 2800, Premium: 3000 }
    form.programValue = String(prices[form.plan as keyof typeof prices] || '')
  }
  calculateAmounts()
}

watch(() => [form.paymentMode, form.program, form.plan, form.modality], () => {
  if (form.program === 'Kids') form.plan = ''
  if (isCash.value) calculatePrice()
  else if (isFinanced.value) calculateAmounts()
})
watch(() => [form.programValue, form.initialPayment, form.installmentCount, form.otherPayment], calculateAmounts)

const handleSubmit = async () => {
  if (saving.value) return
  formError.value = ''
  if (!form.dataAuthorization) {
    formError.value = 'Debes aceptar la autorización de uso de datos personales para continuar.'
    return
  }
  saving.value = true
  try {
    await $fetch('/api/contracts', {
      method: 'POST',
      headers: await csrfHeaders(),
      credentials: 'include',
      body: form,
    })
    await navigateTo('/matriculas')
  } catch (error: any) {
    formError.value = error?.data?.statusMessage || error?.data?.message || 'No pudimos registrar la matrícula.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader title="Nueva matrícula" subtitle="Registro de una nueva matrícula" back-to="/matriculas" />
    <main class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p class="text-sm font-medium text-primary">Formulario de matrícula</p><h1 class="mt-1 text-3xl font-semibold tracking-tight">Registrar nueva matrícula</h1><p class="mt-2 max-w-3xl text-muted-foreground">Completa todos los datos del formulario original. El número de matrícula se asignará automáticamente al guardar.</p></div><UiButton variant="outline" as-child class="gap-2"><NuxtLink to="/matriculas"><ArrowLeft class="size-4" /> Ver matrículas</NuxtLink></UiButton></section>

      <form class="space-y-6" @submit.prevent="handleSubmit">
        <UiCard><UiCardHeader class="border-b bg-muted/30"><UiCardTitle>Información de registro</UiCardTitle><UiCardDescription>Estos valores se generan automáticamente al registrar la matrícula.</UiCardDescription></UiCardHeader><UiCardContent class="grid gap-5 p-6 sm:grid-cols-2"><div class="rounded-lg border bg-muted/30 p-4"><p class="text-xs font-semibold uppercase tracking-[.16em] text-primary">Nro. de matrícula</p><p class="mt-2 text-lg font-semibold">AUTOGENERADO</p><p class="mt-1 text-sm text-muted-foreground">Se asignará al guardar.</p></div><div class="rounded-lg border bg-muted/30 p-4"><p class="text-xs font-semibold uppercase tracking-[.16em] text-primary">Fecha de registro</p><p class="mt-2 text-lg font-semibold">{{ today }}</p><p class="mt-1 text-sm text-muted-foreground">Fecha actual del sistema.</p></div></UiCardContent></UiCard>

        <UiCard><UiCardHeader><UiCardTitle>Ubicación del contrato</UiCardTitle><UiCardDescription>Datos comerciales utilizados por el sistema anterior.</UiCardDescription></UiCardHeader><UiCardContent class="grid gap-5 p-6 sm:grid-cols-3"><div class="space-y-2"><UiLabel for="contractDepartment">Departamento contrato *</UiLabel><select id="contractDepartment" v-model="form.contractDepartment" required class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option v-for="item in departments" :key="item" :value="item">{{ item }}</option></select></div><div class="space-y-2"><UiLabel for="contractProvince">Provincia contrato *</UiLabel><select id="contractProvince" v-model="form.contractProvince" required class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="Arequipa">Arequipa</option></select></div><div class="space-y-2"><UiLabel for="contractDistrict">Equipo comercial *</UiLabel><select id="contractDistrict" v-model="form.contractDistrict" required class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="" disabled>Seleccione equipo</option><option v-for="item in teams" :key="item" :value="item">Equipo {{ item }}</option></select></div></UiCardContent></UiCard>

        <UiCard><UiCardHeader><UiCardTitle>Datos del titular</UiCardTitle><UiCardDescription>Información principal de la persona que suscribe la matrícula.</UiCardDescription></UiCardHeader><UiCardContent class="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4"><div class="space-y-2 lg:col-span-2"><UiLabel for="holderName">Nombre completo *</UiLabel><UiInput id="holderName" v-model="form.holderName" required /></div><div class="space-y-2"><UiLabel for="holderDni">DNI / CE *</UiLabel><UiInput id="holderDni" v-model="form.holderDni" required /></div><div class="space-y-2"><UiLabel for="holderBirthDate">Fecha nacimiento *</UiLabel><UiInput id="holderBirthDate" v-model="form.holderBirthDate" required type="date" /></div><div class="space-y-2"><UiLabel for="holderEmail">Email *</UiLabel><UiInput id="holderEmail" v-model="form.holderEmail" required type="email" /></div><div class="space-y-2"><UiLabel for="holderPhone">Celular *</UiLabel><UiInput id="holderPhone" v-model="form.holderPhone" required type="tel" /></div><div class="space-y-2 lg:col-span-2"><UiLabel for="holderAddress">Dirección *</UiLabel><UiInput id="holderAddress" v-model="form.holderAddress" required /></div><div class="space-y-2"><UiLabel for="holderDepartment">Departamento residencia *</UiLabel><select id="holderDepartment" v-model="form.holderDepartment" required class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="" disabled>Seleccione...</option><option v-for="item in departments" :key="item" :value="item">{{ item }}</option></select></div><div class="space-y-2"><UiLabel for="holderProvince">Provincia residencia *</UiLabel><select id="holderProvince" v-model="form.holderProvince" required class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="" disabled>Seleccione...</option><option value="Arequipa">Arequipa</option></select></div><div class="space-y-2"><UiLabel for="holderDistrict">Distrito residencia *</UiLabel><select id="holderDistrict" v-model="form.holderDistrict" required class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="" disabled>Seleccione...</option><option v-for="item in residenceDistricts" :key="item" :value="item">{{ item }}</option></select></div><div class="space-y-2"><UiLabel for="strategy">Estrategia *</UiLabel><select id="strategy" v-model="form.strategy" required class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="" disabled>Seleccione...</option><option v-for="item in strategies" :key="item" :value="item">{{ item }}</option></select></div><div class="space-y-2"><UiLabel for="currentSituation">Situación laboral</UiLabel><select id="currentSituation" v-model="form.currentSituation" class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option>Empleado</option><option>Independiente</option><option>Hogar</option></select></div><div class="space-y-2"><UiLabel for="housingType">Tipo de vivienda</UiLabel><select id="housingType" v-model="form.housingType" class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option>Propia</option><option>Arriendo</option><option>Familiar</option></select></div></UiCardContent></UiCard>

        <div class="grid gap-6 lg:grid-cols-2"><UiCard v-for="number in [1, 2]" :key="number"><UiCardHeader><UiCardTitle>Beneficiario {{ number }}</UiCardTitle><UiCardDescription>Datos opcionales del beneficiario.</UiCardDescription></UiCardHeader><UiCardContent class="grid gap-5 p-6 sm:grid-cols-2"><div class="space-y-2 sm:col-span-2"><UiLabel :for="`beneficiary${number}Name`">Nombre completo</UiLabel><UiInput :id="`beneficiary${number}Name`" v-model="form[`beneficiary${number}Name` as 'beneficiary1Name' | 'beneficiary2Name']" /></div><div class="space-y-2"><UiLabel :for="`beneficiary${number}BirthDate`">Fecha nacimiento</UiLabel><UiInput :id="`beneficiary${number}BirthDate`" v-model="form[`beneficiary${number}BirthDate` as 'beneficiary1BirthDate' | 'beneficiary2BirthDate']" type="date" /></div><div class="space-y-2"><UiLabel :for="`beneficiary${number}Dni`">DNI / CE</UiLabel><UiInput :id="`beneficiary${number}Dni`" v-model="form[`beneficiary${number}Dni` as 'beneficiary1Dni' | 'beneficiary2Dni']" /></div><div class="space-y-2"><UiLabel :for="`beneficiary${number}Email`">Email</UiLabel><UiInput :id="`beneficiary${number}Email`" v-model="form[`beneficiary${number}Email` as 'beneficiary1Email' | 'beneficiary2Email']" type="email" /></div><div class="space-y-2"><UiLabel :for="`beneficiary${number}Phone`">Celular</UiLabel><UiInput :id="`beneficiary${number}Phone`" v-model="form[`beneficiary${number}Phone` as 'beneficiary1Phone' | 'beneficiary2Phone']" type="tel" /></div></UiCardContent></UiCard></div>

        <UiCard><UiCardHeader><UiCardTitle>Información del programa</UiCardTitle><UiCardDescription>Las opciones y el plan siguen la lógica del formulario anterior.</UiCardDescription></UiCardHeader><UiCardContent class="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4"><div class="space-y-2"><UiLabel for="modality">Modalidad *</UiLabel><select id="modality" v-model="form.modality" required class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="" disabled>Seleccione...</option><option>Presencial</option><option>Virtual</option><option>Híbrido</option></select></div><div class="space-y-2"><UiLabel for="program">Programa *</UiLabel><select id="program" v-model="form.program" required class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="" disabled>Seleccione...</option><option>Paquete Integral</option><option>Nivel Básico</option><option>Nivel Intermedio</option><option>Nivel Avanzado</option><option>Kids</option></select></div><div v-if="showPlan" class="space-y-2"><UiLabel for="plan">Plan *</UiLabel><select id="plan" v-model="form.plan" :required="showPlan" class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="" disabled>Seleccione...</option><option>Light</option><option>Elite</option><option>Premium</option></select></div><div class="space-y-2"><UiLabel>Modalidad de pago *</UiLabel><div class="flex h-9 items-center gap-5 text-sm"><label class="flex items-center gap-2"><input v-model="form.paymentMode" type="radio" value="contado" required /> Contado</label><label class="flex items-center gap-2"><input v-model="form.paymentMode" type="radio" value="financiado" required /> Financiado</label></div></div><div v-if="isFinanced" class="space-y-2"><UiLabel for="paymentStartDate">Fecha inicio de pago *</UiLabel><select id="paymentStartDate" v-model="form.paymentStartDate" :required="isFinanced" class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="" disabled>Seleccione...</option><option value="05">Día 05</option><option value="15">Día 15</option><option value="30">Día 30</option></select></div></UiCardContent></UiCard>

        <UiCard><UiCardHeader><UiCardTitle>Detalles económicos</UiCardTitle><UiCardDescription>Los importes se calculan automáticamente cuando corresponde.</UiCardDescription></UiCardHeader><UiCardContent class="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-6"><div class="space-y-2 lg:col-span-2"><UiLabel for="programValue">Valor programa (S/) *</UiLabel><UiInput id="programValue" v-model="form.programValue" required type="number" min="0" step="0.01" :readonly="isCash" @input="calculateAmounts" /></div><div class="space-y-2 lg:col-span-2"><UiLabel for="initialPayment">Cuota inicial (S/)</UiLabel><UiInput id="initialPayment" v-model="form.initialPayment" type="number" min="0" step="0.01" :readonly="isCash" @input="calculateAmounts" /></div><div class="space-y-2 lg:col-span-2"><UiLabel for="balance">Saldo (S/)</UiLabel><UiInput id="balance" v-model="form.balance" type="number" min="0" step="0.01" readonly /></div><div v-if="isFinanced" class="space-y-2 lg:col-span-2"><UiLabel for="installmentCount">Nro. cuotas</UiLabel><select id="installmentCount" v-model="form.installmentCount" class="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="0">0 cuotas</option><option v-for="item in installments" :key="item" :value="String(item)">{{ item }} cuotas</option></select></div><div v-if="isFinanced" class="space-y-2 lg:col-span-2"><UiLabel for="installmentValue">Valor cuota (S/)</UiLabel><UiInput id="installmentValue" v-model="form.installmentValue" type="number" readonly /></div><div v-if="isCash" class="space-y-2 lg:col-span-2"><UiLabel for="otherPayment">Descuento</UiLabel><UiInput id="otherPayment" v-model="form.otherPayment" type="number" min="0" step="0.01" /></div><div class="space-y-2 sm:col-span-2 lg:col-span-6"><UiLabel for="notes">Observaciones</UiLabel><UiTextarea id="notes" v-model="form.notes" rows="3" placeholder="Ingrese observaciones adicionales (opcional)" /></div></UiCardContent></UiCard>

        <UiCard><UiCardHeader><UiCardTitle>Autorizaciones</UiCardTitle><UiCardDescription>Lee cada autorización antes de continuar.</UiCardDescription></UiCardHeader><UiCardContent class="space-y-5 p-6"><label class="flex items-start gap-3 text-sm leading-6"><UiCheckbox v-model="form.dataAuthorization" required /><span>Autorización y refrendación de uso de datos personales <span class="text-destructive">*</span></span></label><label class="flex items-start gap-3 text-sm leading-6"><UiCheckbox v-model="form.testimonials" /><span>Acepto proporcionar testimonios grabados en español al concluir la unidad 16 y en inglés al terminar la unidad 36. Autorizo a Brighton Inglés Nativo S.A.C. para publicar estos videos testimoniales en sus redes sociales, plataformas digitales y medios de difusión con fines promocionales y educativos.</span></label><label class="flex items-start gap-3 text-sm leading-6"><UiCheckbox v-model="form.dataUsage" /><span>Autorizo expresamente a Brighton Inglés Nativo S.A.C. para el uso de mis datos personales, fotografías, videos y grabaciones de audio en campañas publicitarias difundidas a través de internet, redes sociales, medios televisivos, radiales y cualquier otro medio de comunicación, con la finalidad exclusiva de promover los servicios educativos de la institución.</span></label><UiAlert v-if="formError" variant="destructive"><UiAlertDescription>{{ formError }}</UiAlertDescription></UiAlert></UiCardContent></UiCard>

        <div class="flex flex-col-reverse justify-end gap-3 sm:flex-row"><UiButton variant="outline" type="button" as-child><NuxtLink to="/matriculas">Cancelar</NuxtLink></UiButton><UiButton type="submit" class="gap-2" :disabled="saving"><Save class="size-4" />{{ saving ? 'Guardando…' : 'Registrar matrícula' }}</UiButton></div>
      </form>
    </main>
  </div>
</template>
