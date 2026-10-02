<script setup lang="ts">
import { ChevronLeft, ChevronRight, Eye, FolderOpen, Plus } from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'

definePageMeta({ middleware: 'auth', ssr: false })

interface ExpedientRow {
  id: string
  contractId: string
  contractNumber: string
  holderName: string
  holderDni: string
  advisorName: string
  status: string
  documentCount: number
  createdAt: string
  updatedAt: string
  sentToCommercialAt: string | null
  sentToVerificationAt: string | null
  verifiedAt: string | null
}

interface ExpedientsResponse {
  data: ExpedientRow[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const { user } = useAuth()
const holderName = ref('')
const holderDni = ref('')
const advisorName = ref('')
const status = ref('')
const page = ref(1)
const loading = ref(true)
const error = ref('')
const expedients = ref<ExpedientRow[]>([])
const pagination = ref<ExpedientsResponse['pagination']>({ page: 1, limit: 15, total: 0, totalPages: 0 })

const canFilterAdvisor = computed(() => user.value?.role?.name !== 'asesor')

const loadExpedients = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await $fetch<ExpedientsResponse>('/api/expedients', {
      query: {
        page: page.value,
        holderName: holderName.value || undefined,
        holderDni: holderDni.value || undefined,
        advisorName: canFilterAdvisor.value ? advisorName.value || undefined : undefined,
        status: status.value || undefined
      },
      credentials: 'include'
    })
    expedients.value = response.data
    pagination.value = response.pagination
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'No pudimos cargar los expedientes.'
  } finally {
    loading.value = false
  }
}

const applyFilters = async () => {
  page.value = 1
  await loadExpedients()
}

const debouncedApplyFilters = useDebounceFn(() => applyFilters(), 350)
const goToPage = async (nextPage: number) => {
  if (nextPage < 1 || nextPage > pagination.value.totalPages || nextPage === page.value) return
  page.value = nextPage
  await loadExpedients()
}

const pageItems = computed<(number | 'ellipsis')[]>(() => {
  const total = pagination.value.totalPages
  const current = page.value
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const items: (number | 'ellipsis')[] = [1]
  if (current > 4) items.push('ellipsis')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let item = start; item <= end; item++) items.push(item)
  if (current < total - 3) items.push('ellipsis')
  items.push(total)
  return items
})

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—'

const statusLabel = (value: string) => ({
  PENDIENTE: 'Pendiente',
  EN_COMERCIAL: 'En comercial',
  REBOTADO_COMERCIAL: 'Rebotado comercial',
  EN_VERIFICACION: 'En verificación',
  REBOTADO_VERIFICACION: 'Rebotado verificación',
  VERIFICADA_CON_OBSERVACIONES: 'Verificada con observaciones',
  VERIFICADA: 'Verificada'
}[value] || value)

const statusVariant = (value: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
  if (value.startsWith('REBOTADO')) return 'destructive'
  if (value === 'VERIFICADA') return 'default'
  if (value === 'EN_VERIFICACION' || value === 'VERIFICADA_CON_OBSERVACIONES') return 'secondary'
  return 'outline'
}

watch([holderName, holderDni, advisorName, status], () => debouncedApplyFilters())
onMounted(loadExpedients)
</script>

