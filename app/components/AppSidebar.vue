<script setup lang="ts">
import { ChevronDown, ClipboardList, FolderOpen, LayoutDashboard, LogOut, Menu, Moon, ReceiptText, Settings2, Sun, UserRound } from '@lucide/vue'

const { user, logout } = useAuth()
const { isDark, toggleTheme } = useTheme()
const router = useRouter()
const route = useRoute()
const isAdmin = computed(() => user.value?.role?.name === 'admin')
const canViewExpedients = computed(() => ['admin', 'asesor', 'supervisor', 'asistente_comercial', 'verificador'].includes(user.value?.role?.name || ''))
const isCollapsed = useState('sidebar-collapsed', () => false)
const isAdminSection = computed(() => route.path.startsWith('/admin') || ['/sites', '/users'].includes(route.path))
const isAdminHome = computed(() => route.path === '/admin')
const isAccessSection = computed(() => route.path.startsWith('/admin/accesos') || route.path === '/users')
const isOrganizationSection = computed(() => route.path.startsWith('/admin/organizacion') || route.path === '/sites')
const isConfigurationSection = computed(() => route.path.startsWith('/admin/configuracion'))
const adminMenuOpen = ref(isAdminSection.value)

watch(isAdminSection, (isInAdministration) => {
  if (isInAdministration) adminMenuOpen.value = true
})

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
  await logout(); 
  await router.push('/login') 
}
</script>

