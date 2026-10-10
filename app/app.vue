<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner'

const { initTheme } = useTheme()
onMounted(initTheme)
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <AuthInitializer>
      <!-- El estado de autenticación se restaura en el navegador desde la cookie de sesión httpOnly.
           Renderizar el shell de la app primero en el servidor causa inconsistencias de hidratación
           cuando el cliente restaura el usuario autenticado. -->
      <ClientOnly fallback-tag="div">
        <NotificationRuntime />
        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>
        <Toaster position="top-right" rich-colors close-button />
        <template #fallback>
          <div class="grid min-h-[100dvh] place-items-center bg-background text-sm text-muted-foreground">
            Cargando sesión…
          </div>
        </template>
      </ClientOnly>
    </AuthInitializer>
  </div>
</template>