<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader title="Expedientes" subtitle="Consulta y seguimiento documental de las matrículas" />
    <main class="mx-auto max-w-[1500px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">Expedientes</h1>
          <p class="mt-1 text-muted-foreground">{{ pagination.total }} expedientes encontrados.</p>
        </div>
        <UiButton class="gap-2" as-child>
          <NuxtLink to="/expedientes/nuevo"><Plus class="size-4" /> Nuevo expediente</NuxtLink>
        </UiButton>
      </section>

      <UiCard>
        <UiCardHeader class="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
          <div>
            <UiCardTitle>Expedientes</UiCardTitle>
            <UiCardDescription>Consulta y seguimiento de los expedientes registrados.</UiCardDescription>
          </div>
          <div class="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
            <UiInput v-model="holderName" placeholder="Nombre del titular" aria-label="Nombre del titular" />
            <UiInput v-model="holderDni" placeholder="DNI del titular" aria-label="DNI del titular" />
            <UiInput v-if="canFilterAdvisor" v-model="advisorName" placeholder="Nombre del asesor" aria-label="Nombre del asesor" />
            <UiSelect v-model="status">
              <UiSelectTrigger class="w-full" aria-label="Estado del expediente"><UiSelectValue placeholder="Todos los estados" /></UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="PENDIENTE">Pendiente</UiSelectItem>
                <UiSelectItem value="EN_COMERCIAL">En comercial</UiSelectItem>
                <UiSelectItem value="REBOTADO_COMERCIAL">Rebotado comercial</UiSelectItem>
                <UiSelectItem value="EN_VERIFICACION">En verificación</UiSelectItem>
                <UiSelectItem value="REBOTADO_VERIFICACION">Rebotado verificación</UiSelectItem>
                <UiSelectItem value="VERIFICADA_CON_OBSERVACIONES">Verificada con observaciones</UiSelectItem>
                <UiSelectItem value="VERIFICADA">Verificada</UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>
        </UiCardHeader>
        <UiCardContent class="p-0">
          <div v-if="loading" class="space-y-3 p-6"><UiSkeleton v-for="row in 6" :key="row" class="h-12 w-full" /></div>
          <UiAlert v-else-if="error" variant="destructive" class="m-6"><UiAlertDescription>{{ error }}</UiAlertDescription></UiAlert>
          <div v-else-if="!expedients.length" class="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <FolderOpen class="mb-3 size-8 text-muted-foreground" />
            <p class="font-medium">No hay expedientes para mostrar</p>
            <p class="mt-1 text-sm text-muted-foreground">Prueba cambiando los filtros de búsqueda.</p>
          </div>
          <UiTable v-else>
            <UiTableHeader>
              <UiTableRow>
                <UiTableHead>Matrícula</UiTableHead>
                <UiTableHead>Titular</UiTableHead>
                <UiTableHead>Asesor</UiTableHead>
                <UiTableHead>Estado</UiTableHead>
                <UiTableHead class="hidden md:table-cell">Documentos</UiTableHead>
                <UiTableHead class="hidden sm:table-cell">Actualizado</UiTableHead>
                <UiTableHead class="text-right">Acciones</UiTableHead>
              </UiTableRow>
            </UiTableHeader>
            <UiTableBody>
              <UiTableRow v-for="expedient in expedients" :key="expedient.id">
                <UiTableCell class="font-semibold text-primary">{{ expedient.contractNumber }}</UiTableCell>
                <UiTableCell><div class="max-w-56 truncate font-medium uppercase">{{ expedient.holderName }}</div><div class="text-xs text-muted-foreground">{{ expedient.holderDni }}</div></UiTableCell>
                <UiTableCell>{{ expedient.advisorName }}</UiTableCell>
                <UiTableCell><UiBadge :variant="statusVariant(expedient.status)">{{ statusLabel(expedient.status) }}</UiBadge></UiTableCell>
                <UiTableCell class="hidden md:table-cell">{{ expedient.documentCount }}</UiTableCell>
                <UiTableCell class="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{{ formatDate(expedient.updatedAt) }}</UiTableCell>
                <UiTableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <UiButton variant="ghost" size="icon" title="Gestionar expediente" aria-label="Gestionar expediente" as-child>
                      <NuxtLink :to="`/expedientes/${expedient.id}`"><FolderOpen class="size-4" /></NuxtLink>
                    </UiButton>
                    <UiButton variant="ghost" size="icon" title="Ver matrícula" aria-label="Ver matrícula" as-child>
                      <NuxtLink :to="`/matricula/${expedient.contractId}`"><Eye class="size-4" /></NuxtLink>
                    </UiButton>
                  </div>
                </UiTableCell>
              </UiTableRow>
            </UiTableBody>
          </UiTable>
        </UiCardContent>
        <UiCardFooter v-if="!loading && pagination.totalPages > 1" class="flex-col gap-4 border-t sm:flex-row sm:justify-between">
          <p class="text-sm text-muted-foreground">Mostrando página <span class="font-semibold text-foreground">{{ pagination.page }}</span> de {{ pagination.totalPages }}</p>
          <nav aria-label="Paginación de expedientes" class="flex items-center gap-1">
            <UiButton variant="outline" size="icon" class="size-8" :disabled="page <= 1" aria-label="Primera página" title="Primera página" @click="goToPage(1)">«</UiButton>
            <UiButton variant="outline" size="icon" class="size-8" :disabled="page <= 1" aria-label="Página anterior" title="Página anterior" @click="goToPage(page - 1)"><ChevronLeft class="size-4" /></UiButton>
            <template v-for="(item, index) in pageItems" :key="`${item}-${index}`">
              <span v-if="item === 'ellipsis'" class="grid size-8 place-items-center text-sm text-muted-foreground">…</span>
              <UiButton v-else :variant="item === page ? 'default' : 'outline'" size="icon" class="size-8" :aria-current="item === page ? 'page' : undefined" :aria-label="`Página ${item}`" @click="goToPage(item)">{{ item }}</UiButton>
            </template>
            <UiButton variant="outline" size="icon" class="size-8" :disabled="page >= pagination.totalPages" aria-label="Página siguiente" title="Página siguiente" @click="goToPage(page + 1)"><ChevronRight class="size-4" /></UiButton>
            <UiButton variant="outline" size="icon" class="size-8" :disabled="page >= pagination.totalPages" aria-label="Última página" title="Última página" @click="goToPage(pagination.totalPages)">»</UiButton>
          </nav>
        </UiCardFooter>
      </UiCard>
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
