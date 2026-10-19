<script setup lang="ts">
import { ChevronLeft, ChevronRight, Eye, FileDown, FilePlus2, LoaderCircle, Printer, Search } from '@lucide/vue'
import ReceiptDocument from '~/components/recibo/ReceiptDocument.vue'
import { downloadReceiptPdf, waitForReceiptAssets } from '~/utils/receipt-pdf'
definePageMeta({ 
  middleware: 'auth', 
  ssr: false 
})

interface ReceiptRow { 
  id: string; 
  amount: string | null; 
  concepts: string | null; 
  otherConcept: string | null; 
  paymentMethod: string | null; 
  transactionDate: string | null; 
  registeredAt: string; 
  contract: { 
    id: string; 
    contractNumber: string; 
    holderName: string; 
    holderDni: string 
  } 
}

interface ResponseData { 
  data: ReceiptRow[]; 
  pagination: { 
    page: number; 
    limit: number; 
    total: number; 
    totalPages: number 
  } 
}

const search = ref(''); 
const page = ref(1); 
const loading = ref(true); 
const error = ref(''); 
const receipts = ref<ReceiptRow[]>([]); 
const pagination = ref<ResponseData['pagination']>({ page: 1, limit: 15, total: 0, totalPages: 0 })
const actionError = ref('')
const actionReceipt = ref<any>(null)
const actionReceiptDocument = ref<{ getRoot: () => HTMLElement | null } | null>(null)
const actionProcessingId = ref<string | null>(null)
const actionKind = ref<'download' | 'print' | null>(null)

const loadReceipts = async () => { 
  loading.value = true; error.value = ''; 
  try { 
    const response = await $fetch<ResponseData>('/api/receipts', { 
      query: { 
        page: page.value, 
        search: search.value || undefined 
      }, 
      credentials: 'include' 
    }); 
    receipts.value = response.data; 
    pagination.value = response.pagination 
  } catch (err: any) { 
    error.value = err?.data?.message || err?.data?.statusMessage || 'No pudimos cargar los recibos.'
  } finally { 
    loading.value = false 
  } 
}

const submitSearch = async () => { 
  page.value = 1; 
  await loadReceipts() 
}; 
const goToPage = async (nextPage: number) => { 
  if (nextPage < 1 || nextPage > pagination.value.totalPages || nextPage === page.value) 
  return; 
  page.value = nextPage; 
  await loadReceipts() 
}
const pageItems = computed<(number | 'ellipsis')[]>(() => { 
  const total = pagination.value.totalPages; 
  const current = page.value; 
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1); 
  const items: (number | 'ellipsis')[] = [1]; 
  if (current > 4) items.push('ellipsis'); 
  const start = Math.max(2, current - 1); 
  const end = Math.min(total - 1, current + 1); 
  for (let item = start; item <= end; item++) items.push(item); 
  if (current < total - 3) 
  items.push('ellipsis'); 
  items.push(total); 
  return items 
})

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(value)) : '—'; 
const formatCurrency = (value: string | null) => value ? new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value)) : '—'; 
const concept = (row: ReceiptRow) => row.concepts || (row.otherConcept ? `OTROS: ${row.otherConcept}` : '—')
const receiptLink = (id: string) => ({ path: `/recibo/${id}`, query: { returnTo: '/recibos' } })

const cleanupPrintAction = () => {
  document.body.classList.remove('receipt-printing')
  window.removeEventListener('afterprint', cleanupPrintAction)
  actionReceipt.value = null
  actionProcessingId.value = null
  actionKind.value = null
}

