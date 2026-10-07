<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'

withDefaults(defineProps<{ title: string; value: string | number; description: string; tone?: 'default' | 'success' | 'warning' | 'danger'; href?: string }>(), { tone: 'default' })
</script>

<template>
  <UiCard class="group transition-shadow hover:shadow-md">
    <UiCardContent class="space-y-3 p-5">
      <div class="flex items-start justify-between gap-3"><p class="text-sm font-medium text-muted-foreground">{{ title }}</p><NuxtLink v-if="href" :to="href" class="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" :aria-label="`Ver ${title}`"><ArrowUpRight class="size-4" /></NuxtLink></div>
      <p class="text-3xl font-semibold tracking-tight" :class="{ 'text-emerald-600': tone === 'success', 'text-amber-600': tone === 'warning', 'text-red-600': tone === 'danger' }">{{ value }}</p>
      <p class="text-xs text-muted-foreground">{{ description }}</p>
    </UiCardContent>
  </UiCard>
</template>
