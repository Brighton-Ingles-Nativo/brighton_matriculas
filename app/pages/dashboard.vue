<script setup lang="ts">
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CircleAlert, Coins, FileCheck2, FileText, RefreshCw, Users, Clock3 } from '@lucide/vue'

definePageMeta({ middleware: 'auth', ssr: false })

interface Metric { key: string; label: string; value: number; format: 'number' | 'currency' | 'percent' | 'days'; change: number | null; previousValue: number | null }
interface TrendPoint { label: string; registered: number; signed: number; commercial: number; verification: number; verified: number; appointments: number }
interface Breakdown { key: string; label: string; value: number }
interface WorkItem { id: string; contractId: string; contractNumber: string; holderName: string; holderDni: string; program: string; advisorName: string; status: string; location: string; updatedAt: string; queueEnteredAt: string | null; appointmentAt: string | null; appointmentType: string | null; observation: string | null; queueReason?: string | null; documentCount: number; missingDocuments: string[] }
interface Advisor { id: string; name: string; total: number; signed: number; cancelled: number; contracted: number; signingRate: number }
interface DashboardData { role: string; scope: string; period: number; summary: Record<string, number>; metrics: Metric[]; trend: TrendPoint[]; contractStatusBreakdown: Breakdown[]; expedientStatusBreakdown: Breakdown[]; locationBreakdown: Array<{ location: string; status: string; value: number }>; priorities: Array<{ key: string; label: string; value: number; href: string }>; advisors: Advisor[]; workQueue: WorkItem[] }