const runReceiptAction = async (id: string, action: 'download' | 'print') => {
  if (actionProcessingId.value) return
  actionProcessingId.value = id
  actionKind.value = action
  actionError.value = ''

  let waitingForPrint = false
  try {
    const response = await $fetch<{ data: any }>(`/api/receipts/${id}`, { credentials: 'include' })
    actionReceipt.value = response.data
    await nextTick()

    const element = actionReceiptDocument.value?.getRoot()
    if (!element) throw new Error('No se pudo preparar el recibo.')

    if (action === 'download') {
      await downloadReceiptPdf(element, String(response.data.contract?.contractNumber || 'recibo'))
      return
    }

    await waitForReceiptAssets(element)
    document.body.classList.add('receipt-printing')
    window.addEventListener('afterprint', cleanupPrintAction, { once: true })
    waitingForPrint = true
    window.print()
  } catch (err: any) {
    console.error(`No se pudo ${action === 'download' ? 'descargar' : 'imprimir'} el recibo.`, err)
    actionError.value = err?.data?.message || err?.data?.statusMessage ||
      (action === 'download' ? 'No pudimos generar el PDF. Inténtalo nuevamente.' : 'No pudimos abrir la impresión del recibo.')
    cleanupPrintAction()
  } finally {
    if (!waitingForPrint) {
      actionReceipt.value = null
      actionProcessingId.value = null
      actionKind.value = null
    }
  }
}

onBeforeUnmount(cleanupPrintAction)

