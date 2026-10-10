<script setup lang="ts">
import type { Component } from 'vue'
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarCheck, Check, CircleAlert, ClipboardList, CircleDollarSign, FileCheck2, FileClock, Users } from '@lucide/vue'

type Metric = { key: string; label: string; value: number; format: 'number' | 'currency' | 'percent' | 'days'; change: number | null; previousValue: number | null }
type TrendPoint = { label: string; registered: number; signed: number; commercial: number; verification: number; verified: number; appointments: number }
type Breakdown = { key: string; label: string; value: number }
type WorkItem = {
  id: string; contractId: string; contractNumber: string; holderName: string; holderDni: string; program: string; advisorName: string
  status: string; location: string; updatedAt: string; queueEnteredAt: string | null; appointmentAt: string | null
  appointmentType: string | null; observation: string | null; queueReason?: string | null; documentCount: number; missingDocuments: string[]
}
type Advisor = { id: string; name: string; total: number; signed: number; cancelled: number; contracted: number; signingRate: number }
type DashboardData = {
  role: string; period: number; summary: Record<string, number>; metrics: Metric[]; trend: TrendPoint[]
  contractStatusBreakdown: Breakdown[]; expedientStatusBreakdown: Breakdown[]
  locationBreakdown: Array<{ location: string; status: string; value: number }>
  priorities: Array<{ key: string; label: string; value: number; href: string }>; advisors: Advisor[]; workQueue: WorkItem[]
}

const props = defineProps<{ data: DashboardData }>()
const queueStatus = ref('')
const nf = new Intl.NumberFormat('es-PE')
const money = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(value || 0)
const formatMetric = (metric: Metric) => metric.format === 'currency' ? money(metric.value) : metric.format === 'percent' ? `${nf.format(metric.value)}%` : metric.format === 'days' ? `${nf.format(metric.value)} d` : nf.format(metric.value)
const statusLabels: Record<string, string> = { REVISION: 'En revisión', FIRMADO: 'Firmado', ANULADO: 'Anulado', CREADO: 'Por revisar', REBOTADO: 'Rebotado', AGENDADO: 'Cita programada', OBSERVADO: 'Con observaciones', VERIFICADO: 'Verificado' }
const locationLabels: Record<string, string> = { ASESOR: 'Asesor', SUPERVISOR: 'Supervisor', ASISTENTE_COMERCIAL: 'Asistente comercial', VERIFICACION: 'Verificación' }
const statusColors: Record<string, string> = { REVISION: '#86aee8', FIRMADO: '#c8102e', ANULADO: '#aebbd0', CREADO: '#4779cd', REBOTADO: '#ed8b9c', AGENDADO: '#7656ca', OBSERVADO: '#d36b36', VERIFICADO: '#1e9a72' }
const statusTone: Record<string, string> = { REVISION: 'bg-amber-50 text-amber-900', FIRMADO: 'bg-emerald-50 text-emerald-900', ANULADO: 'bg-slate-100 text-slate-800', ANULACION_PENDIENTE: 'bg-orange-50 text-orange-900', CREADO: 'bg-blue-50 text-blue-900', REBOTADO: 'bg-red-50 text-red-900', AGENDADO: 'bg-violet-50 text-violet-900', OBSERVADO: 'bg-orange-50 text-orange-900', VERIFICADO: 'bg-emerald-50 text-emerald-900' }
const fmtStatus = (key: string) => statusLabels[key] || key.replaceAll('_', ' ')
const changeLabel = (change: number) => `${change > 0 ? '+' : ''}${nf.format(change)}%`
const metricIcons: Record<string, Component> = { registrations: ClipboardList, signatures: FileCheck2, pendingSignatures: CircleAlert, signedValue: CircleDollarSign, commercialQueue: FileClock, commercialReturned: CircleAlert, queueAge: CalendarCheck, sentToVerification: ArrowRight, verificationQueue: FileClock, upcomingAppointments: CalendarCheck, overdueAppointments: CircleAlert, verified: FileCheck2 }
const changeIsGood = (key: string, change: number) => ['pendingSignatures', 'commercialReturned', 'overdueAppointments'].includes(key) ? change <= 0 : change >= 0

