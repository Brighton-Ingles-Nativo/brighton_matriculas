<script setup lang="ts">
import { ArrowLeft, Save } from '@lucide/vue'

definePageMeta({ middleware: 'auth', ssr: false })
const route = useRoute(); const { csrfHeaders } = useAuth(); const loading = ref(true); const saving = ref(false); const error = ref(''); const contract = ref<any>(null); const form = reactive({ amount: '', concepts: '', otherConcept: '', paymentMethod: '', operationNumber: '', bank: '', transactionDate: new Date().toISOString().slice(0, 10) })
onMounted(async () => { try { const response = await $fetch<any>(`/api/contracts/${route.params.id}`, { credentials: 'include' }); contract.value = response.data; form.amount = contract.value.initialPayment || '' } catch (err: any) { error.value = err?.data?.statusMessage || 'No pudimos cargar la matrícula.' } finally { loading.value = false } })
const submit = async () => { saving.value = true; error.value = ''; try { const response = await $fetch<{ data: { id: string } }>('/api/receipts', { method: 'POST', headers: await csrfHeaders(), credentials: 'include', body: { ...form, contractId: route.params.id } }); await navigateTo(`/recibo/${response.data.id}`) } catch (err: any) { error.value = err?.data?.statusMessage || 'No pudimos registrar el recibo.' } finally { saving.value = false } }
</script>

<template>
    <div class="min-h-[100dvh] bg-muted/20">
        <AppHeader title="Generar recibo" subtitle="Registrar un pago de matrícula" />
        <main class="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
            <UiButton variant="outline" as-child>
                <NuxtLink to="/matriculas">
                    <ArrowLeft class="mr-2 size-4" /> Volver
                </NuxtLink>
            </UiButton>
            <UiSkeleton v-if="loading" class="h-96 w-full" />
            <UiAlert v-else-if="error && !contract" variant="destructive">
                <UiAlertDescription>{{ error }}</UiAlertDescription>
            </UiAlert>
            <UiCard v-else>
                <UiCardHeader>
                    <UiCardTitle>Recibo de pago</UiCardTitle>
                    <UiCardDescription>Contrato {{ contract.contractNumber }}</UiCardDescription>
                </UiCardHeader>
                <form class="grid gap-5 p-6 sm:grid-cols-2" @submit.prevent="submit">
                    <div>
                        <UiLabel>Nombre del titular</UiLabel>
                        <UiInput :model-value="contract.holderName" readonly />
                    </div>
                    <div>
                        <UiLabel>DNI</UiLabel>
                        <UiInput :model-value="contract.holderDni" readonly />
                    </div>
                    <div class="sm:col-span-2">
                        <UiLabel>Dirección</UiLabel>
                        <UiInput :model-value="contract.holderAddress" readonly />
                    </div>
                    <div>
                        <UiLabel>Celular</UiLabel>
                        <UiInput :model-value="contract.holderPhone" readonly />
                    </div>
                    <div>
                        <UiLabel>Fecha de emisión</UiLabel>
                        <UiInput :model-value="new Date().toLocaleDateString('es-PE')" readonly />
                    </div>
                    <div>
                        <UiLabel>Importe recibido (S/) *</UiLabel>
                        <UiInput v-model="form.amount" type="number" min="0.01" step="0.01" readonly required />
                    </div>
                    <div>
                        <UiLabel for="transactionDate">Fecha de transacción *</UiLabel>
                        <UiDatePicker id="transactionDate" v-model="form.transactionDate" required />
                    </div>
                    <div class="sm:col-span-2">
                        <UiLabel>Concepto *</UiLabel>
                        <div class="mt-2 flex flex-wrap gap-4 text-sm"><label
                                v-for="item in ['Valor Total', 'Cuota Inicial', 'Cuota Mensual', 'Otros']" :key="item"
                                class="flex items-center gap-2"><input v-model="form.concepts" type="radio"
                                    :value="item" required />{{ item }}</label></div>
                    </div>
                    <div v-if="form.concepts === 'Otros'" class="sm:col-span-2">
                        <UiLabel>Especifique el concepto *</UiLabel>
                        <UiInput v-model="form.otherConcept" required />
                    </div>
                    <div class="sm:col-span-2">
                        <UiLabel>Forma de pago *</UiLabel>
                        <div class="mt-2 flex flex-wrap gap-4 text-sm"><label
                                v-for="item in ['Efectivo', 'Cheque', 'Depósito', 'Transferencia', 'POS', 'Otros']"
                                :key="item" class="flex items-center gap-2"><input v-model="form.paymentMethod"
                                    type="radio" :value="item" required />{{ item }}</label></div>
                    </div>
                    <div>
                        <UiLabel>Número de operación</UiLabel>
                        <UiInput v-model="form.operationNumber" />
                    </div>
                    <div>
                        <UiLabel>Banco</UiLabel>
                        <UiInput v-model="form.bank" />
                    </div>
                    <UiAlert v-if="error" variant="destructive" class="sm:col-span-2">
                        <UiAlertDescription>{{ error }}</UiAlertDescription>
                    </UiAlert>
                    <div class="flex justify-end gap-3 sm:col-span-2">
                        <UiButton variant="outline" as-child>
                            <NuxtLink to="/matriculas">Cancelar</NuxtLink>
                        </UiButton>
                        <UiButton type="submit" :disabled="saving" class="gap-2">
                            <Save class="size-4" />{{ saving ? 'Guardando…' : 'Generar recibo' }}
                        </UiButton>
                    </div>
                </form>
            </UiCard>
        </main>
    </div>
</template>
