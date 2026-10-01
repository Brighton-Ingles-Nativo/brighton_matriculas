<script setup lang="ts">
import { Building2, ClipboardList, FolderOpen, LayoutDashboard, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings2, Sun, UserRound } from '@lucide/vue'

const { user, logout } = useAuth()
const { isDark, toggleTheme } = useTheme()
const router = useRouter()
const isAdmin = computed(() => user.value?.role?.name === 'admin')
const canViewExpedients = computed(() => ['admin', 'asesor', 'supervisor', 'asistente_comercial', 'verificador'].includes(user.value?.role?.name || ''))
const isCollapsed = useState('sidebar-collapsed', () => false)
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
      <button
        type="button"
        class="sidebar-toggle cursor-pointer"
        :aria-label="isCollapsed ? 'Expandir menú' : 'Colapsar menú'"
        :title="isCollapsed ? 'Expandir menú' : 'Colapsar menú'"
        @click="isCollapsed = !isCollapsed"
      >
        <PanelLeftOpen v-if="isCollapsed" class="size-4" aria-hidden="true" />
        <PanelLeftClose v-else class="size-4" aria-hidden="true" />
      </button>
      <div>
        <!-- <p class="text-[11px] text-sidebar-foreground/55">Panel administrativo</p> --> <!-- Descomentar si se desea mostrar el título de sección -->
      </div>
    </div>
    <nav class="flex-1 space-y-1 p-3" aria-label="Navegación principal">
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
      <NuxtLink v-if="isAdmin" to="/users" class="sidebar-link" :class="{ 'sidebar-link-collapsed': isCollapsed }" active-class="sidebar-link-active" title="Administración">
        <Settings2 class="size-4" /> <span v-if="!isCollapsed">Administración</span>
      </NuxtLink>
      <NuxtLink v-if="isAdmin" to="/sites" class="sidebar-link" :class="{ 'sidebar-link-collapsed': isCollapsed }" active-class="sidebar-link-active" title="Sedes y equipos">
        <Building2 class="size-4" /> <span v-if="!isCollapsed">Sedes y equipos</span>
      </NuxtLink>
    </nav>
    <div class="border-t border-sidebar-border p-3">
      <div class="mb-2 flex items-center gap-3 rounded-xl px-3 py-2" :class="{ 'justify-center px-0': isCollapsed }"><span
          class="grid size-8 place-items-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">{{
            user.name?.slice(0, 1).toUpperCase() }}</span>
        <div v-if="!isCollapsed" class="min-w-0">
          <p class="truncate text-sm font-medium text-sidebar-foreground">{{ user.name }}</p>
          <p class="truncate text-xs text-sidebar-foreground/50">{{ user.role?.name }}</p>
        </div>
      </div>
      <button type="button" class="sidebar-link mb-1 w-full" :class="{ 'sidebar-link-collapsed': isCollapsed, 'justify-between': !isCollapsed }" :title="isDark ? 'Modo claro' : 'Modo oscuro'" @click="toggleTheme"><span
          class="flex items-center gap-3">
          <Sun v-if="isDark" class="size-4" />
          <Moon v-else class="size-4" /> <span v-if="!isCollapsed">{{ isDark ? 'Modo claro' : 'Modo oscuro' }}</span>
        </span><span v-if="!isCollapsed" class="text-[10px] text-sidebar-foreground/45">{{ isDark ? 'ON' : 'OFF' }}</span></button>
      <button type="button" class="sidebar-link w-full" :class="{ 'sidebar-link-collapsed': isCollapsed }" title="Cerrar sesión" @click="handleLogout">
        <LogOut class="size-4" /> <span v-if="!isCollapsed">Cerrar sesión</span>
      </button>
    </div>
  </aside>
</template>