const chartSeries = computed(() => {
  if (['admin', 'supervisor', 'asesor'].includes(props.data.role)) return [
    { key: 'registered', label: 'Matrículas registradas', color: '#204bb3' },
    { key: 'signed', label: 'Contratos firmados', color: '#c8102e' }
  ]
  if (props.data.role === 'asistente_comercial') return [
    { key: 'commercial', label: 'Recibidos en Comercial', color: '#204bb3' },
    { key: 'verification', label: 'Derivados a Verificación', color: '#c8102e' }
  ]
  return [
    { key: 'appointments', label: 'Citas programadas', color: '#204bb3' },
    { key: 'verified', label: 'Expedientes verificados', color: '#1e9a72' }
  ]
})
const trendTitle = computed(() => props.data.role === 'asistente_comercial' ? 'Flujo de expedientes' : props.data.role === 'verificador' ? 'Agenda y verificaciones' : 'Matrículas y firmas')
const trendDescription = computed(() => props.data.role === 'asistente_comercial'
  ? `Recibidos en Comercial y derivados a Verificación · últimos ${props.data.period} días`
  : `Comparativo del periodo · últimos ${props.data.period} días`)
const trendDescriptionForRole = computed(() => props.data.role === 'verificador' ? `Citas programadas y expedientes cerrados · últimos ${props.data.period} días` : trendDescription.value)
const distributionTitle = computed(() => ['asistente_comercial', 'verificador'].includes(props.data.role) ? 'Expedientes por estado' : 'Estado de matrículas')
const distributionDescription = computed(() => ['asistente_comercial', 'verificador'].includes(props.data.role) ? `Stock actual en ${props.data.role === 'verificador' ? 'Verificación' : 'Comercial'}` : 'Distribución actual de contratos')
const distributionSegments = computed(() => {
  if (['asistente_comercial', 'verificador'].includes(props.data.role)) {
    const location = props.data.role === 'verificador' ? 'VERIFICACION' : 'ASISTENTE_COMERCIAL'
    return props.data.locationBreakdown.filter((item) => item.location === location).map((item) => ({ key: item.status, label: fmtStatus(item.status), value: item.value, color: statusColors[item.status] || '#758195' }))
  }
  return props.data.contractStatusBreakdown.map((item) => ({ key: item.key, label: fmtStatus(item.key), value: item.value, color: statusColors[item.key] || '#758195' }))
})
const stageGroups = computed(() => {
  const activeLocations = ['ASESOR', 'SUPERVISOR', 'ASISTENTE_COMERCIAL', 'VERIFICACION']
  const activeStages = activeLocations.map((location) => {
    const rows = props.data.locationBreakdown.filter((item) => item.location === location && item.status !== 'VERIFICADO')
    return { key: location, label: locationLabels[location], value: rows.reduce((sum, item) => sum + item.value, 0), rows }
  })
  const closedCount = props.data.expedientStatusBreakdown.find((item) => item.key === 'VERIFICADO')?.value || 0
  return [...activeStages, { key: 'CIERRE', label: 'Verificado / cerrado', value: closedCount, rows: [] }].filter((stage) => stage.value > 0)
})
const maxStageValue = computed(() => Math.max(...stageGroups.value.map((stage) => stage.value), 1))
const queueTitle = computed(() => ({ admin: 'Cola de trabajo', supervisor: 'Cola de trabajo del equipo', asesor: 'Mi cola de trabajo', asistente_comercial: 'Expedientes por procesar', verificador: 'Agenda de verificación' }[props.data.role] || 'Pendientes'))
const queueDescription = computed(() => ({ admin: 'Solicitudes ordenadas por tiempo en espera y urgencia.', supervisor: 'Casos de tus asesores con una siguiente acción pendiente.', asesor: 'Rebotes, contratos por firmar y expedientes por completar.', asistente_comercial: 'Revisa documentación y deriva los expedientes completos.', verificador: 'Citas y expedientes pendientes ordenados por prioridad.' }[props.data.role] || 'Casos pendientes de gestión.'))
const queueStatuses = computed(() => [...new Set(props.data.workQueue.map((item) => item.status))])
const filteredWorkQueue = computed(() => queueStatus.value ? props.data.workQueue.filter((item) => item.status === queueStatus.value) : props.data.workQueue)
const ageDays = (item: WorkItem) => Math.max(0, Math.floor((Date.now() - new Date(item.queueEnteredAt || item.updatedAt).getTime()) / 86400000))
const ageLabel = (item: WorkItem) => ageDays(item) === 0 ? 'Hoy' : `${ageDays(item)} días`
const appointmentLabel = (value: string) => new Date(value).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })
const queueHref = (item: WorkItem) => item.location === 'ASESOR' ? `/matricula/${item.contractId}` : `/expedientes/${item.id}`
</script>

