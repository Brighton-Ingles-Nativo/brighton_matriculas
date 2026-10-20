<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader title="Expedientes" subtitle="Consulta y seguimiento documental de las matrículas" />
    <main class="mx-auto max-w-[1500px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">Expedientes</h1>
          <p class="mt-1 text-muted-foreground">{{ pagination.total }} expedientes encontrados.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UiButton v-if="canExport" variant="outline" class="gap-2" as-child>
            <a :href="exportUrl"><Download class="size-4" /> Exportar Excel</a>
          </UiButton>
          <UiButton v-if="canCreateExpedient" class="gap-2" as-child>
            <NuxtLink to="/expedientes/nuevo"><Plus class="size-4" /> Nuevo expediente</NuxtLink>
          </UiButton>
        </div>
      </section>

      <UiCard>
        <UiCardHeader class="flex-col items-stretch gap-4 border-b">
          <div>
            <UiCardTitle>Expedientes</UiCardTitle>
            <UiCardDescription>Consulta y seguimiento de los expedientes registrados.</UiCardDescription>
          </div>
          <div class="filter-grid">
            <UiInput v-model="search" placeholder="Buscar por matrícula, titular, DNI o asesor" aria-label="Buscar por matrícula, titular, DNI o asesor" />
            <UiSelect v-model="status">
              <UiSelectTrigger class="w-full" aria-label="Estado del expediente"><UiSelectValue placeholder="Todos los estados" /></UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="PENDIENTE">Pendiente</UiSelectItem>
                <UiSelectItem value="EN_COMERCIAL">En comercial</UiSelectItem>
                <UiSelectItem value="REBOTADO_COMERCIAL">Rebotado comercial</UiSelectItem>
                <UiSelectItem value="EN_VERIFICACION">En verificación</UiSelectItem>
                <UiSelectItem value="COLA_VERIFICACION">Cola de verificación</UiSelectItem>
                <UiSelectItem value="REBOTADO_VERIFICACION">Rebotado verificación</UiSelectItem>
                <UiSelectItem value="VERIFICADA_CON_OBSERVACIONES">Verificada con observaciones</UiSelectItem>
                <UiSelectItem value="VERIFICADA">Verificada</UiSelectItem>
              </UiSelectContent>
            </UiSelect>
            <UiSelect v-model="location">
              <UiSelectTrigger class="w-full" aria-label="Ubicación del expediente"><UiSelectValue placeholder="Todas las ubicaciones" /></UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="ASESOR">Asesor</UiSelectItem>
                <UiSelectItem value="SUPERVISOR">Supervisor</UiSelectItem>
                <UiSelectItem value="ASISTENTE_COMERCIAL">Asistente comercial</UiSelectItem>
                <UiSelectItem value="VERIFICACION">Verificación</UiSelectItem>
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
                <UiTableHead>Ubicación</UiTableHead>
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
                <UiTableCell><UiBadge variant="outline">{{ locationLabel(expedient.currentLocation) }}</UiBadge></UiTableCell>
                <UiTableCell class="hidden md:table-cell">{{ expedient.documentCount }}</UiTableCell>
                <UiTableCell class="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{{ formatDate(expedient.updatedAt) }}</UiTableCell>
                <UiTableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <UiButton variant="outline" size="icon" :title="generatingPdfId === expedient.id ? 'Generando expediente PDF' : 'Generar expediente PDF'" :aria-label="`Generar expediente PDF para ${expedient.contractNumber}`" :disabled="Boolean(generatingPdfId)" @click="generateExpedientPdf(expedient)">
                      <LoaderCircle v-if="generatingPdfId === expedient.id" class="size-4 animate-spin" />
                      <FileDown v-else class="size-4" />
                    </UiButton>
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
      <UiAlert v-if="pdfError" variant="destructive"><UiAlertDescription>{{ pdfError }}</UiAlertDescription></UiAlert>
      <div class="receipt-pdf-renderer" aria-hidden="true">
        <ReceiptDocument v-for="(receipt, index) in receiptPdfRows" :key="receipt.id" :receipt="receipt" :ref="instance => setReceiptPdfRef(instance, index)" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { PDFDocument as PdfDocument } from 'pdf-lib'
