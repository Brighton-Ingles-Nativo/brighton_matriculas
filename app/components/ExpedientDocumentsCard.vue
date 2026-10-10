<script setup lang="ts">
import { Download, FileUp, LoaderCircle, Trash2 } from '@lucide/vue'

type DocumentType = 'DNI' | 'VOUCHER' | 'ADICIONAL'
interface ExpedientDocument {
  id: string
  type: DocumentType
  fileName: string
  mimeType: string
  fileSize: number | null
  uploadedAt: string
  downloadUrl: string
}
interface Expedient {
  id: string
  status: string
  currentLocation: string
  documents: ExpedientDocument[]
}

const props = defineProps<{ contractId: string; contractAccepted: boolean }>()
const { csrfHeaders, user } = useAuth()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
const expedient = ref<Expedient | null>(null)
const files = reactive<Record<DocumentType, File | null>>({ DNI: null, VOUCHER: null, ADICIONAL: null })

const labels: Record<DocumentType, string> = { DNI: 'DNI del titular', VOUCHER: 'Voucher de pago', ADICIONAL: 'Documento adicional' }
const selectedFile = (type: DocumentType) => files[type]
const formatSize = (value: number | null) => value ? `${(value / 1024 / 1024).toFixed(2)} MB` : '—'
const documentFor = (type: DocumentType) => expedient.value?.documents.find((document) => document.type === type)
const canManageDocuments = computed(() => {
  const role = user.value?.role?.name
  if (role === 'admin') return true
  if (role === 'asesor') return !expedient.value || expedient.value.currentLocation === 'ASESOR'
  if (role === 'supervisor') return !expedient.value
  return false
})

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await $fetch<{ data: Expedient }>(`/api/expedients/by-contract/${props.contractId}`, { credentials: 'include' })
    expedient.value = response.data
  } catch (err: any) {
    if (err?.statusCode !== 404 && err?.data?.statusCode !== 404) error.value = err?.data?.statusMessage || 'No se pudo cargar el expediente.'
  } finally {
    loading.value = false
  }
}

const setFile = (type: DocumentType, event: Event) => {
  const input = event.target as HTMLInputElement
  files[type] = input.files?.[0] || null
}

const upload = async (type: DocumentType) => {
  const file = selectedFile(type)
  if (!file) return
  const creating = !expedient.value
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const body = new FormData()
    body.append('type', type)
    body.append('file', file)
    const target = expedient.value ? `/api/expedients/${expedient.value.id}/documents` : '/api/expedients'
    if (!expedient.value) {
      body.append('contractId', props.contractId)
      for (const requiredType of ['DNI', 'VOUCHER'] as const) {
        if (requiredType !== type && files[requiredType]) body.append(requiredType === 'DNI' ? 'dni' : 'voucher', files[requiredType] as File)
      }
      if (files.ADICIONAL && type !== 'ADICIONAL') body.append('additional', files.ADICIONAL)
      if (!files.DNI || !files.VOUCHER) throw new Error('Debes seleccionar el DNI y el voucher para crear el expediente.')
      body.delete('type')
      body.delete('file')
      body.append('dni', files.DNI)
      body.append('voucher', files.VOUCHER)
      if (files.ADICIONAL) body.append('additional', files.ADICIONAL)
    }
    const response = await $fetch<{ data: { id: string } }>(target, { method: 'POST', headers: await csrfHeaders(), credentials: 'include', body })
    success.value = 'Documento cargado correctamente.'
    if (creating) {
      files.DNI = null
      files.VOUCHER = null
      files.ADICIONAL = null
    } else {
      files[type] = null
    }
    await load()
    return response
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.message || 'No se pudo cargar el documento.'
  } finally {
    saving.value = false
  }
}

const remove = async (document: ExpedientDocument) => {
  if (!window.confirm(`¿Eliminar ${labels[document.type].toLowerCase()}?`)) return
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/expedients/${expedient.value?.id}/documents/${document.id}`, { method: 'DELETE', headers: await csrfHeaders(), credentials: 'include' })
    success.value = 'Documento eliminado.'
    await load()
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'No se pudo eliminar el documento.'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <UiCard>
    <UiCardHeader>
      <UiCardTitle>Expediente documental</UiCardTitle>
      <UiCardDescription>Adjunta el DNI, voucher y documento adicional de la matrícula.</UiCardDescription>
    </UiCardHeader>
    <UiCardContent class="space-y-4">
      <UiAlert v-if="!contractAccepted" class="border-amber-200 bg-amber-50 text-amber-900">
        <UiAlertDescription>El expediente se habilita cuando el cliente firma el contrato.</UiAlertDescription>
      </UiAlert>
      <UiAlert v-if="error" variant="destructive"><UiAlertDescription>{{ error }}</UiAlertDescription></UiAlert>
      <UiAlert v-if="success"><UiAlertDescription>{{ success }}</UiAlertDescription></UiAlert>
      <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle class="size-4 animate-spin" /> Cargando expediente…</div>
      <div v-else class="space-y-3">
        <div v-for="type in (['DNI', 'VOUCHER', 'ADICIONAL'] as DocumentType[])" :key="type" class="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <p class="font-medium">{{ labels[type] }} <span v-if="type !== 'ADICIONAL'" class="text-destructive">*</span></p>
            <p v-if="documentFor(type)" class="truncate text-xs text-muted-foreground">{{ documentFor(type)?.fileName }} · {{ formatSize(documentFor(type)?.fileSize || null) }}</p>
            <p v-else class="text-xs text-muted-foreground">No cargado</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <a v-if="documentFor(type)" class="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted" :href="documentFor(type)?.downloadUrl" target="_blank" rel="noreferrer"><Download class="size-4" /> Descargar</a>
            <label v-if="contractAccepted && canManageDocuments" class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted" :class="{ 'pointer-events-none opacity-50': saving }">
              <FileUp class="size-4" /> {{ documentFor(type) ? 'Reemplazar' : 'Cargar' }}
              <input class="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" :disabled="saving" @change="setFile(type, $event)">
            </label>
            <UiButton v-if="selectedFile(type) && canManageDocuments" size="sm" :disabled="saving" @click="upload(type)">Guardar</UiButton>
            <UiButton v-if="documentFor(type) && canManageDocuments" variant="ghost" size="icon" title="Eliminar documento" :disabled="saving" @click="remove(documentFor(type)!)"><Trash2 class="size-4" /></UiButton>
          </div>
        </div>
      </div>
      <p class="text-xs text-muted-foreground">Formatos permitidos: PDF, JPG, PNG o WEBP. Tamaño máximo: 10 MB por archivo.</p>
    </UiCardContent>
  </UiCard>
</template>