onMounted(loadReceipts)
</script>
<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader title="Recibos" subtitle="Consulta de todos los pagos registrados" />
    <main class="mx-auto max-w-[1500px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">Recibos</h1>
          <p class="mt-1 text-muted-foreground">{{ pagination.total }} recibos registrados.</p>
        </div>
        <form class="flex w-full gap-2 sm:w-auto" @submit.prevent="submitSearch">
          <div class="relative w-full sm:w-80">
            <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <UiInput v-model="search" class="pl-9" placeholder="Buscar contrato, titular o DNI" />
          </div>
          <UiButton type="submit" variant="outline" size="icon" aria-label="Buscar">
            <Search class="size-4" />
          </UiButton>
        </form>
      </section>
      <UiAlert v-if="actionError" variant="destructive">
        <UiAlertDescription>{{ actionError }}</UiAlertDescription>
      </UiAlert>
      <UiCard>
        <UiCardContent class="p-0">
          <div v-if="loading" class="space-y-3 p-6">
            <UiSkeleton v-for="row in 6" :key="row" class="h-12 w-full" />
          </div>
          <UiAlert v-else-if="error" variant="destructive" class="m-6">
            <UiAlertDescription>{{ error }}</UiAlertDescription>
          </UiAlert>
          <div v-else-if="!receipts.length" class="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <FilePlus2 class="mb-3 size-8 text-muted-foreground" />
            <p class="font-medium">No hay recibos registrados</p>
          </div>
          <UiTable v-else>
            <UiTableHeader>
              <UiTableRow>
                <UiTableHead>Contrato</UiTableHead>
                <UiTableHead>Titular</UiTableHead>
                <UiTableHead>Concepto</UiTableHead>
                <UiTableHead>Importe</UiTableHead>
                <UiTableHead>Forma de pago</UiTableHead>
                <UiTableHead>Fecha</UiTableHead>
                <UiTableHead class="text-right">Acciones</UiTableHead>
              </UiTableRow>
            </UiTableHeader>
            <UiTableBody>
              <UiTableRow v-for="receipt in receipts" :key="receipt.id">
                <UiTableCell class="font-semibold text-primary">{{ receipt.contract.contractNumber }}</UiTableCell>
                <UiTableCell>
                  <div class="max-w-56 truncate font-medium uppercase">{{ receipt.contract.holderName }}</div>
                  <div class="text-xs text-muted-foreground">{{ receipt.contract.holderDni }}</div>
                </UiTableCell>
                <UiTableCell class="max-w-64">
                  <UiBadge variant="outline" class="max-w-56 truncate" :title="concept(receipt)">
                    {{ concept(receipt) }}
                  </UiBadge>
                </UiTableCell>
                <UiTableCell class="whitespace-nowrap font-semibold">{{ formatCurrency(receipt.amount) }}</UiTableCell>
                <UiTableCell>
                  <UiBadge v-if="receipt.paymentMethod" variant="secondary">
                    {{ receipt.paymentMethod }}
                  </UiBadge>
                  <span v-else class="text-sm text-muted-foreground">—</span>
                </UiTableCell>
                <UiTableCell class="whitespace-nowrap">{{ formatDate(receipt.transactionDate || receipt.registeredAt) }}
                </UiTableCell>
                <UiTableCell>
                  <div class="flex justify-end gap-1">
                    <UiButton variant="default" size="icon-lg" title="Ver recibo" aria-label="Ver recibo" as-child>
                      <NuxtLink :to="receiptLink(receipt.id)">
                        <Eye class="size-4" />
                      </NuxtLink>
                    </UiButton>
                    <UiButton variant="success" size="icon-lg" title="Descargar recibo PDF" aria-label="Descargar recibo PDF"
                      :disabled="Boolean(actionProcessingId)" @click="runReceiptAction(receipt.id, 'download')">
                      <LoaderCircle v-if="actionProcessingId === receipt.id && actionKind === 'download'" class="size-4 animate-spin" />
                      <FileDown v-else class="size-4" />
                    </UiButton>
                    <UiButton variant="outline" size="icon-lg" title="Imprimir recibo" aria-label="Imprimir recibo"
                      :disabled="Boolean(actionProcessingId)" @click="runReceiptAction(receipt.id, 'print')">
                      <LoaderCircle v-if="actionProcessingId === receipt.id && actionKind === 'print'" class="size-4 animate-spin" />
                      <Printer v-else class="size-4" />
                    </UiButton>
                  </div>
                </UiTableCell>
              </UiTableRow>
            </UiTableBody>
          </UiTable>
        </UiCardContent>
        <UiCardFooter v-if="!loading && pagination.totalPages > 1"
          class="flex-col gap-4 border-t sm:flex-row sm:justify-between">
          <p class="text-sm text-muted-foreground">Mostrando página <span class="font-semibold text-foreground">{{
              pagination.page }}</span> de {{ pagination.totalPages }}</p>
          <nav aria-label="Paginación de recibos" class="flex items-center gap-1">
            <UiButton variant="outline" size="icon" class="size-8" :disabled="page <= 1" aria-label="Primera página"
              title="Primera página" @click="goToPage(1)">«</UiButton>
            <UiButton variant="outline" size="icon" class="size-8" :disabled="page <= 1" aria-label="Página anterior"
              title="Página anterior" @click="goToPage(page - 1)">
              <ChevronLeft class="size-4" />
            </UiButton>
            <template v-for="(item, index) in pageItems" :key="`${item}-${index}`"><span v-if="item === 'ellipsis'"
                class="grid size-8 place-items-center text-sm text-muted-foreground">…</span>
              <UiButton v-else :variant="item === page ? 'default' : 'outline'" size="icon" class="size-8"
                :aria-current="item === page ? 'page' : undefined" :aria-label="`Página ${item}`"
                @click="goToPage(item)">{{ item }}</UiButton>
            </template>
            <UiButton variant="outline" size="icon" class="size-8" :disabled="page >= pagination.totalPages"
              aria-label="Página siguiente" title="Página siguiente" @click="goToPage(page + 1)">
              <ChevronRight class="size-4" />
            </UiButton>
            <UiButton variant="outline" size="icon" class="size-8" :disabled="page >= pagination.totalPages"
              aria-label="Última página" title="Última página" @click="goToPage(pagination.totalPages)">»</UiButton>
          </nav>
        </UiCardFooter>
      </UiCard>
    </main>
    <div v-if="actionReceipt" id="receipt-print-stage" class="receipt-action-stage" aria-hidden="true">
      <ReceiptDocument ref="actionReceiptDocument" :receipt="actionReceipt" />
    </div>
  </div>
</template>

<style scoped>
.receipt-action-stage {
  position: fixed;
  top: 0;
  left: -10000px;
  width: 848px;
  pointer-events: none;
}

@media print {
  :global(body.receipt-printing *) {
    visibility: hidden !important;
  }

  :global(body.receipt-printing #receipt-print-stage),
  :global(body.receipt-printing #receipt-print-stage *) {
    visibility: visible !important;
  }

  :global(body.receipt-printing #receipt-print-stage) {
    position: fixed !important;
    inset: 0 auto auto 0 !important;
    display: block !important;
    width: 100% !important;
    pointer-events: auto !important;
  }

  :global(body.receipt-printing #receipt-print-stage .receipt-page) {
    width: 100% !important;
    max-width: none !important;
  }
}
</style>
