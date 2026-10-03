<script setup lang="ts">
import { ArrowLeft, Bell, ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, UserRound } from '@lucide/vue'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  backTo?: string
}>(), { subtitle: '' })

const { user, logout } = useAuth()
const { items: notifications, unreadCount, connected, markRead, enablePush, pushEnabled } = useNotifications()
const router = useRouter()
const isCollapsed = useState('sidebar-collapsed', () => false)

const userInitials = computed(() => {
  const name = user.value?.name?.trim() || 'Usuario'
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  return initials || 'U'
})

const handleLogout = async () => {
  await logout()
  await router.push('/login')
}

const openNotification = async (notification: typeof notifications.value[number]) => {
  await markRead(notification)
  if (notification.actionUrl) await router.push(notification.actionUrl)
}

const enableBrowserNotifications = async () => {
  await enablePush()
}
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
    <div class="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <div class="flex min-w-0 items-center gap-3">
        <UiButton
          v-if="user"
          variant="ghost"
          size="icon"
          class="hidden lg:inline-flex"
          :aria-label="isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'"
          :title="isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'"
          @click="isCollapsed = !isCollapsed"
        >
          <PanelLeftOpen v-if="isCollapsed" class="size-4" aria-hidden="true" />
          <PanelLeftClose v-else class="size-4" aria-hidden="true" />
        </UiButton>
        <UiButton v-if="props.backTo" variant="ghost" size="icon" as-child aria-label="Volver">
          <NuxtLink :to="props.backTo"><ArrowLeft class="size-4" /></NuxtLink>
        </UiButton>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold tracking-tight">{{ props.title }}</p>
          <p v-if="props.subtitle" class="hidden truncate text-xs text-muted-foreground sm:block">{{ props.subtitle }}</p>
        </div>
      </div>
      <div v-if="user" class="flex shrink-0 items-center gap-2">
        <UiDropdownMenu>
          <UiDropdownMenuTrigger as-child>
            <UiButton variant="ghost" size="icon" class="relative rounded-full" aria-label="Notificaciones">
              <Bell class="size-4" />
              <span v-if="unreadCount" class="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground">
                {{ unreadCount > 99 ? '99+' : unreadCount }}
              </span>
            </UiButton>
          </UiDropdownMenuTrigger>
          <UiDropdownMenuContent align="end" class="w-96 max-w-[calc(100vw-2rem)] p-0">
            <div class="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p class="text-sm font-semibold">Notificaciones</p>
                <p class="text-xs text-muted-foreground">{{ connected ? 'Conectado' : 'Conexión pendiente' }}</p>
              </div>
              <UiButton v-if="!pushEnabled" variant="outline" size="sm" class="h-8 text-xs" @click="enableBrowserNotifications">
                Activar navegador
              </UiButton>
              <span v-else class="text-xs text-emerald-600">Navegador activo</span>
            </div>
            <div v-if="!notifications.length" class="px-4 py-10 text-center text-sm text-muted-foreground">No tienes notificaciones.</div>
            <div v-else class="max-h-96 overflow-y-auto p-2">
              <button
                v-for="notification in notifications.slice(0, 12)"
                :key="notification.id"
                type="button"
                class="flex w-full gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted"
                :class="notification.readAt ? 'opacity-70' : 'bg-primary/5'"
                @click="openNotification(notification)"
              >
                <span class="mt-1 size-2 shrink-0 rounded-full" :class="notification.readAt ? 'bg-muted-foreground/30' : 'bg-primary'" />
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium">{{ notification.title }}</span>
                  <span class="mt-1 block text-xs leading-5 text-muted-foreground">{{ notification.message }}</span>
                  <span class="mt-1 block text-[10px] text-muted-foreground">{{ new Date(notification.createdAt).toLocaleString() }}</span>
                </span>
              </button>
            </div>
            <div v-if="notifications.length" class="border-t px-4 py-2 text-right">
              <NuxtLink to="/notificaciones" class="text-xs font-medium text-primary">Ver todas</NuxtLink>
            </div>
          </UiDropdownMenuContent>
        </UiDropdownMenu>
        <UiDropdownMenu>
          <UiDropdownMenuTrigger as-child>
            <UiButton
              variant="ghost"
              class="group h-auto gap-2 rounded-full px-1.5 py-1.5 pr-2 hover:bg-muted"
              aria-label="Abrir menú de usuario"
            >
              <span class="grid size-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm ring-2 ring-primary/15">
                {{ userInitials }}
              </span>
              <span class="hidden max-w-36 text-left sm:block">
                <span class="block truncate text-sm font-semibold leading-5 text-foreground">{{ user.name }}</span>
                <span class="block text-[11px] leading-4 text-muted-foreground">Mi cuenta</span>
              </span>
              <ChevronDown class="hidden size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 sm:block" />
            </UiButton>
          </UiDropdownMenuTrigger>
          <UiDropdownMenuContent align="end" class="w-60">
            <UiDropdownMenuLabel class="px-2 py-2">
              <p class="truncate font-semibold text-foreground">{{ user.name }}</p>
              <p class="truncate text-[11px] font-normal">{{ user.email }}</p>
            </UiDropdownMenuLabel>
            <UiDropdownMenuSeparator />
            <UiDropdownMenuItem as-child class="px-2 py-2">
              <NuxtLink to="/profile" class="flex w-full items-center gap-2">
                <UserRound class="size-4" />
                <span>Mi perfil</span>
              </NuxtLink>
            </UiDropdownMenuItem>
            <UiDropdownMenuItem variant="destructive" class="px-2 py-2" @select="handleLogout">
              <LogOut class="size-4" />
              <span>Cerrar sesión</span>
            </UiDropdownMenuItem>
          </UiDropdownMenuContent>
        </UiDropdownMenu>
      </div>
    </div>
  </header>
</template>
