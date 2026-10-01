<script setup lang="ts">
import { LoaderCircle, Search } from '@lucide/vue'

const props = withDefaults(defineProps<{
  modelValue: string
  required?: boolean
}>(), { required: false })

const emit = defineEmits<{
  'update:modelValue': [value: string]
  lookup: [data: { nombres: string; apellidoPaterno: string; apellidoMaterno: string; fechaNacimiento?: string }]
}>()

const loading = ref(false)
const error = ref('')

const lookup = async () => {
  const dni = props.modelValue.replace(/\D/g, '').slice(0, 8)
  emit('update:modelValue', dni)
  error.value = ''
  if (!/^\d{8}$/.test(dni)) {
    error.value = 'Ingresa un DNI válido de 8 dígitos.'
    return
  }

  loading.value = true
  try {
    const response = await $fetch<{ data: { nombres: string; apellidoPaterno: string; apellidoMaterno: string; fechaNacimiento?: string } }>(`/api/dni/${dni}`, { credentials: 'include' })
    emit('lookup', response.data)
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'No se encontraron datos para este DNI.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex gap-2">
      <UiInput :model-value="modelValue" :required="required" inputmode="numeric" maxlength="8" placeholder="DNI / CE" @update:model-value="emit('update:modelValue', String($event).replace(/\D/g, '').slice(0, 8))" />
      <UiButton type="button" variant="outline" size="icon" :disabled="loading" :class="loading ? 'border-primary text-primary ring-2 ring-primary/30 ring-offset-2' : ''" :title="loading ? 'Buscando datos del DNI…' : 'Buscar datos del DNI'" :aria-label="loading ? 'Buscando datos del DNI' : 'Buscar datos del DNI'" @click="lookup">
        <LoaderCircle v-if="loading" class="size-4 animate-spin" aria-hidden="true" />
        <Search v-else class="size-4" aria-hidden="true" />
      </UiButton>
    </div>
    <p v-if="error" class="mt-1 text-xs text-destructive">{{ error }}</p>
  </div>
</template>
