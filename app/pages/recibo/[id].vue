<script setup lang="ts">
import { ArrowLeft, FileDown, LoaderCircle } from '@lucide/vue'
import ReceiptDocument from '~/components/recibo/ReceiptDocument.vue'
import { downloadReceiptPdf } from '~/utils/receipt-pdf'

definePageMeta({ middleware: 'auth', ssr: false })

const route = useRoute()
const returnPath = computed(() => route.query.returnTo === '/recibos' ? '/recibos' : '/matriculas')
const returnLabel = computed(() => returnPath.value === '/recibos' ? 'Volver a recibos' : 'Volver a matrículas')
const loading = ref(true)
const error = ref('')
const receipt = ref<any>(null)
const exporting = ref(false)
const exportError = ref('')
const receiptDocument = ref<{ getRoot: () => HTMLElement | null } | null>(null)

const saveAsPdf = async () => {
  const element = receiptDocument.value?.getRoot()
  if (!element || exporting.value) return

  exporting.value = true
  exportError.value = ''
  try {
    await downloadReceiptPdf(element, String(receipt.value?.contract?.contractNumber || 'recibo'))
  } catch (err) {
    console.error('No se pudo generar el PDF del recibo.', err)
    exportError.value = 'No pudimos generar el PDF. Inténtalo nuevamente.'
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  try {
    const response = await $fetch<any>(`/api/receipts/${route.params.id}`, { credentials: 'include' })
    receipt.value = response.data
  } catch (err: any) {
    error.value = err?.data?.message || err?.data?.statusMessage || 'No pudimos cargar el recibo.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <div class="no-print">
      <AppHeader title="Recibo de pago" subtitle="Detalle del recibo registrado" />
    </div>
    <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div class="no-print mb-5 flex justify-between">
        <UiButton variant="outline" as-child>
          <NuxtLink :to="returnPath">
            <ArrowLeft class="mr-2 size-4" /> {{ returnLabel }}
          </NuxtLink>
        </UiButton>
        <UiButton v-if="receipt" class="gap-2" :disabled="exporting" @click="saveAsPdf">
          <LoaderCircle v-if="exporting" class="size-4 animate-spin" />
          <FileDown v-else class="size-4" /> {{ exporting ? 'Generando PDF…' : 'Descargar recibo PDF' }}
        </UiButton>
      </div>
      <UiAlert v-if="exportError" class="no-print mb-5" variant="destructive">
        <UiAlertDescription>{{ exportError }}</UiAlertDescription>
      </UiAlert>
      <UiSkeleton v-if="loading" class="h-96 w-full" />
      <UiAlert v-else-if="error" variant="destructive">
        <UiAlertDescription>{{ error }}</UiAlertDescription>
      </UiAlert>
      <ReceiptDocument v-else-if="receipt" ref="receiptDocument" :receipt="receipt" />
      <p v-else class="text-sm text-muted-foreground">No se encontró el recibo.</p>
    </main>
  </div>
</template>

<style scoped>
@media print {
  :global(body) {
    background: white !important;
  }

  .no-print {
    display: none !important;
  }

  main {
    max-width: none !important;
    padding: 0 !important;
  }
}
</style>