<template>
  <aside v-if="user" class="app-sidebar" :class="{ 'app-sidebar-collapsed': isCollapsed }">
    <div class="app-sidebar-header">
      <div class="app-sidebar-brand" :class="{ 'app-sidebar-brand-collapsed': isCollapsed }">
        <img v-if="!isCollapsed" src="/assets/images/logoBlanco.webp" alt="Brighton" class="max-h-full w-full px-4 object-contain" />
        <Menu v-else class="size-5" aria-hidden="true" />
      </div>
    </div>
    <nav class="sidebar-navigation space-y-1 p-3" aria-label="Navegación principal">
      <p v-if="!isCollapsed" class="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[.14em] text-sidebar-foreground/45">Principal
      </p>
      <NuxtLink to="/dashboard" class="sidebar-link" :class="{ 'sidebar-link-collapsed': isCollapsed }" active-class="sidebar-link-active" title="Dashboard">
        <LayoutDashboard class="size-4" /> <span v-if="!isCollapsed">Dashboard</span>
      </NuxtLink>
      <NuxtLink to="/matriculas" class="sidebar-link" :class="{ 'sidebar-link-collapsed': isCollapsed }" active-class="sidebar-link-active" title="Matrículas">
        <ClipboardList class="size-4" /> <span v-if="!isCollapsed">Matrículas</span>
      </NuxtLink>
      <NuxtLink v-if="canViewExpedients" to="/expedientes" class="sidebar-link" :class="{ 'sidebar-link-collapsed': isCollapsed }" active-class="sidebar-link-active" title="Expedientes">
        <FolderOpen class="size-4" /> <span v-if="!isCollapsed">Expedientes</span>
      </NuxtLink>
      <NuxtLink to="/recibos" class="sidebar-link" :class="{ 'sidebar-link-collapsed': isCollapsed }" active-class="sidebar-link-active" title="Recibos">
        <ReceiptText class="size-4" /> <span v-if="!isCollapsed">Recibos</span>
      </NuxtLink>
      <p v-if="!isCollapsed" class="px-3 pb-2 pt-7 text-[10px] font-bold uppercase tracking-[.14em] text-sidebar-foreground/45">Cuenta</p>
      <NuxtLink to="/profile" class="sidebar-link" :class="{ 'sidebar-link-collapsed': isCollapsed }" active-class="sidebar-link-active" title="Mi perfil">
        <UserRound class="size-4" /> <span v-if="!isCollapsed">Mi perfil</span>
      </NuxtLink>
      <div v-if="isAdmin" class="sidebar-admin">
        <p v-if="!isCollapsed" class="px-3 pb-2 pt-7 text-[10px] font-bold uppercase tracking-[.14em] text-sidebar-foreground/45">Administración</p>

        <NuxtLink
          v-if="isCollapsed"
          to="/admin"
          class="sidebar-link sidebar-link-collapsed"
          :class="{ 'sidebar-link-active': isAdminHome }"
          title="Administración"
        >
          <Settings2 class="size-4" />
          <span class="sr-only">Administración</span>
        </NuxtLink>

        <template v-else>
          <button
            type="button"
            class="sidebar-link sidebar-admin-trigger"
            :aria-expanded="adminMenuOpen"
            aria-controls="sidebar-administration-menu"
            :aria-label="adminMenuOpen ? 'Contraer secciones de Administración' : 'Expandir secciones de Administración'"
            @click="adminMenuOpen = !adminMenuOpen"
          >
            <span class="sidebar-admin-trigger-content">
              <Settings2 class="size-4" />
              <span>Administración</span>
            </span>
            <ChevronDown class="size-4 transition-transform duration-200" :class="{ 'rotate-180': adminMenuOpen }" aria-hidden="true" />
          </button>

          <Transition name="sidebar-submenu">
            <div v-if="adminMenuOpen" id="sidebar-administration-menu" class="sidebar-submenu" role="group" aria-label="Secciones de administración">
              <NuxtLink
                to="/admin"
                class="sidebar-sub-link"
                :class="{ 'sidebar-sub-link-active': isAdminHome }"
                :aria-current="isAdminHome ? 'page' : undefined"
              >
                <span>Panel de administración</span>
              </NuxtLink>
              <NuxtLink
                to="/admin/accesos/usuarios"
                class="sidebar-sub-link"
                :class="{ 'sidebar-sub-link-active': isAccessSection }"
                :aria-current="isAccessSection ? 'page' : undefined"
              >
                <span>Accesos</span>
              </NuxtLink>
              <NuxtLink
                to="/admin/organizacion/sedes"
                class="sidebar-sub-link"
                :class="{ 'sidebar-sub-link-active': isOrganizationSection }"
                :aria-current="isOrganizationSection ? 'page' : undefined"
              >
                <span>Organización</span>
              </NuxtLink>
              <NuxtLink
                to="/admin/configuracion"
                class="sidebar-sub-link"
                :class="{ 'sidebar-sub-link-active': isConfigurationSection }"
                :aria-current="isConfigurationSection ? 'page' : undefined"
              >
                <span>Configuración</span>
              </NuxtLink>
            </div>
          </Transition>
        </template>
      </div>
    </nav>
    <div class="sidebar-account-footer">
      <UiDropdownMenu>
        <UiDropdownMenuTrigger as-child>
          <button
            type="button"
            class="sidebar-account-trigger group"
            :class="{ 'sidebar-account-trigger-collapsed': isCollapsed }"
            aria-label="Abrir menú de usuario"
          >
            <span class="sidebar-account-avatar">{{ userInitials }}</span>
            <span v-if="!isCollapsed" class="sidebar-account-copy">
              <span class="truncate text-sm font-medium text-sidebar-foreground">{{ user.name }}</span>
              <span class="truncate text-xs text-sidebar-foreground/50">{{ user.role?.name || 'Cuenta' }}</span>
            </span>
            <ChevronDown v-if="!isCollapsed" class="ml-auto size-4 text-sidebar-foreground/60 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
          </button>
        </UiDropdownMenuTrigger>
        <UiDropdownMenuContent side="right" align="end" class="w-60">
          <UiDropdownMenuLabel class="px-2 py-2">
            <p class="truncate font-semibold text-foreground">{{ user.name }}</p>
            <p v-if="user.email" class="truncate text-[11px] font-normal">{{ user.email }}</p>
          </UiDropdownMenuLabel>
          <UiDropdownMenuSeparator />
          <UiDropdownMenuItem as-child class="px-2 py-2">
            <NuxtLink to="/profile" class="flex w-full items-center gap-2">
              <UserRound class="size-4" />
              <span>Mi perfil</span>
            </NuxtLink>
          </UiDropdownMenuItem>
          <UiDropdownMenuItem class="px-2 py-2" @select="toggleTheme">
            <Sun v-if="isDark" class="size-4" />
            <Moon v-else class="size-4" />
            <span>{{ isDark ? 'Modo claro' : 'Modo oscuro' }}</span>
          </UiDropdownMenuItem>
          <UiDropdownMenuSeparator />
          <UiDropdownMenuItem variant="destructive" class="px-2 py-2" @select="handleLogout">
            <LogOut class="size-4" />
            <span>Cerrar sesión</span>
          </UiDropdownMenuItem>
        </UiDropdownMenuContent>
      </UiDropdownMenu>
    </div>
  </aside>
</template>
