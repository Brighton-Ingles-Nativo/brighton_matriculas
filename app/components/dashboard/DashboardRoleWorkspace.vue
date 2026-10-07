<script setup lang="ts">
import { ArrowDownRight, ArrowRight, CalendarClock, Check, CircleAlert, ClipboardList, FileCheck2, FolderClock, Users } from '@lucide/vue'

interface WorkItem {
  id: string
  contractId: string
  contractNumber: string
  holderName: string
  holderDni: string
  advisorName: string
  status: string
  location: string
  updatedAt: string
  appointmentAt: string | null
  appointmentType: string | null
  observation: string | null
  documentCount: number
  missingDocuments: string[]
}
interface Advisor { id: string; name: string; total: number; signed: number; cancelled: number; contracted: number }
interface DashboardData {
  role: string
  summary: Record<string, number>
  metrics: Array<{ key: string; label: string; value: number; format: 'number' | 'currency' }>
  pipeline: Array<{ key: string; label: string; value: number }>
  priorities: Array<{ key: string; label: string; value: number; href: string }>
  advisors: Advisor[]
  workQueue: WorkItem[]
}

const props = defineProps<{ data: DashboardData }>()
const money = (value?: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(value || 0)
const number = (value?: number) => new Intl.NumberFormat('es-PE').format(value || 0)
const maxAdvisor = computed(() => Math.max(...props.data.advisors.map((item) => item.signed), 1))
const maxPipeline = computed(() => Math.max(...props.data.pipeline.map((item) => item.value), 1))
const statusLabel = (status: string) => ({ REVISION: 'En revisión', FIRMADO: 'Firmada', ANULADO: 'Anulada', ANULACION_PENDIENTE: 'Anulación solicitada', CREADO: 'Por revisar', REBOTADO: 'Rebotado', AGENDADO: 'Cita programada', OBSERVADO: 'Con observaciones', VERIFICADO: 'Verificado' }[status] || status.replaceAll('_', ' '))
const statusClass = (status: string) => ({ REVISION: 'bg-amber-50 text-amber-800', FIRMADO: 'bg-emerald-50 text-emerald-800', ANULADO: 'bg-slate-100 text-slate-700', ANULACION_PENDIENTE: 'bg-orange-50 text-orange-900', CREADO: 'bg-blue-50 text-blue-800', REBOTADO: 'bg-red-50 text-red-800', AGENDADO: 'bg-violet-50 text-violet-800', OBSERVADO: 'bg-orange-50 text-orange-800', VERIFICADO: 'bg-emerald-50 text-emerald-800' }[status] || 'bg-slate-100 text-slate-700')
const queueHref = (item: WorkItem) => item.location === 'ASESOR' ? `/matricula/${item.contractId}` : `/expedientes/${item.id}`
const queueHeading = computed(() => ({ admin: 'Pendientes de gestión', supervisor: 'Pendientes de mi equipo', asesor: 'Lo que requiere mi atención', asistente_comercial: 'Bandeja de expedientes', verificador: 'Agenda de verificación' }[props.data.role] || 'Pendientes'))
const queueSubheading = computed(() => ({ admin: 'Casos abiertos ordenados por antigüedad.', supervisor: 'Casos abiertos de los asesores bajo tu supervisión.', asesor: 'Contratos y expedientes que necesitan seguimiento.', asistente_comercial: 'Revisa documentos y deriva expedientes completos.', verificador: 'Prioriza las citas más próximas y los casos observados.' }[props.data.role] || 'Casos abiertos del sistema.'))
const queueEmpty = computed(() => ({ admin: 'No hay casos pendientes. La operación está al día.', supervisor: 'Tu equipo no tiene pendientes por resolver.', asesor: 'No tienes matrículas pendientes de acción.', asistente_comercial: 'No hay expedientes en tu bandeja.', verificador: 'No hay citas ni verificaciones pendientes.' }[props.data.role] || 'No hay casos pendientes.'))
</script>

<template>
  <div class="space-y-7">
    <section class="grid grid-cols-2 border-y border-slate-200 bg-white sm:grid-cols-4">
      <div v-for="(metric, index) in data.metrics" :key="metric.key" class="px-5 py-4" :class="index < 2 ? 'border-b border-slate-200 sm:border-b-0' : ''" :style="index % 2 === 0 ? { borderRight: '1px solid #e2e8f0' } : {}">
        <p class="text-xs font-medium text-slate-600">{{ metric.label }}</p>
        <p class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{{ metric.format === 'currency' ? money(metric.value) : number(metric.value) }}</p>
      </div>
    </section>

    <section class="grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,.75fr)]">
      <div class="min-w-0">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div><h2 class="text-lg font-semibold tracking-tight text-slate-950">{{ queueHeading }}</h2><p class="mt-1 text-sm text-slate-600">{{ queueSubheading }}</p></div>
          <NuxtLink :to="['asistente_comercial', 'verificador'].includes(data.role) ? '/expedientes' : '/matriculas'" class="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex">Abrir listado <ArrowRight class="size-4" /></NuxtLink>
        </div>
        <div class="overflow-hidden border-y border-slate-200 bg-white">
          <div v-if="data.workQueue.length" class="divide-y divide-slate-100">
            <NuxtLink v-for="item in data.workQueue" :key="item.id" :to="queueHref(item)" class="group grid gap-3 px-4 py-4 transition-colors hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2"><p class="font-semibold text-slate-900">{{ item.holderName }}</p><span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span></div>
                <p class="mt-1 truncate text-sm text-slate-600">{{ item.contractNumber }} <span class="px-1 text-slate-400">·</span> DNI {{ item.holderDni }} <span v-if="['admin','supervisor'].includes(data.role)" class="px-1 text-slate-400">·</span><span v-if="['admin','supervisor'].includes(data.role)">{{ item.advisorName }}</span></p>
                <p v-if="item.observation" class="mt-1 truncate text-xs text-red-800">{{ item.observation }}</p>
                <p v-else-if="data.role === 'asistente_comercial'" class="mt-1 text-xs" :class="item.missingDocuments.length ? 'text-amber-800' : 'text-emerald-800'">{{ item.missingDocuments.length ? `Falta: ${item.missingDocuments.join(', ')}` : `${item.documentCount} documentos cargados` }}</p>
                <p v-else-if="item.appointmentAt" class="mt-1 text-xs text-violet-800">{{ new Date(item.appointmentAt).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) }}<span v-if="item.appointmentType"> · {{ item.appointmentType }}</span></p>
                <p v-else class="mt-1 text-xs text-slate-600">Actualizada {{ new Date(item.updatedAt).toLocaleDateString('es-PE') }}</p>
              </div>
              <span class="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 group-hover:text-primary">Gestionar <ArrowRight class="size-4" /></span>
            </NuxtLink>
          </div>
          <div v-else class="flex min-h-52 flex-col items-center justify-center px-6 text-center">
            <span class="mb-3 grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-800"><Check class="size-5" /></span>
            <p class="font-semibold text-slate-900">Todo al día</p><p class="mt-1 max-w-sm text-sm text-slate-600">{{ queueEmpty }}</p>
          </div>
        </div>
      </div>

      <aside class="space-y-7">
        <section v-if="data.role !== 'asesor' && data.role !== 'supervisor'" class="border-t-2 border-slate-900 pt-3">
          <div class="mb-4 flex items-center justify-between"><div><h2 class="font-semibold text-slate-950">Flujo de matrículas</h2><p class="mt-1 text-xs text-slate-600">Estados en el periodo seleccionado</p></div><ClipboardList class="size-5 text-slate-500" /></div>
          <div class="space-y-4">
            <div v-for="stage in data.pipeline" :key="stage.key" class="grid grid-cols-[7.5rem_minmax(0,1fr)_2rem] items-center gap-3">
              <span class="truncate text-xs text-slate-700">{{ stage.label }}</span>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-[#204bb3]" :style="{ width: `${Math.max(stage.value / maxPipeline * 100, stage.value ? 3 : 0)}%` }" /></div>
              <strong class="text-right text-sm tabular-nums text-slate-900">{{ number(stage.value) }}</strong>
            </div>
          </div>
        </section>

        <section v-if="['admin','supervisor'].includes(data.role)" class="border-t-2 border-slate-900 pt-3">
          <div class="mb-3 flex items-center justify-between"><div><h2 class="font-semibold text-slate-950">Desempeño por asesor</h2><p class="mt-1 text-xs text-slate-600">Matrículas firmadas · {{ data.role === 'supervisor' ? 'tu equipo' : 'toda la operación' }}</p></div><Users class="size-5 text-slate-500" /></div>
          <div v-if="data.advisors.length" class="overflow-x-auto">
            <table class="w-full min-w-[300px] text-left text-xs">
              <thead><tr class="border-y border-slate-200 text-slate-600"><th class="py-2 pr-2 font-medium">Asesor</th><th class="px-1 py-2 text-right font-medium">Firmadas</th><th class="px-1 py-2 text-right font-medium">Anuladas</th><th class="py-2 pl-2 text-right font-medium">Monto</th></tr></thead>
              <tbody><tr v-for="advisor in [...data.advisors].sort((a, b) => b.signed - a.signed)" :key="advisor.id" class="border-b border-slate-100 last:border-0">
                <td class="py-2.5 pr-2"><span class="block max-w-28 truncate font-medium text-slate-800">{{ advisor.name }}</span><span class="mt-1 block h-1 w-24 overflow-hidden rounded-full bg-slate-100"><span class="block h-full rounded-full bg-[#204bb3]" :style="{ width: `${Math.max(advisor.signed / maxAdvisor * 100, advisor.signed ? 3 : 0)}%` }" /></span></td>
                <td class="px-1 py-2.5 text-right font-semibold tabular-nums text-slate-900">{{ number(advisor.signed) }}<span class="block font-normal text-slate-600">de {{ number(advisor.total) }}</span></td>
                <td class="px-1 py-2.5 text-right tabular-nums text-slate-800">{{ number(advisor.cancelled) }}</td>
                <td class="py-2.5 pl-2 text-right font-medium tabular-nums text-slate-900">{{ money(advisor.contracted) }}</td>
              </tr></tbody>
            </table>
          </div>
          <p v-else class="py-5 text-sm text-slate-600">No hay matrículas de asesores en este periodo.</p>
        </section>

        <section class="border-t-2 border-slate-900 pt-3">
          <div class="mb-3 flex items-center gap-2"><CircleAlert class="size-4 text-amber-700" /><h2 class="font-semibold text-slate-950">Atención requerida</h2></div>
          <NuxtLink v-for="item in data.priorities" :key="item.key" :to="item.href" class="flex items-center justify-between gap-3 border-t border-slate-200 py-3 text-sm hover:text-primary"><span class="text-slate-700">{{ item.label }}</span><span class="inline-flex items-center gap-1 font-semibold text-slate-950">{{ number(item.value) }} <ArrowDownRight class="size-4" /></span></NuxtLink>
          <p v-if="!data.priorities.length" class="border-t border-slate-200 py-3 text-sm text-slate-600">Sin alertas prioritarias.</p>
        </section>

        <NuxtLink v-if="data.role === 'verificador'" to="/expedientes" class="flex items-center gap-3 border-t border-slate-200 pt-4 text-sm text-slate-700 hover:text-primary"><CalendarClock class="size-5" /> Ver agenda completa de citas <ArrowRight class="ml-auto size-4" /></NuxtLink>
        <NuxtLink v-if="data.role === 'asistente_comercial'" to="/expedientes" class="flex items-center gap-3 border-t border-slate-200 pt-4 text-sm text-slate-700 hover:text-primary"><FileCheck2 class="size-5" /> Gestionar expedientes recibidos <ArrowRight class="ml-auto size-4" /></NuxtLink>
        <NuxtLink v-if="data.role === 'asesor'" to="/matricula/nuevo" class="flex items-center gap-3 border-t border-slate-200 pt-4 text-sm font-semibold text-primary hover:underline"><FolderClock class="size-5" /> Registrar matrícula <ArrowRight class="ml-auto size-4" /></NuxtLink>
      </aside>
    </section>
  </div>
</template>
