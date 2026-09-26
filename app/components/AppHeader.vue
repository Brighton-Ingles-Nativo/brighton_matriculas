<script setup lang="ts">
import { ArrowLeft, ChevronDown, LogOut, UserRound } from '@lucide/vue'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  backTo?: string
}>(), { subtitle: '' })

const { user, logout } = useAuth()
const router = useRouter()

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
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
    <div class="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <div class="flex min-w-0 items-center gap-3">
        <UiButton v-if="props.backTo" variant="ghost" size="icon" as-child aria-label="Volver">
          <NuxtLink :to="props.backTo"><ArrowLeft class="size-4" /></NuxtLink>
        </UiButton>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold tracking-tight">{{ props.title }}</p>
          <p v-if="props.subtitle" class="hidden truncate text-xs text-muted-foreground sm:block">{{ props.subtitle }}</p>
        </div>
      </div>
      <div v-if="user" class="flex shrink-0 items-center">
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
