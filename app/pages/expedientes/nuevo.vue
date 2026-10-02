<script setup lang="ts">
import { ArrowLeft, FolderOpen, LoaderCircle } from '@lucide/vue'

definePageMeta({ middleware: 'auth', ssr: false })

interface AvailableContract {
  id: string
  contractNumber: string
  holderName: string
  holderDni: string
  advisorName: string
  status: string | null
}

const contracts = ref<AvailableContract[]>([])
const selectedContract = ref<AvailableContract | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const response = await $fetch<{ data: AvailableContract[] }>('/api/expedients/available-contracts', { credentials: 'include' })
    contracts.value = response.data
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'No se pudieron cargar las matrículas disponibles.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader title="Nuevo expediente" subtitle="Carga la documentación de una matrícula firmada" back-to="/expedientes" />
    <main class="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section>
        <p class="text-sm font-medium text-primary">Gestión documental</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-tight">Selecciona una matrícula</h1>
        <p class="mt-2 text-muted-foreground">Solo aparecen matrículas firmadas que todavía no tienen expediente.</p>
      </section>

      <UiAlert v-if="error" variant="destructive"><UiAlertDescription>{{ error }}</UiAlertDescription></UiAlert>
      <section v-if="selectedContract" class="space-y-4">
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 class="text-xl font-semibold">{{ selectedContract.contractNumber }} · {{ selectedContract.holderName }}</h2>
            <p class="mt-1 text-sm text-muted-foreground">DNI {{ selectedContract.holderDni }}</p>
          </div>
          <UiButton variant="outline" size="sm" @click="selectedContract = null">Cambiar matrícula</UiButton>
        </div>
        <ExpedientDocumentsCard :contract-id="selectedContract.id" :contract-accepted="true" />
      </section>

      <UiCard v-else>
        <UiCardContent class="p-0">
          <div v-if="loading" class="flex items-center gap-2 p-6 text-sm text-muted-foreground"><LoaderCircle class="size-4 animate-spin" /> Cargando matrículas…</div>
          <div v-else-if="!contracts.length" class="flex min-h-56 flex-col items-center justify-center px-6 text-center">
            <FolderOpen class="mb-3 size-8 text-muted-foreground" />
            <p class="font-medium">No hay matrículas disponibles</p>
            <p class="mt-1 text-sm text-muted-foreground">Todas las matrículas firmadas ya tienen expediente o aún no hay contratos firmados.</p>
          </div>
          <div v-else class="divide-y">
            <div v-for="contract in contracts" :key="contract.id" class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="font-semibold text-primary">{{ contract.contractNumber }}</p>
                <p class="font-medium uppercase">{{ contract.holderName }}</p>
                <p class="text-sm text-muted-foreground">DNI {{ contract.holderDni }} · Asesor: {{ contract.advisorName }}</p>
              </div>
              <UiButton @click="selectedContract = contract">Gestionar documentos</UiButton>
            </div>
          </div>
        </UiCardContent>
      </UiCard>

      <div v-if="!selectedContract" class="flex justify-start">
        <UiButton variant="outline" as-child class="gap-2"><NuxtLink to="/expedientes"><ArrowLeft class="size-4" /> Volver a expedientes</NuxtLink></UiButton>
      </div>
    </main>
  </div>
</template>
