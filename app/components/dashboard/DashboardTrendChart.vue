<script setup lang="ts">
interface TrendPoint {
  label: string
  [key: string]: string | number
}
interface TrendSeries { key: string; label: string; color: string }

const props = defineProps<{ points: TrendPoint[]; series: TrendSeries[]; title: string; description: string }>()
const frame = { left: 42, right: 12, top: 14, bottom: 42, width: 760, height: 380 }
const chartWidth = frame.width - frame.left - frame.right
const chartHeight = frame.height - frame.top - frame.bottom
const maxValue = computed(() => Math.max(1, ...props.points.flatMap((point) => props.series.map((item) => Number(point[item.key] || 0)))))
const hasValues = computed(() => props.points.some((point) => props.series.some((item) => Number(point[item.key] || 0) > 0)))
const guides = [0, 0.25, 0.5, 0.75, 1]
const x = (index: number) => frame.left + (props.points.length <= 1 ? chartWidth / 2 : index / (props.points.length - 1) * chartWidth)
const y = (value: number) => frame.top + chartHeight - value / maxValue.value * chartHeight
const lines = computed(() => props.series.map((serie) => ({
  ...serie,
  path: props.points.map((point, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(Number(point[serie.key] || 0)).toFixed(1)}`).join(' '),
  area: `${props.points.map((point, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(Number(point[serie.key] || 0)).toFixed(1)}`).join(' ')} L ${x(props.points.length - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`
})))
const gridLabels = computed(() => guides.map((ratio) => ({ y: y(maxValue.value * ratio), value: Math.round(maxValue.value * ratio) })))
</script>

<template>
  <section class="flex h-full min-h-[420px] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-none sm:p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div><h2 class="text-[15px] font-semibold tracking-tight text-[#000051]">{{ title }}</h2><p class="mt-1 text-xs text-slate-600">{{ description }}</p></div>
    </div>
    <div v-if="hasValues" class="mt-3 min-h-0 flex-1">
      <svg class="block h-full min-h-[300px] w-full overflow-visible" :viewBox="`0 0 ${frame.width} ${frame.height}`" preserveAspectRatio="none" role="img" :aria-label="title">
        <defs><linearGradient v-for="line in lines" :id="`fill-${line.key}`" :key="line.key" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" :stop-color="line.color" stop-opacity=".17" /><stop offset="100%" :stop-color="line.color" stop-opacity="0" /></linearGradient></defs>
        <g v-for="guide in gridLabels" :key="guide.value">
          <line :x1="frame.left" :x2="frame.width - frame.right" :y1="guide.y" :y2="guide.y" stroke="#e8edf4" stroke-width="1" />
          <text :x="frame.left - 9" :y="guide.y + 4" text-anchor="end" fill="#526176" font-size="11">{{ guide.value }}</text>
        </g>
        <line v-for="(point, index) in points" :key="`month-grid-${point.label}`" :x1="x(index)" :x2="x(index)" :y1="frame.top" :y2="frame.height - frame.bottom" stroke="#e8edf4" stroke-width="1" />
        <g v-for="line in lines" :key="line.key">
          <path :d="line.area" :fill="`url(#fill-${line.key})`" />
          <path :d="line.path" fill="none" :stroke="line.color" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
          <circle v-for="(point, index) in points" :key="`${line.key}-${index}`" :cx="x(index)" :cy="y(Number(point[line.key] || 0))" r="3" fill="white" :stroke="line.color" stroke-width="2"><title>{{ point.label }} · {{ line.label }}: {{ point[line.key] || 0 }}</title></circle>
        </g>
        <g v-for="(point, index) in points" :key="point.label">
          <text :x="x(index)" :y="frame.height - 7" text-anchor="middle" fill="#526176" font-size="10">{{ point.label }}</text>
        </g>
      </svg>
    </div>
    <div v-else class="mt-5 grid min-h-[300px] flex-1 place-items-center bg-slate-50 text-center"><div><p class="font-medium text-slate-800">Sin movimientos en el periodo</p><p class="mt-1 text-xs text-slate-600">Prueba con un rango más amplio.</p></div></div>
    <div class="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-2" aria-label="Leyenda del gráfico"><span v-for="serie in series" :key="serie.key" class="inline-flex items-center gap-2 text-xs font-medium text-slate-700"><span class="size-2.5 rounded-full" :style="{ backgroundColor: serie.color }" />{{ serie.label }}</span></div>
  </section>
</template>