const { user, verifyToken } = useAuth()
const data = ref<DashboardData | null>(null)
const loading = ref(true)
const error = ref('')
const period = ref(30)
const periodSelection = computed({ get: () => String(period.value), set: (value: string) => { period.value = Number(value) } })
const ALL_QUEUE_STATUSES = '__all__'
const queueStatus = ref(ALL_QUEUE_STATUSES)
const chartGrouping = ref('monthly')
const showAllAdvisors = ref(false)
const showAllQueue = ref(false)
const nf = new Intl.NumberFormat('es-PE')
const money = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(value || 0)
const formatValue = (metric: Metric, value = metric.value) => metric.format === 'currency' ? money(value) : metric.format === 'percent' ? `${nf.format(value)}%` : metric.format === 'days' ? `${nf.format(value)} d` : nf.format(value)
const firstName = computed(() => user.value?.name?.split(' ')[0] || 'bienvenido')
const statusLabels: Record<string, string> = { REVISION: 'En revisión', APROBADO: 'Aprobado', ANULADO: 'Anulado', CREADO: 'Por revisar', REBOTADO: 'Rebotado', AGENDADO: 'Cita programada', OBSERVADO: 'Con observaciones', VERIFICADO: 'Verificado', ANULACION_PENDIENTE: 'Firma pendiente' }
const statusTone: Record<string, string> = { REVISION: 'pending', APROBADO: 'signed', ANULADO: 'neutral', CREADO: 'review', REBOTADO: 'danger', AGENDADO: 'review', OBSERVADO: 'pending', VERIFICADO: 'signed', ANULACION_PENDIENTE: 'pending' }
const fmtStatus = (key: string) => statusLabels[key] || key.replaceAll('_', ' ')
const metricIcons = [Users, FileText, Clock3, Coins]
const chartSeries = computed(() => ['asistente_comercial', 'verificador'].includes(data.value?.role || '') ? [{ key: 'commercial', label: 'Recibidos', color: 'var(--secondary)' }, { key: 'verification', label: 'Derivados', color: 'var(--primary)' }] : [{ key: 'registered', label: 'Matrículas', color: 'var(--secondary)' }, { key: 'signed', label: 'Contratos firmados', color: 'var(--primary)' }])
const chartPoints = computed(() => {
  const points = data.value?.trend || []
  const max = Math.max(...points.flatMap((point) => chartSeries.value.map((series) => Number(point[series.key as keyof TrendPoint]) || 0)), 1)
  return points.map((point, index) => ({ ...point, x: points.length > 1 ? 34 + index * (650 / (points.length - 1)) : 34, values: chartSeries.value.map((series) => ({ ...series, value: Number(point[series.key as keyof TrendPoint]) || 0, y: 204 - ((Number(point[series.key as keyof TrendPoint]) || 0) / max) * 165 })) }))
})
const linePath = (seriesIndex: number) => chartPoints.value.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.values[seriesIndex]?.y ?? 204}`).join(' ')
const areaPath = (seriesIndex: number) => `${linePath(seriesIndex)} L ${chartPoints.value.at(-1)?.x || 684} 204 L ${chartPoints.value[0]?.x || 34} 204 Z`
const chartMax = computed(() => Math.max(...(data.value?.trend || []).flatMap((point) => chartSeries.value.map((series) => Number(point[series.key as keyof TrendPoint]) || 0)), 1))
const doughnutTotal = computed(() => (data.value?.contractStatusBreakdown || []).reduce((total, segment) => total + segment.value, 0))
const doughnutStyle = computed(() => { let cursor = 0; const colors = ['var(--primary)', 'color-mix(in srgb, var(--secondary) 70%, var(--card))', 'var(--secondary)', 'color-mix(in srgb, var(--secondary) 35%, var(--card))']; return (data.value?.contractStatusBreakdown || []).map((segment, index) => { const start = cursor; cursor += doughnutTotal.value ? segment.value / doughnutTotal.value * 100 : 0; return `${colors[index % colors.length]} ${start}% ${cursor}%` }).join(', ') || 'var(--muted) 0 100%' })
const stageGroups = computed(() => { const locations = [{ key: 'ASESOR', label: 'Admisión' }, { key: 'ASISTENTE_COMERCIAL', label: 'Finanzas' }, { key: 'SUPERVISOR', label: 'Legal' }, { key: 'VERIFICACION', label: 'Firma de contrato' }]; return locations.map((location) => ({ ...location, value: (data.value?.locationBreakdown || []).filter((row) => row.location === location.key && row.status !== 'VERIFICADO').reduce((sum, row) => sum + row.value, 0) })).filter((stage) => stage.value > 0) })
const maxStage = computed(() => Math.max(...stageGroups.value.map((stage) => stage.value), 1))
const advisorRows = computed(() => {
  const advisors = [...(data.value?.advisors || [])].sort((a, b) => b.signed - a.signed)
  return showAllAdvisors.value ? advisors : advisors.slice(0, 5)
})
const queueItems = computed(() => (data.value?.workQueue || []).filter((item) => queueStatus.value === ALL_QUEUE_STATUSES || item.status === queueStatus.value))
const filteredQueue = computed(() => showAllQueue.value ? queueItems.value : queueItems.value.slice(0, 5))
const queueStatuses = computed(() => [...new Set((data.value?.workQueue || []).map((item) => item.status))])
const changeIsGood = (metric: Metric) => ['pendingSignatures', 'commercialReturned', 'overdueAppointments'].includes(metric.key) ? (metric.change || 0) <= 0 : (metric.change || 0) >= 0
const ageDays = (item: WorkItem) => Math.max(0, Math.floor((Date.now() - new Date(item.queueEnteredAt || item.updatedAt).getTime()) / 86400000))
const loadDashboard = async () => { loading.value = true; error.value = ''; try { data.value = await $fetch<DashboardData>('/api/dashboard', { credentials: 'include', query: { period: period.value } }) } catch (err: any) { error.value = err?.data?.message || err?.data?.statusMessage || 'No pudimos cargar el dashboard.' } finally { loading.value = false } }
watch(period, () => { void loadDashboard() })
onMounted(async () => { if (!user.value) await verifyToken(); await loadDashboard() })
</script>

<template>
  <div class="dashboard-page">
    <AppHeader title="Dashboard" subtitle="Centro de operaciones de matrículas" />
    <main class="dashboard-content">
      <section class="dashboard-intro">
        <div>
          <h1>Hola, {{ firstName }}</h1>
          <p>Aquí tienes el resumen de la operación de matrículas y contratos.</p>
        </div>
        <div class="period-control"><label for="dashboard-period">Periodo</label>
          <div class="period-select-wrap">
            <UiSelect v-model="periodSelection">
              <UiSelectTrigger id="dashboard-period" class="period-select-trigger h-[34px] w-full pl-9 pr-3">
                <UiSelectValue />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="7">Últimos 7 días</UiSelectItem>
                <UiSelectItem value="30">Últimos 30 días</UiSelectItem>
                <UiSelectItem value="90">Últimos 90 días</UiSelectItem>
                <UiSelectItem value="365">Último año</UiSelectItem>
              </UiSelectContent>
            </UiSelect>
            <CalendarDays class="period-icon" aria-hidden="true" />
          </div>
        </div>
      </section>

      <div v-if="error" class="dashboard-error" role="alert"><span>{{ error }}</span><button type="button"
          @click="loadDashboard">
          <RefreshCw :size="15" /> Reintentar
        </button></div>
      <div v-if="loading" class="dashboard-loading">
        <UiSkeleton v-for="item in 8" :key="item" class="rounded-lg" :class="item < 5 ? 'h-28' : 'h-64'" />
      </div>
      <template v-else-if="data">
        <section class="metric-grid" aria-label="Indicadores principales">
          <UiCard v-for="(metric, index) in data.metrics.slice(0, 4)" :key="metric.key" role="article" class="metric-card gap-0 py-0 ring-0"><span
              class="metric-icon" :class="`metric-icon-${index}`">
              <component :is="metricIcons[index] || FileText" :size="27" />
            </span>
            <div class="metric-copy">
              <p>{{ metric.label }}</p>
              <div class="metric-value-row"><strong>{{ formatValue(metric) }}</strong>
                <span v-if="metric.change !== null" :class="changeIsGood(metric) ? 'change-good' : 'change-bad'">
                  <ArrowUpRight v-if="metric.change >= 0" :size="14" />
                  <ArrowDownRight v-else :size="14" />
                  {{ metric.change > 0 ? '+' : '' }}{{ metric.change }}%
                </span>
              </div>
              <small>{{ metric.previousValue !== null ? `vs. periodo anterior (${formatValue(metric, metric.previousValue)})` : 'Casos actuales que requieren seguimiento' }}</small>
            </div>
          </UiCard>
        </section>

        <section class="dashboard-middle">
          <UiCard role="article" class="panel trend-panel gap-0 py-0 ring-0">
            <div class="panel-heading">
              <div>
                <h2>Evolución de matrículas y firmas</h2>
                <p>Comparativo mensual del número de matrículas vs. contratos firmados.</p>
              </div>
              <UiSelect v-model="chartGrouping">
                <UiSelectTrigger class="chart-grouping-trigger h-[34px]" aria-label="Agrupación de la gráfica">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectItem value="monthly">Mensual</UiSelectItem>
                  <UiSelectItem value="weekly">Semanal</UiSelectItem>
                </UiSelectContent>
              </UiSelect>
            </div>
            <div class="chart-wrap">
              <div class="chart-y-labels">
                <span>{{ chartMax }}</span>
                <span>{{ Math.round(chartMax * .75)}}</span>
                <span>{{ Math.round(chartMax * .5) }}</span>
                <span>{{ Math.round(chartMax * .25)}}</span>
                <span>0</span>
              </div>
              <svg class="trend-chart" viewBox="0 0 720 250" role="img"
                aria-label="Evolución de matrículas y firmas">
                <defs>
                  <linearGradient id="blueArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stop-color="var(--secondary)" stop-opacity=".12" />
                    <stop offset="1" stop-color="var(--secondary)" stop-opacity="0" />
                  </linearGradient>
                </defs>
                <g class="chart-grid">
                  <line v-for="y in [39, 80, 121, 162, 204]" :key="y" x1="34" :y1="y" x2="684" :y2="y" />
                  <line v-for="x in chartPoints" :key="x.x" :x1="x.x" y1="39" :x2="x.x" y2="204" />
                </g>
                <path v-if="chartPoints.length" :d="areaPath(0)" fill="url(#blueArea)" />
                <path v-for="(series, index) in chartSeries" :key="series.key" :d="linePath(index)" fill="none" :stroke="series.color" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                <template v-for="point in chartPoints" :key="point.x">
                  <circle v-for="series in point.values" :key="series.key" :cx="point.x" :cy="series.y" r="3.5" :fill="series.color" stroke="var(--card)" stroke-width="2" />
                </template>
              </svg>
              <div class="chart-x-labels"><span v-for="point in chartPoints" :key="point.x">{{ point.label }}</span>
              </div>
            </div>
            <div class="chart-legend">
              <span v-for="series in chartSeries" :key="series.key">
                <i :style="{ background: series.color }" />{{ series.label }}
              </span>
            </div>
          </UiCard>

          <UiCard role="article" class="panel status-panel gap-0 py-0 ring-0">
            <div class="panel-heading">
              <div>
                <h2>Estado de contratos</h2>
                <p>Distribución por estado actual.</p>
              </div>
            </div>
            <div class="donut-wrap">
              <div class="donut" :style="{ background: `conic-gradient(${doughnutStyle})` }">
                <div><strong>{{ nf.format(doughnutTotal) }}</strong><span>contratos<br />totales</span></div>
              </div>
            </div>
            <div class="status-list">
              <div v-for="(segment, index) in data.contractStatusBreakdown" :key="segment.key">
                <span><i class="status-dot" :class="`dot-${index}`" />{{ fmtStatus(segment.key) }}</span>
                <b>{{nf.format(segment.value) }}</b>
                <small>{{doughnutTotal ? Math.round(segment.value / doughnutTotal * 100) : 0 }}%</small>
              </div>
            </div>
          </UiCard>

          <div class="side-panels">
            <UiCard role="article" class="panel stages-panel gap-0 py-0 ring-0">
              <div class="panel-heading">
                <div>
                  <h2>Expedientes por etapa responsable</h2>
                  <p>Número de expedientes en cada etapa del proceso.</p>
                </div>
              </div>
              <div class="stage-list">
                <div v-for="stage in stageGroups" :key="stage.key">
                  <span>{{ stage.label }}</span>
                  <div>
                    <i :style="{ width: `${Math.max(stage.value / maxStage * 100, 3)}%` }" />
                  </div>
                  <b>{{ nf.format(stage.value)}}</b>
                </div>
                <p v-if="!stageGroups.length" class="empty-copy">Sin expedientes registrados.</p>
              </div>
            </UiCard>
            <UiCard role="article" class="panel advisors-panel gap-0 py-0 ring-0">
              <div class="panel-heading">
                <div>
                  <h2>Rendimiento de asesores</h2>
                  <p>Matrículas, firmas, tasa de conversión y valor contratado.</p>
                </div>
                <button v-if="data.advisors.length > 5" type="button" class="panel-more-button" :aria-expanded="showAllAdvisors" @click="showAllAdvisors = !showAllAdvisors">
                  {{ showAllAdvisors ? 'Ver menos' : 'Ver todos' }}
                  <ArrowRight v-if="!showAllAdvisors" :size="14" />
                </button>
              </div>
              <div class="advisor-table">
                <UiTable class="advisor-data-table min-w-[520px] text-xs">
                  <UiTableHeader>
                    <UiTableRow class="advisor-head">
                      <UiTableHead>Asesor</UiTableHead>
                      <UiTableHead class="text-right">Matrículas</UiTableHead>
                      <UiTableHead class="text-right">Firmas</UiTableHead>
                      <UiTableHead class="text-right">Conversión</UiTableHead>
                      <UiTableHead class="text-right">Valor contratado</UiTableHead>
                    </UiTableRow>
                  </UiTableHeader>
                  <UiTableBody>
                    <UiTableRow v-for="advisor in advisorRows" :key="advisor.id" class="advisor-data-row">
                      <UiTableCell>
                        <span class="advisor-name">
                          <i aria-hidden="true">{{advisor.name.split(' ').map((name) => name[0]).slice(0,2).join('') }}</i>
                          <span class="advisor-label">{{ advisor.name }}</span>
                        </span>
                      </UiTableCell>
                      <UiTableCell class="text-right tabular-nums">{{ advisor.total }}</UiTableCell>
                      <UiTableCell class="text-right tabular-nums">{{ advisor.signed}}</UiTableCell>
                      <UiTableCell class="text-right tabular-nums">{{ advisor.signingRate }}%</UiTableCell>
                      <UiTableCell class="whitespace-nowrap text-right tabular-nums">{{ money(advisor.contracted) }}</UiTableCell>
                    </UiTableRow>
                  </UiTableBody>
                </UiTable>
                <p v-if="!data.advisors.length" class="empty-copy">No hay asesores para comparar.</p>
              </div>
            </UiCard>
          </div>
        </section>

        <UiCard role="article" class="panel queue-panel gap-0 py-0 ring-0">
          <div class="queue-heading">
            <div>
              <h2>Cola de trabajo</h2>
              <p>Matrículas con contrato pendiente o en proceso, ordenadas por mayor tiempo de espera.</p>
            </div>
            <div class="queue-actions">
              <UiSelect v-model="queueStatus">
                <UiSelectTrigger class="min-w-40 max-w-full" aria-label="Filtrar cola por estado">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectItem :value="ALL_QUEUE_STATUSES">Todos los estados</UiSelectItem>
                  <UiSelectItem v-for="status in queueStatuses" :key="status" :value="status">{{ fmtStatus(status) }}</UiSelectItem>
                </UiSelectContent>
              </UiSelect>
              <button v-if="queueItems.length > 5" type="button" class="queue-more-button" :aria-expanded="showAllQueue" @click="showAllQueue = !showAllQueue">
                {{ showAllQueue ? 'Ver menos casos' : 'Ver más casos' }}
                <ArrowRight v-if="!showAllQueue" :size="15" />
              </button>
            </div>
          </div>
          <div class="queue-scroll">
            <UiTable class="queue-data-table min-w-[990px] text-xs">
              <UiTableHeader>
                <UiTableRow>
                  <UiTableHead>Estudiante / titular</UiTableHead>
                  <UiTableHead>Programa</UiTableHead>
                  <UiTableHead>Asesor asignado</UiTableHead>
                  <UiTableHead>Estado actual</UiTableHead>
                  <UiTableHead>Días en espera</UiTableHead>
                  <UiTableHead>Última actividad</UiTableHead>
                  <UiTableHead>Acciones</UiTableHead>
                </UiTableRow>
              </UiTableHeader>
              <UiTableBody>
                <UiTableRow v-for="item in filteredQueue" :key="item.id" class="queue-data-row">
                  <UiTableCell>
                    <strong>{{ item.holderName }}</strong>
                    <div class="text-xs text-muted-foreground">DNI:{{ item.holderDni }}</div>
                  </UiTableCell>
                  <UiTableCell>{{ item.program }}</UiTableCell>
                  <UiTableCell>{{ item.advisorName }}</UiTableCell>
                  <UiTableCell><span class="status-pill" :class="statusTone[item.status] || 'neutral'">{{ fmtStatus(item.status) }}</span></UiTableCell>
                  <UiTableCell class="tabular-nums">{{ ageDays(item) }}</UiTableCell>
                  <UiTableCell>{{ new Date(item.updatedAt).toLocaleDateString('es-PE', {day: '2-digit', month: 'short', year: 'numeric'}) }}</UiTableCell>
                  <UiTableCell>
                    <NuxtLink :to="item.location === 'ASESOR' ? `/matricula/${item.contractId}` : `/expedientes/${item.id}`">
                      Ver detalle <ArrowRight :size="14" />
                    </NuxtLink>
                  </UiTableCell>
                </UiTableRow>
              </UiTableBody>
            </UiTable>
            <div v-if="!filteredQueue.length" class="queue-empty">
              <CircleAlert :size="18" /> No hay casos pendientes para mostrar.
            </div>
          </div>
        </UiCard>
      </template>
      <div v-else-if="!error" class="empty-state">
        <p>No hay información para mostrar</p><button type="button" @click="loadDashboard">Recargar</button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.dashboard-page {
  --dashboard-surface: var(--card);
  --dashboard-surface-muted: var(--muted);
  --dashboard-text: var(--foreground);
  --dashboard-subtle: var(--muted-foreground);
  --dashboard-line: var(--border);
  --dashboard-link: var(--secondary);
  --dashboard-blue: var(--brand-blue);
  --dashboard-blue-soft: color-mix(in srgb, var(--secondary) 12%, transparent);
  --dashboard-red-soft: color-mix(in srgb, var(--primary) 12%, transparent);
  min-height: 100dvh;
  background: var(--background);
  color: var(--dashboard-text);
}

.dashboard-content {
  max-width: 1500px;
  margin: 0 auto;
  padding: 24px 28px 36px;
}

.dashboard-intro,
.panel-heading,
.queue-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.dashboard-intro {
  align-items: center;
  margin-bottom: 20px;
}

.dashboard-intro h1 {
  margin: 0;
  color: var(--dashboard-text);
  font-size: var(--text-3xl);
  line-height: 1.2;
  letter-spacing: -.03em;
}

.dashboard-intro p,
.panel-heading p,
.queue-heading p {
  margin: 5px 0 0;
  color: var(--dashboard-subtle);
  font-size: var(--text-sm);
}

.period-control {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--dashboard-subtle);
  font-size: var(--text-sm);
}

.period-select-wrap {
  position: relative;
  flex: 0 1 190px;
  min-width: 0;
}

.dashboard-error button:focus-visible,
.empty-state button:focus-visible {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 22%, transparent);
}

.period-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  width: 15px;
  transform: translateY(-50%);
  color: var(--dashboard-subtle);
  pointer-events: none;
}

.dashboard-error {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--destructive) 35%, var(--dashboard-line));
  border-radius: var(--radius-md);
  padding: 12px 15px;
  margin-bottom: 16px;
  background: color-mix(in srgb, var(--destructive) 10%, var(--dashboard-surface));
  color: var(--destructive);
  font-size: var(--text-sm);
}

.dashboard-error button,
.empty-state button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--primary);
  border-radius: var(--radius-md);
  padding: 7px 11px;
  color: var(--primary);
  background: var(--dashboard-surface);
  font-size: var(--text-sm);
  cursor: pointer;
}

.dashboard-loading {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 13px;
}

.dashboard-loading> :nth-child(n+5) {
  grid-column: span 2;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
  margin-bottom: 13px;
}

.metric-card,
.panel {
  border: 1px solid var(--dashboard-line);
  border-radius: var(--radius-lg);
  background: var(--dashboard-surface);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--foreground) 4%, transparent);
}

.metric-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  min-height: 116px;
  padding: 17px;
}

.metric-icon {
  display: grid;
  place-items: center;
  width: 55px;
  height: 55px;
  flex: 0 0 auto;
  border-radius: var(--radius-lg);
}

.metric-icon-0,
.metric-icon-1 {
  background: var(--dashboard-blue-soft);
  color: var(--secondary);
}

.metric-icon-2 {
  background: var(--dashboard-red-soft);
  color: var(--primary);
}

.metric-icon-3 {
  background: var(--dashboard-blue-soft);
  color: var(--secondary);
}

.metric-copy {
  min-width: 0;
}

.metric-copy p {
  margin: 0;
  color: var(--dashboard-text);
  font-size: var(--text-sm);
  font-weight: 600;
}

.metric-value-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  margin-top: 2px;
}

.metric-value-row strong {
  color: var(--dashboard-text);
  font-size: var(--text-3xl);
  line-height: 1.2;
  letter-spacing: -.03em;
  font-variant-numeric: tabular-nums;
}

.metric-value-row span {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  font-weight: 700;
}

.change-good {
  color: #139a6b;
}

.change-bad {
  color: var(--destructive);
}

.metric-copy small {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: var(--dashboard-subtle);
  font-size: var(--text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-middle {
  display: grid;
  grid-template-columns: minmax(0, 1.62fr) minmax(220px, .66fr) minmax(320px, 1.15fr);
  gap: 13px;
  align-items: stretch;
}

.panel {
  overflow: hidden;
}

.panel-heading {
  padding: 15px 16px 7px;
  min-width: 0;
}

.panel-heading > div:first-child { min-width: 0; }

.panel-heading h2,
.queue-heading h2 {
  margin: 0;
  color: var(--dashboard-text);
  font-size: var(--text-base);
  line-height: 1.4;
  letter-spacing: -.025em;
}

.panel-heading a,
.queue-actions a,
.queue-panel a,
.panel-more-button,
.queue-more-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--dashboard-link);
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.panel-more-button,
.queue-more-button {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
}

.panel-heading a:focus-visible,
.queue-actions a:focus-visible,
.queue-panel a:focus-visible,
.panel-more-button:focus-visible,
.queue-more-button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
  border-radius: 3px;
}

.trend-panel {
  min-width: 0;
}

.chart-wrap {
  position: relative;
  padding: 12px 17px 0 48px;
}

.trend-chart {
  display: block;
  width: 100%;
  height: 235px;
  overflow: visible;
}

.chart-grid line {
  stroke: var(--dashboard-line);
  stroke-width: 1;
}

.chart-y-labels {
  position: absolute;
  top: 21px;
  bottom: 27px;
  left: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: var(--dashboard-subtle);
  font-size: var(--text-xs);
}

.chart-x-labels {
  display: flex;
  justify-content: space-between;
  padding: 1px 2px 0;
  color: var(--dashboard-subtle);
  font-size: var(--text-xs);
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 26px;
  padding: 16px 12px 17px;
  color: var(--dashboard-text);
  font-size: var(--text-xs);
}

.chart-legend span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.chart-legend i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-panel {
  min-width: 0;
}

.donut-wrap {
  display: grid;
  place-items: center;
  padding: 10px 0 6px;
}

.donut {
  position: relative;
  display: grid;
  place-items: center;
  width: 170px;
  height: 170px;
  border-radius: 50%;
}

.donut::before {
  content: '';
  position: absolute;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  background: var(--dashboard-surface);
}

.donut>div {
  position: relative;
  z-index: 1;
  text-align: center;
}

.donut strong {
  display: block;
  color: var(--dashboard-text);
  font-size: var(--text-2xl);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.donut span {
  display: block;
  margin-top: 3px;
  color: var(--dashboard-subtle);
  font-size: var(--text-xs);
  line-height: 1.3;
}

.status-list {
  padding: 6px 16px 16px;
}

.status-list>div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px 30px;
  align-items: center;
  gap: 5px;
  padding: 4px 0;
  color: var(--dashboard-text);
  font-size: var(--text-xs);
}

.status-list span {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-list b {
  text-align: right;
  font-weight: 600;
}

.status-list small {
  text-align: right;
  color: var(--dashboard-subtle);
}

.status-list > div > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-0 {
  background: var(--primary);
}

.dot-1 {
  background: #9fb2d0;
}

.dot-2 {
  background: #6da5f0;
}

.dot-3 {
  background: #c9d6ea;
}

.side-panels {
  display: grid;
  gap: 13px;
  min-width: 0;
}

.stages-panel {
  min-height: 185px;
}

.stage-list {
  padding: 8px 16px 16px;
}

.stage-list>div {
  display: grid;
  grid-template-columns: minmax(0, 100px) minmax(0, 1fr) 30px;
  align-items: center;
  gap: 9px;
  margin: 12px 0;
  color: var(--dashboard-text);
  font-size: var(--text-xs);
}

.stage-list>div>span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.stage-list>div>div {
  height: 15px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--dashboard-surface-muted);
}

.stage-list i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--dashboard-blue);
}

.stage-list b {
  text-align: right;
  color: var(--dashboard-text);
  font-size: var(--text-xs);
}

.empty-copy {
  margin: 10px 0;
  color: var(--dashboard-subtle);
  font-size: var(--text-sm);
}

.advisors-panel {
  min-height: 239px;
}

.advisor-table {
  padding-bottom: 5px;
}

.advisor-table :deep(table) {
  min-width: 520px;
  font-size: var(--text-xs);
}

.advisor-table :deep(th) {
  border-top: 1px solid var(--dashboard-line);
  background: var(--dashboard-surface-muted);
  color: var(--dashboard-subtle);
  font-size: var(--text-xs);
  font-weight: 600;
  height: auto;
  padding: 7px 12px;
}

.advisor-table :deep(td) {
  border-bottom: 1px solid var(--dashboard-line);
  padding: 7px 12px;
  color: var(--dashboard-text);
}

.advisor-table :deep(th:not(:first-child)),
.advisor-table :deep(td:not(:first-child)) {
  text-align: right;
}

.advisor-table :deep(.advisor-head) {
  background: var(--dashboard-surface-muted);
}

.advisor-table :deep(.advisor-name) {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}

.advisor-table :deep(.advisor-label) { overflow: hidden; text-overflow: ellipsis; }

.advisor-table :deep(.advisor-name i) {
  display: grid;
  place-items: center;
  width: 23px;
  height: 23px;
  border-radius: 50%;
  background: #f6c86c;
  color: #68430f;
  font-style: normal;
  font-size: var(--text-xs);
  font-weight: 700;
}

.advisor-table :deep(tbody tr:nth-child(3n + 2) .advisor-name i) {
  background: #a8c8f5;
  color: #1d508f;
}

.advisor-table :deep(tbody tr:nth-child(4n + 3) .advisor-name i) {
  background: #f2a5b8;
  color: #8b1b3d;
}

.queue-panel {
  margin-top: 13px;
}

.queue-heading {
  align-items: center;
  padding: 15px 17px 13px;
  min-width: 0;
}

.queue-heading > div:first-child { min-width: 0; }

.queue-actions {
  display: flex;
  align-items: center;
  gap: 18px;
}

.queue-scroll {
  padding: 0 16px 10px;
}

.queue-scroll :deep(table) {
  width: 100%;
  min-width: 990px;
  border-collapse: collapse;
  font-size: var(--text-xs);
}

.queue-scroll :deep(th) {
  padding: 8px 12px;
  background: var(--dashboard-surface-muted);
  color: var(--dashboard-text);
  text-align: left;
  font-size: var(--text-xs);
  font-weight: 700;
  white-space: nowrap;
}

.queue-scroll :deep(td) {
  border-bottom: 1px solid var(--dashboard-line);
  padding: 8px 12px;
  color: var(--dashboard-text);
  white-space: nowrap;
}

.queue-scroll :deep(td strong) {
  color: var(--dashboard-text);
  font-weight: 600;
}

.queue-scroll :deep(td:last-child a) {
  color: var(--dashboard-link);
}

.status-pill {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 9px;
  font-size: var(--text-xs);
  font-weight: 600;
}

.status-pill.signed {
  background: color-mix(in srgb, #139a6b 16%, transparent);
  color: #139a6b;
}

.status-pill.pending {
  background: color-mix(in srgb, #e58b09 18%, transparent);
  color: #e58b09;
}

.status-pill.review {
  background: var(--dashboard-blue-soft);
  color: var(--dashboard-link);
}

.status-pill.danger {
  background: color-mix(in srgb, var(--destructive) 16%, transparent);
  color: var(--destructive);
}

.status-pill.neutral {
  background: var(--dashboard-surface-muted);
  color: var(--dashboard-subtle);
}

.queue-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 7px;
  padding: 32px;
  color: var(--dashboard-subtle);
  font-size: var(--text-sm);
}

.empty-state {
  padding: 50px;
  text-align: center;
  color: var(--dashboard-subtle);
}

.empty-state button {
  margin-top: 12px;
}

@media (max-width: 1250px) {
  .dashboard-loading { grid-template-columns: repeat(2, minmax(0, 1fr)); }

  .dashboard-middle {
    grid-template-columns: minmax(0, 1.5fr) minmax(220px, .8fr);
  }

  .side-panels {
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .side-panels > * { min-width: 0; }

  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

  .metric-card {
    padding: 14px;
    gap: 11px;
  }
}

@media (max-width: 850px) {
  .dashboard-content {
    padding: 18px 16px 28px;
  }

  .dashboard-intro {
    align-items: flex-start;
    flex-direction: column;
  }

  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .dashboard-middle {
    grid-template-columns: 1fr;
  }

  .side-panels {
    grid-template-columns: 1fr;
  }

  .queue-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .queue-actions {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 520px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .metric-card {
    min-height: 100px;
  }

  .period-control {
    width: 100%;
    justify-content: space-between;
  }

  .period-select-wrap {
    flex: 1;
  }

  .dashboard-loading {
    grid-template-columns: 1fr;
  }

  .dashboard-loading> :nth-child(n+5) {
    grid-column: auto;
  }

  .chart-wrap {
    padding-left: 39px;
    padding-right: 8px;
  }

  .chart-y-labels {
    left: 9px;
  }

  .chart-legend {
    gap: 12px;
    flex-wrap: wrap;
  }

  .chart-x-labels span:nth-child(even) { display: none; }

  .queue-actions {
    align-items: flex-start;
    flex-direction: column;
    gap: 11px;
  }
}

@media (max-width: 380px) {
  .chart-x-labels span:not(:first-child):not(:last-child) { display: none; }
  .metric-value-row { gap: 4px 8px; }
  .metric-value-row strong { font-size: var(--text-2xl); }
}
</style>
