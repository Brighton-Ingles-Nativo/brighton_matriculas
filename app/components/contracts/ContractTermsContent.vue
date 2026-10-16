<script setup lang="ts">
import { BadgeCheck } from '@lucide/vue'

const props = defineProps<{
  html: string
  signed: boolean
  signedAt: string | null
  fallbackAt: string | null
  signedIp: string | null
  fallbackIp?: string | null
}>()

const acceptanceDate = computed(() => {
  const value = props.signedAt || props.fallbackAt
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(new Date(value)).replace(',', '')
})

const acceptanceIp = computed(() => props.signedIp || props.fallbackIp || '—')
</script>

<template>
  <div>
    <div v-html="html" />
    <div class="mt-4 grid items-center gap-8 text-green-800 sm:grid-cols-2" role="status">
      <div class="relative z-0 flex items-center gap-3 rounded-md border-2 border-emerald-200 bg-white p-4 before:absolute before:inset-[5px_-6px_-6px_5px] before:-z-10 before:bg-gray-100 before:content-['']">
        <BadgeCheck class="size-8 shrink-0 fill-emerald-900 text-white" aria-hidden="true" />
        <div class="min-w-0 text-emerald-950">
          <h3 class="mb-1 text-lg font-semibold leading-tight">{{ signed ? 'Contrato Aceptado Digitalmente' : 'Firma pendiente de aceptación' }}</h3>
          <p class="text-justify text-xs leading-relaxed">{{ signed ? 'Este documento fue validado el' : 'Documento registrado el' }} <strong>{{ acceptanceDate }}</strong>.</p>
          <p class="mt-1 text-xs leading-relaxed text-slate-500">Registro de Seguridad (IP): {{ acceptanceIp }}</p>
        </div>
      </div>
      <div class="flex justify-center">
        <img class="w-full max-w-[260px]" src="/assets/images/firma_gerencia-brighton.jpg" alt="Firma de gerencia Brighton" />
      </div>
    </div>
  </div>
</template>
