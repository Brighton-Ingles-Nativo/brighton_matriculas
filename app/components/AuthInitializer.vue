<template>
  <div class="relative">
    <!-- Overlay de carga solo en el cliente -->
    <div v-if="isInitializing && $route.path !== '/login' && $route.path !== '/register'" 
         class="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
      <div class="text-center">
        <div class="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        <p class="mt-2 text-sm text-gray-600">Cargando...</p>
      </div>
    </div>
    
    <!-- Contenido -->
    <slot />
  </div>
</template>

<script setup lang="ts">
const { isInitializing } = useAuth()
</script>
