<script setup lang="ts">
import { Bell, Check, ExternalLink } from '@lucide/vue'

const { items: notifications, unreadCount, loading, load, markRead, enablePush, disablePush, pushEnabled } = useNotifications()
const pushBusy = ref(false)

const togglePush = async () => {
  pushBusy.value = true
  try {
    if (pushEnabled.value) await disablePush()
    else await enablePush()
  } finally {
    pushBusy.value = false
  }
}

const openNotification = async (notification: typeof notifications.value[number]) => {
  await markRead(notification)
  if (notification.actionUrl) await navigateTo(notification.actionUrl)
}

await load()
</script>

<template>
  <div class="min-h-screen bg-muted/20">
    <AppHeader title="Notificaciones" subtitle="Avisos y pendientes de la plataforma" />
    <main class="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section class="flex flex-col justify-between gap-4 rounded-3xl border bg-background p-6 shadow-sm sm:flex-row sm:items-center">
        <div class="flex items-start gap-3">
          <span class="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Bell class="size-5" /></span>
          <div>
            <h1 class="text-lg font-semibold">Centro de notificaciones</h1>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ unreadCount ? `${unreadCount} sin leer` : 'Todo está al día' }}
            </p>
          </div>
        </div>
        <UiButton variant="outline" :disabled="pushBusy" @click="togglePush">
          {{ pushBusy ? 'Guardando…' : pushEnabled ? 'Desactivar navegador' : 'Activar navegador' }}
        </UiButton>
      </section>

      <section class="overflow-hidden rounded-3xl border bg-background shadow-sm">
        <div v-if="loading" class="p-10 text-center text-sm text-muted-foreground">Cargando notificaciones…</div>
        <div v-else-if="!notifications.length" class="grid place-items-center gap-3 p-16 text-center">
          <span class="grid size-12 place-items-center rounded-full bg-muted"><Bell class="size-5 text-muted-foreground" /></span>
          <p class="font-medium">No tienes notificaciones</p>
          <p class="text-sm text-muted-foreground">Aquí aparecerán los avisos relacionados con tus matrículas y expedientes.</p>
        </div>
        <div v-else class="divide-y">
          <button
            v-for="notification in notifications"
            :key="notification.id"
            type="button"
            class="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-muted/50"
            :class="notification.readAt ? '' : 'bg-primary/[0.035]'"
            @click="openNotification(notification)"
          >
            <span class="mt-1 grid size-8 shrink-0 place-items-center rounded-xl" :class="notification.readAt ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'">
              <Check v-if="notification.readAt" class="size-4" />
              <Bell v-else class="size-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ notification.title }}</span>
                <span v-if="!notification.readAt" class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">NUEVA</span>
              </span>
              <span class="mt-1 block text-sm leading-6 text-muted-foreground">{{ notification.message }}</span>
              <span class="mt-2 block text-xs text-muted-foreground">{{ new Date(notification.createdAt).toLocaleString() }}</span>
            </span>
            <ExternalLink v-if="notification.actionUrl" class="mt-1 size-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </section>
    </main>
  </div>
</template>
