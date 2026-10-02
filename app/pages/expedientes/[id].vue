<script setup lang="ts">
import { ArrowLeft, LoaderCircle } from '@lucide/vue'

definePageMeta({ middleware: 'auth', ssr: false })

const route = useRoute()
const loading = ref(true)
const error = ref('')
const contractId = ref('')
const status = ref('')

onMounted(async () => {
  try {
    const response = await $fetch<{ data: { contractId: string; status: string } }>(`/api/expedients/${route.params.id}`, { credentials: 'include' })
    contractId.value = response.data.contractId
    status.value = response.data.status
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'No se pudo cargar el expediente.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader title="Gestionar expediente" subtitle="Documentación de la matrícula" back-to="/expedientes" />
    <main class="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <UiAlert v-if="error" variant="destructive"><UiAlertDescription>{{ error }}</UiAlertDescription></UiAlert>
      <div v-else-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle class="size-4 animate-spin" /> Cargando expediente…</div>
      <template v-else>
        <section>
          <p class="text-sm font-medium text-primary">Estado: {{ status }}</p>
          <h1 class="mt-1 text-3xl font-semibold tracking-tight">Documentos del expediente</h1>
        </section>
        <ExpedientDocumentsCard :contract-id="contractId" :contract-accepted="true" />
      </template>
      <UiButton variant="outline" as-child class="gap-2"><NuxtLink to="/expedientes"><ArrowLeft class="size-4" /> Volver a expedientes</NuxtLink></UiButton>
    </main>
  </div>
</template>
