<script setup lang="ts">
import { LoaderCircle, Save } from '@lucide/vue'

interface ContractSummary {
  id: string
  contractNumber: string
  holderName: string
  holderDni: string
}

interface ReceiptContract extends ContractSummary {
  holderAddress: string
  holderPhone: string
  initialPayment: string | null
}

const props = defineProps<{ open: boolean; contract: ContractSummary | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; created: [receiptId: string] }>()
const { csrfHeaders } = useAuth()
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const contract = ref<ReceiptContract | null>(null)
const form = reactive({
  amount: '', concepts: '', otherConcept: '', paymentMethod: '',
  operationNumber: '', bank: '', transactionDate: new Date().toISOString().slice(0, 10)
})

const resetForm = () => {
  Object.assign(form, { amount: '', concepts: '', otherConcept: '', paymentMethod: '', operationNumber: '', bank: '', transactionDate: new Date().toISOString().slice(0, 10) })
  error.value = ''
}

watch(() => [props.open, props.contract?.id] as const, async ([open, id]) => {
  if (!open || !id) return
  loading.value = true
  error.value = ''
  contract.value = null
  resetForm()
  try {
    const response = await $fetch<{ data: ReceiptContract }>(`/api/contracts/${id}`, { credentials: 'include' })
    contract.value = response.data
    form.amount = response.data.initialPayment || ''
  } catch (err: any) {
    error.value = err?.data?.message || err?.data?.statusMessage || 'No pudimos cargar los datos de la matrícula.'
  } finally {
    loading.value = false
  }
}, { immediate: true })

const submit = async () => {
  if (!contract.value) return
  saving.value = true
  error.value = ''
  try {
    const response = await $fetch<{ data: { id: string } }>('/api/receipts', {
      method: 'POST', headers: await csrfHeaders(), credentials: 'include',
      body: { ...form, contractId: contract.value.id }
    })
    emit('update:open', false)
    emit('created', response.data.id)
  } catch (err: any) {
    error.value = err?.data?.message || err?.data?.statusMessage || 'No pudimos registrar el recibo.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDialog :open="open" @update:open="emit('update:open', $event)">
    <UiDialogScrollContent class="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
      <UiDialogHeader>
        <UiDialogTitle>Generar recibo de pago</UiDialogTitle>
        <UiDialogDescription v-if="contract">Contrato {{ contract.contractNumber }} · {{ contract.holderName }}</UiDialogDescription>
        <UiDialogDescription v-else>Registrar un pago de matrícula.</UiDialogDescription>
      </UiDialogHeader>

      <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <LoaderCircle class="size-4 animate-spin" /> Cargando datos de la matrícula…
      </div>
      <UiAlert v-else-if="error && !contract" variant="destructive"><UiAlertDescription>{{ error }}</UiAlertDescription></UiAlert>
      <form v-else-if="contract" class="grid gap-5 sm:grid-cols-2" @submit.prevent="submit">
        <div class="space-y-2"><UiLabel for="receipt-holder">Nombre del titular</UiLabel><UiInput id="receipt-holder" :model-value="contract.holderName" readonly /></div>
        <div class="space-y-2"><UiLabel for="receipt-dni">DNI</UiLabel><UiInput id="receipt-dni" :model-value="contract.holderDni" readonly /></div>
        <div class="space-y-2 sm:col-span-2"><UiLabel for="receipt-address">Dirección</UiLabel><UiInput id="receipt-address" :model-value="contract.holderAddress" readonly /></div>
        <div class="space-y-2"><UiLabel for="receipt-phone">Celular</UiLabel><UiInput id="receipt-phone" :model-value="contract.holderPhone" readonly /></div>
        <div class="space-y-2"><UiLabel for="receipt-amount">Importe recibido (S/)</UiLabel><UiInput id="receipt-amount" v-model="form.amount" type="number" min="0.01" step="0.01" required /></div>
        <div class="space-y-2"><UiLabel for="receipt-date">Fecha de transacción</UiLabel><UiDatePicker id="receipt-date" v-model="form.transactionDate" required /></div>

        <fieldset class="space-y-3 sm:col-span-2">
          <legend class="text-sm font-medium">Por concepto de</legend>
          <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <label v-for="item in ['Valor Total', 'Cuota Inicial', 'Cuota Mensual', 'Otros']" :key="item" class="flex items-center gap-2">
              <input v-model="form.concepts" type="radio" name="receipt-concept" :value="item" required class="accent-primary" />{{ item }}
            </label>
          </div>
        </fieldset>
        <div v-if="form.concepts === 'Otros'" class="space-y-2 sm:col-span-2"><UiLabel for="receipt-other-concept">Especifique el concepto</UiLabel><UiInput id="receipt-other-concept" v-model="form.otherConcept" required /></div>

        <fieldset class="space-y-3 sm:col-span-2">
          <legend class="text-sm font-medium">Forma de pago</legend>
          <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <label v-for="item in ['Efectivo', 'Cheque', 'Depósito', 'Transferencia', 'POS', 'Otros']" :key="item" class="flex items-center gap-2">
              <input v-model="form.paymentMethod" type="radio" name="receipt-method" :value="item" required class="accent-primary" />{{ item }}
            </label>
          </div>
        </fieldset>
        <div class="space-y-2"><UiLabel for="receipt-operation">Número de operación</UiLabel><UiInput id="receipt-operation" v-model="form.operationNumber" /></div>
        <div class="space-y-2"><UiLabel for="receipt-bank">Banco</UiLabel><UiInput id="receipt-bank" v-model="form.bank" /></div>
        <UiAlert v-if="error" variant="destructive" class="sm:col-span-2"><UiAlertDescription>{{ error }}</UiAlertDescription></UiAlert>
        <UiDialogFooter class="sm:col-span-2">
          <UiButton type="button" variant="outline" :disabled="saving" @click="emit('update:open', false)">Cancelar</UiButton>
          <UiButton type="submit" class="gap-2" :disabled="saving"><LoaderCircle v-if="saving" class="size-4 animate-spin" /><Save v-else class="size-4" /><span>{{ saving ? 'Guardando…' : 'Generar recibo' }}</span></UiButton>
        </UiDialogFooter>
      </form>
      <UiAlert v-if="error && contract" variant="destructive"><UiAlertDescription>{{ error }}</UiAlertDescription></UiAlert>
    </UiDialogScrollContent>
  </UiDialog>
</template>
