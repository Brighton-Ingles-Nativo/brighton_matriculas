<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { DateFormatter, getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { CalendarIcon } from '@lucide/vue'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const props = withDefaults(defineProps<{
  modelValue?: string
  id?: string
  name?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
}>(), {
  modelValue: '',
  placeholder: 'DD/MM/AAAA',
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const formatter = new DateFormatter('es-PE', { dateStyle: 'long' })
const defaultPlaceholder = today(getLocalTimeZone())
const inputValue = ref('')
const inputError = ref('')

const date = computed<DateValue | undefined>(() => {
  if (!props.modelValue) return undefined
  try {
    return parseDate(props.modelValue)
  } catch {
    return undefined
  }
})

const formatInputDate = (value: DateValue | undefined) => value
  ? `${String(value.day).padStart(2, '0')}/${String(value.month).padStart(2, '0')}/${value.year}`
  : ''

const label = computed(() => date.value
  ? formatter.format(date.value.toDate(getLocalTimeZone()))
  : props.placeholder)

watch(() => props.modelValue, (value) => {
  inputValue.value = formatInputDate(date.value)
  if (value) inputError.value = ''
}, { immediate: true })

function normalizeTypedDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function commitTypedDate() {
  const value = inputValue.value.trim()
  if (!value) {
    inputError.value = props.required ? 'Ingresa una fecha.' : ''
    emit('update:modelValue', '')
    return
  }

  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) {
    inputError.value = 'Usa el formato DD/MM/AAAA.'
    return
  }

  const [, day, month, year] = match
  try {
    const parsed = parseDate(`${year}-${month}-${day}`)
    inputError.value = ''
    inputValue.value = formatInputDate(parsed)
    emit('update:modelValue', parsed.toString())
  } catch {
    inputError.value = 'Ingresa una fecha válida.'
  }
}

function updateDate(value: DateValue | undefined, close: () => void) {
  inputError.value = ''
  inputValue.value = formatInputDate(value)
  emit('update:modelValue', value?.toString() ?? '')
  if (value) close()
}
</script>

<template>
  <div class="space-y-1">
    <Popover v-slot="{ close }">
      <div class="relative">
        <UiInput
          :id="id"
          v-model="inputValue"
          :name="name"
          :required="required"
          :disabled="disabled"
          :placeholder="placeholder"
          inputmode="numeric"
          autocomplete="off"
          maxlength="10"
          :aria-invalid="Boolean(inputError)"
          class="pr-10"
          @input="inputValue = normalizeTypedDate(inputValue)"
          @blur="commitTypedDate"
          @keydown.enter.prevent="commitTypedDate"
        />
        <PopoverTrigger as-child>
          <UiButton
            type="button"
            variant="ghost"
            size="icon"
            :disabled="disabled"
            class="absolute top-1/2 right-0 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Abrir calendario"
          >
            <CalendarIcon class="size-4" />
          </UiButton>
        </PopoverTrigger>
      </div>
      <PopoverContent class="w-auto p-0" align="start">
        <Calendar
          :model-value="date"
          :initial-focus="true"
          :default-placeholder="defaultPlaceholder"
          locale="es-PE"
          @update:model-value="(value) => updateDate(value, close)"
        />
      </PopoverContent>
    </Popover>
    <p v-if="inputError" class="text-xs text-destructive">{{ inputError }}</p>
  </div>
</template>