<template>
  <div class="space-y-4">
    <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4" aria-label="Indicadores principales">
      <UiCard v-for="(metric, index) in data.metrics" :key="metric.key" class="overflow-hidden rounded-lg border-slate-200 bg-white shadow-none transition-colors hover:border-slate-300">
        <UiCardContent class="flex min-h-[112px] items-center gap-4 p-4 sm:p-[17px]">
          <span class="grid size-[54px] shrink-0 place-items-center rounded-lg" :class="index === 1 ? 'bg-blue-50 text-[#0875ee]' : index === 2 ? 'bg-rose-50 text-[#df2445]' : index === 3 ? 'bg-amber-50 text-[#ed8500]' : 'bg-blue-50 text-[#0875ee]'"><component :is="metricIcons[metric.key] || ClipboardList" class="size-7" /></span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-medium text-slate-700">{{ metric.label }}</p>
            <div class="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <strong class="text-[25px] font-semibold leading-7 tracking-[-.025em] tabular-nums text-[#000051]">{{ formatMetric(metric) }}</strong>
              <span v-if="metric.change !== null" class="inline-flex items-center gap-0.5 text-xs font-semibold" :class="changeIsGood(metric.key, metric.change) ? 'text-emerald-700' : 'text-rose-700'">
                <ArrowUpRight v-if="metric.change >= 0" class="size-3.5" /><ArrowDownRight v-else class="size-3.5" />{{ changeLabel(metric.change) }}
              </span>
            </div>
            <p class="mt-1 truncate text-[11px] leading-4 text-slate-500">
              {{ metric.previousValue !== null ? `vs. periodo anterior (${formatMetric({ ...metric, value: metric.previousValue })})` : metric.key === 'queueAge' ? 'Días desde la derivación a Comercial' : metric.key === 'upcomingAppointments' ? 'Citas no cerradas hasta dentro de 7 días' : metric.key === 'overdueAppointments' ? 'Citas agendadas cuya fecha ya pasó' : metric.key === 'pendingSignatures' ? 'En revisión frente al periodo anterior' : 'Casos actuales que requieren seguimiento' }}
            </p>
          </div>
        </UiCardContent>
      </UiCard>
    </section>

    <section class="grid items-stretch gap-3 xl:grid-cols-12">
      <div class="min-w-0 xl:col-span-7 2xl:col-span-6"><DashboardTrendChart :points="data.trend" :series="chartSeries" :title="trendTitle" :description="data.role === 'verificador' ? trendDescriptionForRole : trendDescription" /></div>
      <div class="min-w-0 xl:col-span-5 2xl:col-span-2"><DashboardDonutChart :title="distributionTitle" :description="distributionDescription" :segments="distributionSegments" /></div>
      <div class="grid min-w-0 gap-3 xl:col-span-12 xl:grid-cols-2 2xl:col-span-4 2xl:grid-cols-1" :class="['admin','supervisor'].includes(data.role) ? '2xl:grid-rows-[minmax(168px,.8fr)_minmax(238px,1.2fr)]' : ''">
        <UiCard class="overflow-hidden rounded-lg border-slate-200 bg-white shadow-none">
          <UiCardHeader class="px-4 pb-1 pt-4"><UiCardTitle class="text-[15px] font-semibold text-[#000051]">Expedientes por etapa</UiCardTitle><UiCardDescription class="text-xs">Casos según el responsable actual.</UiCardDescription></UiCardHeader>
          <UiCardContent class="space-y-2 px-4 pb-4 pt-2">
            <div v-for="stage in stageGroups" :key="stage.key" class="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-2">
              <span class="truncate text-xs text-slate-700">{{ stage.label }}</span>
              <div class="h-2.5 overflow-hidden rounded-[3px] bg-slate-100"><span class="block h-full rounded-[3px] bg-[#2878df]" :style="{ width: `${Math.max(stage.value / maxStageValue * 100, stage.value ? 2 : 0)}%` }" /></div>
              <strong class="text-right text-xs font-semibold tabular-nums text-[#000051]">{{ nf.format(stage.value) }}</strong>
            </div>
            <p v-if="!stageGroups.length" class="py-3 text-xs text-slate-500">Sin expedientes registrados.</p>
          </UiCardContent>
        </UiCard>

        <UiCard v-if="['admin','supervisor'].includes(data.role)" id="rendimiento-asesores" class="overflow-hidden rounded-lg border-slate-200 bg-white shadow-none">
          <UiCardHeader class="px-4 pb-2 pt-4"><div class="flex items-center justify-between"><div><UiCardTitle class="text-[15px] font-semibold text-[#000051]">Rendimiento de asesores</UiCardTitle><UiCardDescription class="text-xs">Matrículas, firmas, conversión y valor contratado.</UiCardDescription></div><Users class="size-5 text-[#204bb3]" /></div></UiCardHeader>
          <UiCardContent class="p-0">
            <div v-if="data.advisors.length" class="overflow-x-auto">
              <table class="w-full min-w-[360px] text-left text-[11px]">
                <thead class="border-y border-slate-200 bg-slate-50 text-[10px] text-slate-600"><tr><th class="px-2 py-2 font-semibold">Asesor</th><th class="px-1.5 py-2 text-right font-semibold">Matr.</th><th class="px-1.5 py-2 text-right font-semibold">Firmas</th><th class="px-1.5 py-2 text-right font-semibold">Conv.</th><th class="px-2 py-2 text-right font-semibold">Valor</th></tr></thead>
                <tbody><tr v-for="advisor in [...data.advisors].sort((a, b) => b.signed - a.signed).slice(0, 5)" :key="advisor.id" class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td class="max-w-24 truncate px-2 py-2.5 font-medium text-slate-800" :title="advisor.name">{{ advisor.name }}</td><td class="px-1.5 py-2.5 text-right tabular-nums text-slate-700">{{ nf.format(advisor.total) }}</td><td class="px-1.5 py-2.5 text-right font-semibold tabular-nums text-slate-900">{{ nf.format(advisor.signed) }}</td><td class="px-1.5 py-2.5 text-right tabular-nums text-slate-700">{{ advisor.signingRate }}%</td><td class="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-slate-700">{{ money(advisor.contracted) }}</td>
                </tr></tbody>
              </table>
            </div>
            <p v-else class="px-4 py-5 text-xs text-slate-500">No hay matrículas en este periodo para comparar.</p>
          </UiCardContent>
        </UiCard>
      </div>
    </section>

    <section class="space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div><h2 class="text-lg font-semibold tracking-tight text-[#000051]">{{ queueTitle }}</h2><p class="mt-1 text-sm text-slate-600">{{ queueDescription }}</p></div>
        <div class="flex flex-wrap items-center gap-3">
          <label for="dashboard-queue-status" class="sr-only">Filtrar cola por estado</label>
          <select id="dashboard-queue-status" v-model="queueStatus" class="h-9 min-w-40 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
            <option value="">Todos los estados</option>
            <option v-for="status in queueStatuses" :key="status" :value="status">{{ status === 'ANULACION_PENDIENTE' ? 'Anulación solicitada' : fmtStatus(status) }}</option>
          </select>
          <NuxtLink :to="['asistente_comercial','verificador'].includes(data.role) ? '/expedientes' : '/matricula'" class="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Ver cola completa <ArrowRight class="size-4" /></NuxtLink>
        </div>
      </div>
      <UiCard class="overflow-hidden rounded-lg border-slate-200 bg-white shadow-none">
        <UiCardContent class="p-0">
          <div v-if="data.workQueue.length" class="overflow-x-auto">
            <table class="w-full min-w-[1050px] text-left text-sm">
              <thead class="border-b border-slate-200 bg-[#f0f3f8] text-[11px] text-[#000051]"><tr><th class="px-3 py-2.5 font-semibold">Estudiante / titular</th><th class="px-3 py-2.5 font-semibold">DNI</th><th class="px-3 py-2.5 font-semibold">Programa</th><th v-if="['admin','supervisor'].includes(data.role)" class="px-3 py-2.5 font-semibold">Asesor asignado</th><th class="px-3 py-2.5 font-semibold">Estado actual</th><th v-if="['asistente_comercial','verificador'].includes(data.role)" class="px-3 py-2.5 font-semibold">Documentación / cita</th><th class="px-3 py-2.5 font-semibold">Días en espera</th><th class="px-3 py-2.5 font-semibold">Última actividad</th><th class="px-3 py-2.5 text-right font-semibold">Acciones</th></tr></thead>
              <tbody><tr v-for="item in filteredWorkQueue.slice(0, 5)" :key="item.id" class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td class="px-3 py-2.5"><span class="block font-semibold text-slate-900">{{ item.holderName }}</span><span class="mt-0.5 block text-xs text-slate-600">{{ item.contractNumber }}</span></td>
                <td class="whitespace-nowrap px-3 py-2.5 text-[13px] text-slate-800">{{ item.holderDni }}</td>
                <td class="px-3 py-2.5 text-[13px] text-slate-800">{{ item.program }}</td>
                <td v-if="['admin','supervisor'].includes(data.role)" class="px-3 py-2.5 text-[13px] text-slate-800">{{ item.advisorName }}</td>
                <td class="px-3 py-2.5"><span class="inline-flex rounded-full px-2 py-1 text-[11px] font-semibold" :class="statusTone[item.status] || 'bg-slate-100 text-slate-800'">{{ item.status === 'ANULACION_PENDIENTE' ? 'Anulación solicitada' : fmtStatus(item.status) }}</span><span v-if="item.queueReason || item.observation" class="mt-1 block max-w-[18rem] truncate text-xs text-slate-700">{{ item.queueReason || item.observation }}</span></td>
                <td v-if="['asistente_comercial','verificador'].includes(data.role)" class="px-3 py-2.5 text-xs text-slate-700"><template v-if="data.role === 'asistente_comercial'"><span :class="item.missingDocuments.length ? 'font-semibold text-amber-900' : 'text-emerald-900'">{{ item.missingDocuments.length ? `Falta ${item.missingDocuments.join(', ')}` : `${item.documentCount} documentos cargados` }}</span></template><template v-else><span>{{ item.appointmentAt ? appointmentLabel(item.appointmentAt) : 'Sin cita programada' }}</span><span v-if="item.appointmentType" class="mt-1 block text-slate-600">{{ item.appointmentType }}</span></template></td>
                <td class="whitespace-nowrap px-3 py-2.5"><span class="inline-flex items-center gap-1.5 text-xs font-medium tabular-nums" :class="ageDays(item) >= 7 ? 'text-red-800' : 'text-slate-700'"><CircleAlert v-if="ageDays(item) >= 7" class="size-3.5" />{{ ageLabel(item) }}</span></td>
                <td class="whitespace-nowrap px-3 py-2.5 text-xs text-slate-700">{{ new Date(item.updatedAt).toLocaleDateString('es-PE') }}</td>
                <td class="whitespace-nowrap px-3 py-2.5 text-right"><NuxtLink :to="queueHref(item)" class="inline-flex items-center gap-1 text-xs font-semibold text-[#0754c9] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Ver detalle <ArrowRight class="size-3.5" /></NuxtLink></td>
              </tr></tbody>
            </table>
          </div>
          <div v-else class="flex min-h-52 flex-col items-center justify-center px-6 text-center"><span class="mb-3 grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-800"><Check class="size-5" /></span><p class="font-semibold text-slate-900">{{ queueStatus ? 'No hay casos con ese estado' : 'No hay casos pendientes' }}</p><p class="mt-1 max-w-md text-sm text-slate-700">{{ queueStatus ? 'Elige otro estado para consultar la cola.' : 'La tabla se llenará con los casos que requieran una acción de tu rol.' }}</p></div>
        </UiCardContent>
      </UiCard>
    </section>

  </div>
</template>