import { ChevronLeft, ChevronRight, Download, Eye, FileDown, FolderOpen, LoaderCircle, Plus } from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'
import ReceiptDocument from '~/components/recibo/ReceiptDocument.vue'
import { createReceiptPdf } from '~/utils/receipt-pdf'

definePageMeta({ middleware: ['auth', 'expedients'], ssr: false })

interface ExpedientRow {
  id: string
  contractId: string
  contractNumber: string
  holderName: string
  holderDni: string
  advisorName: string
  status: string
  currentLocation: string
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

interface ReceiptDocumentInstance { getRoot: () => HTMLElement | null }

const { user } = useAuth()
const route = useRoute()

const canCreateExpedient = computed(() => 
  ['asesor', 'supervisor','admin']
  .includes(user.value?.role?.name || '')
)
const canExport = computed(() => 
  ['admin', 'asesor', 'supervisor', 'asistente_comercial', 'verificador']
  .includes(user.value?.role?.name || '')
)

const search = ref('')
const status = ref(typeof route.query.status === 'string' ? route.query.status : '')
const location = ref('')
const page = ref(1)
const loading = ref(true)
const error = ref('')
const expedients = ref<ExpedientRow[]>([])
const pagination = ref<ExpedientsResponse['pagination']>({ page: 1, limit: 15, total: 0, totalPages: 0 })
const generatingPdfId = ref<string | null>(null)
const pdfError = ref('')
const receiptPdfRows = ref<any[]>([])
const receiptPdfRefs = shallowRef<Array<ReceiptDocumentInstance | null>>([])

const setReceiptPdfRef = (instance: unknown, index: number) => {
  receiptPdfRefs.value[index] = instance as ReceiptDocumentInstance | null
}

const fetchAllReceiptDetails = async (contractId: string) => {
  const receipts: Array<{ id: string }> = []
  let page = 1
  let totalPages = 1
  do {
    const response = await $fetch<{ data: Array<{ id: string }>; pagination: { totalPages: number } }>('/api/receipts', {
      query: { contractId, page, limit: 50 }, credentials: 'include'
    })
    receipts.push(...response.data)
    totalPages = response.pagination.totalPages
    page += 1
  } while (page <= totalPages)

  const details = await Promise.all(receipts.map(async (receipt) => {
    const response = await $fetch<{ data: any }>(`/api/receipts/${receipt.id}`, { credentials: 'include' })
    return response.data
  }))
  return details.sort((left, right) => new Date(left.transactionDate || left.registeredAt).getTime() - new Date(right.transactionDate || right.registeredAt).getTime())
}

const imageAsPng = async (blob: Blob): Promise<Uint8Array> => {
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo procesar una imagen del expediente.')
    context.drawImage(image, 0, 0)
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo convertir una imagen del expediente.')), 'image/png'))
    return new Uint8Array(await png.arrayBuffer())
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const appendPdf = async (target: PdfDocument, bytes: Uint8Array) => {
  const { PDFDocument } = await import('pdf-lib')
  const source = await PDFDocument.load(bytes)
  const pages = await target.copyPages(source, source.getPageIndices())
  pages.forEach(page => target.addPage(page))
}

const appendImage = async (target: PdfDocument, blob: Blob) => {
  const image = await target.embedPng(await imageAsPng(blob))
  const pageWidth = 595.28
  const pageHeight = 841.89
  const padding = 24
  const scale = Math.min((pageWidth - padding * 2) / image.width, (pageHeight - padding * 2) / image.height)
  const width = image.width * scale
  const height = image.height * scale
  const page = target.addPage([pageWidth, pageHeight])
  page.drawImage(image, { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height })
}

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const generateExpedientPdf = async (row: ExpedientRow) => {
  if (generatingPdfId.value) return
  generatingPdfId.value = row.id
  pdfError.value = ''
  try {
    const [detail, receiptDetails, contractResponse] = await Promise.all([
      $fetch<{ data: { documents: Array<{ id: string; fileName: string; mimeType: string }> } }>(`/api/expedients/${row.id}`, { credentials: 'include' }),
      fetchAllReceiptDetails(row.contractId),
      fetch(`/api/contracts/${row.contractId}/pdf`, { credentials: 'include' })
    ])
    if (!contractResponse.ok) throw new Error('No se pudo generar el PDF de la matrícula/contrato.')

    const { PDFDocument } = await import('pdf-lib')
    const pdf = await PDFDocument.create()
    await appendPdf(pdf, new Uint8Array(await contractResponse.arrayBuffer()))

    const documents = detail.data.documents
    const documentFiles = await Promise.all(documents.map(async document => {
      const response = await fetch(`/api/expedients/${row.id}/documents/${document.id}/content`, { credentials: 'include' })
      if (!response.ok) throw new Error(`No se pudo descargar ${document.fileName}.`)
      return { document, blob: await response.blob() }
    }))
    for (const { document, blob } of documentFiles) {
      if (document.mimeType === 'application/pdf') await appendPdf(pdf, new Uint8Array(await blob.arrayBuffer()))
      else if (document.mimeType.startsWith('image/')) await appendImage(pdf, blob)
      else throw new Error(`El archivo ${document.fileName} tiene un formato no compatible.`)
    }

    receiptPdfRows.value = receiptDetails
    receiptPdfRefs.value = []
    await nextTick()
    for (let index = 0; index < receiptDetails.length; index += 1) {
      const element = receiptPdfRefs.value[index]?.getRoot()
      if (!element) throw new Error('No se pudo preparar uno de los recibos de pago.')
      const receiptPdf = await createReceiptPdf(element)
      await appendPdf(pdf, new Uint8Array(await receiptPdf.arrayBuffer()))
    }

    const output = await pdf.save()
    const safeNumber = row.contractNumber.replace(/[^\p{L}\p{N}-]+/gu, '-')
    downloadBlob(new Blob([output as BlobPart], { type: 'application/pdf' }), `Expediente-${safeNumber || row.id}.pdf`)
    pdfError.value = ''
  } catch (error: any) {
    pdfError.value = error?.data?.message || error?.message || 'No se pudo generar el PDF del expediente.'
  } finally {
    receiptPdfRows.value = []
    receiptPdfRefs.value = []
    generatingPdfId.value = null
  }
}

const exportUrl = computed(() => {
  const params = new URLSearchParams({ format: 'xlsx' })
  if (search.value) params.set('search', search.value)
  if (status.value) params.set('status', status.value)
  if (location.value) params.set('location', location.value)
  return `/api/expedients/export?${params.toString()}`
})

const loadExpedients = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await $fetch<ExpedientsResponse>('/api/expedients', {
      query: {
        page: page.value,
        search: search.value || undefined,
        status: status.value || undefined,
        location: location.value || undefined
      },
      credentials: 'include'
    })
    expedients.value = response.data
    pagination.value = response.pagination
  } catch (err: any) {
    error.value = err?.data?.message || err?.data?.statusMessage || 'No pudimos cargar los expedientes.'
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

const statusLabel = (value: string) => ({ CREADO: 'Creado', REBOTADO: 'Rebotado', AGENDADO: 'Agendado', OBSERVADO: 'Observado', VERIFICADO: 'Verificado' }[value] || value)
const locationLabel = (value: string) => ({ ASESOR: 'Asesor', SUPERVISOR: 'Supervisor', ASISTENTE_COMERCIAL: 'Asistente comercial', VERIFICACION: 'Verificación' }[value] || value)
const statusVariant = (value: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
  if (value === 'REBOTADO') return 'destructive'
  if (value === 'VERIFICADO') return 'default'
  if (value === 'AGENDADO' || value === 'OBSERVADO') return 'secondary'
  return 'outline'
}

watch([search, status, location], () => debouncedApplyFilters())
onMounted(loadExpedients)
</script>

<style scoped>
.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  gap: 0.5rem;
  width: 100%;
}

.receipt-pdf-renderer {
  position: fixed;
  top: 0;
  left: 0;
  z-index: -1;
  width: 848px;
  opacity: 0;
  pointer-events: none;
}

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
