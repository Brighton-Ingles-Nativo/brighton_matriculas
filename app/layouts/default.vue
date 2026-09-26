<script setup lang="ts">
const isCollapsed = useState('sidebar-collapsed', () => false)
</script>

<template>
  <div
    class="app-shell min-h-screen w-full bg-background text-foreground"
    :style="{ '--app-sidebar-width': isCollapsed ? '5rem' : '16rem' }"
  >
    <AppSidebar />
    <div class="app-shell-content">
      <slot />
    </div>
  </div>
</template>
