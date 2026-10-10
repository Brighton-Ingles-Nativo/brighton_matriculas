<script setup lang="ts">
interface Segment { key: string; label: string; value: number; color: string }
const props = defineProps<{ title: string; description: string; segments: Segment[] }>()
const total = computed(() => props.segments.reduce((sum, segment) => sum + segment.value, 0))
const radius = 66
const circumference = 2 * Math.PI * radius
const arcs = computed(() => {
  let offset = 0
  return props.segments.filter((segment) => segment.value > 0).map((segment) => {
    const length = segment.value / (total.value || 1) * circumference
    const arc = { ...segment, length, offset, percent: Math.round(segment.value / (total.value || 1) * 100) }
    offset += length
    return arc
  })
})
const formatNumber = (value: number) => new Intl.NumberFormat('es-PE').format(value)
</script>

<template>
  <section class="flex h-full min-h-[420px] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-none">
    <div><h2 class="text-[15px] font-semibold tracking-tight text-[#000051]">{{ title }}</h2><p class="mt-1 text-xs text-slate-600">{{ description }}</p></div>
    <div v-if="total" class="mt-3 grid flex-1 content-center justify-items-center gap-3 xl:grid-cols-1">
      <div class="relative mx-auto size-36 shrink-0" role="img" :aria-label="`${title}: ${formatNumber(total)} en total`">
        <svg class="size-full -rotate-90" viewBox="0 0 160 160" aria-hidden="true">
          <circle cx="80" cy="80" :r="radius" fill="none" stroke="#eef2f7" stroke-width="19" />
          <circle v-for="arc in arcs" :key="arc.key" cx="80" cy="80" :r="radius" fill="none" :stroke="arc.color" stroke-width="19" stroke-linecap="butt" :stroke-dasharray="`${arc.length} ${circumference - arc.length}`" :stroke-dashoffset="-arc.offset"><title>{{ arc.label }}: {{ formatNumber(arc.value) }} ({{ arc.percent }}%)</title></circle>
        </svg>
        <div class="absolute inset-0 grid place-content-center text-center"><strong class="text-2xl tabular-nums text-slate-950">{{ formatNumber(total) }}</strong><span class="text-[11px] text-slate-600">total actual</span></div>
      </div>
      <ul class="w-full space-y-2">
        <li v-for="arc in arcs" :key="arc.key" class="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-1.5 text-[11px]">
          <span class="size-2.5 rounded-sm" :style="{ backgroundColor: arc.color }" />
          <span class="truncate text-slate-700">{{ arc.label }}</span>
          <span class="text-right tabular-nums"><strong class="text-slate-900">{{ formatNumber(arc.value) }}</strong><span class="ml-1 text-slate-600">{{ arc.percent }}%</span></span>
        </li>
      </ul>
    </div>
    <div v-else class="mt-5 grid h-44 place-items-center rounded-lg bg-slate-50 text-center"><div><p class="font-medium text-slate-800">Aún no hay expedientes</p><p class="mt-1 text-xs text-slate-600">El gráfico aparecerá cuando haya movimientos.</p></div></div>
  </section>
</template>
