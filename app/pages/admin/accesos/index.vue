<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader title="Accesos" subtitle="Usuarios, roles, permisos y sesiones" back-to="/admin" />
    <main class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div class="flex flex-wrap gap-2 border-b">
        <UiButton v-for="tab in tabs" :key="tab" variant="ghost"
          :class="activeTab === tab ? 'border-b-2 border-primary text-primary' : ''" @click="activeTab = tab">{{ tab }}
        </UiButton>
      </div>
      <UiAlert v-if="error" variant="destructive">
        <UiAlertDescription>{{ error }}</UiAlertDescription>
      </UiAlert>
      <UiAlert v-if="success">
        <UiAlertDescription>{{ success }}</UiAlertDescription>
      </UiAlert>
      <template v-if="activeTab === 'Usuarios'">
        <section class="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 class="text-xl font-semibold">Usuarios</h2>
            <p class="text-sm text-muted-foreground">{{ users.length }} usuarios encontrados.</p>
          </div>
          <div class="flex gap-2">
            <UiInput v-model="search" placeholder="Buscar usuario…" @keyup.enter="loadUsers" />
            <UiButton variant="outline" @click="loadUsers">
              <RefreshCw class="size-4" />
            </UiButton>
            <UiButton class="gap-2" @click="openCreate">
              <Plus class="size-4" /> Nuevo usuario
            </UiButton>
          </div>
        </section>
        <UiDialog :open="userFormOpen" @update:open="userFormOpen = $event">
          <UiDialogScrollContent class="max-h-[calc(100vh-3rem)] overflow-y-auto sm:max-w-2xl">
            <UiDialogHeader>
              <UiDialogTitle>{{ editing ? 'Editar usuario' : 'Nuevo usuario' }}</UiDialogTitle>
              <UiDialogDescription>
                {{ editing ? 'Actualiza los datos, permisos de acceso y estado de este usuario.' : 'Registra un nuevo usuario para el sistema.' }}
              </UiDialogDescription>
            </UiDialogHeader>
            <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveUser">
              <div>
                <UiLabel for="userName">Nombre completo</UiLabel>
                <UiInput id="userName" v-model="form.name" required />
              </div>
              <div>
                <UiLabel for="userUsername">Usuario</UiLabel>
                <UiInput id="userUsername" v-model="form.username" required />
              </div>
              <div>
                <UiLabel for="userEmail">Correo</UiLabel>
                <UiInput id="userEmail" v-model="form.email" type="email" required />
              </div>
              <div>
                <UiLabel for="userRole">Rol</UiLabel>
                <UiSelect v-model="form.role">
                  <UiSelectTrigger id="userRole" class="w-full"><UiSelectValue placeholder="Seleccionar rol" /></UiSelectTrigger>
                  <UiSelectContent><UiSelectItem v-for="role in roles" :key="role.id" :value="role.name">{{ roleLabel(role.name) }}</UiSelectItem></UiSelectContent>
                </UiSelect>
              </div>
              <div v-if="form.role !== 'supervisor'" class="sm:col-span-2">
                <UiLabel for="userSupervisor">Supervisor directo</UiLabel>
                <UiSelect v-model="form.supervisorId">
                  <UiSelectTrigger id="userSupervisor" class="w-full"><UiSelectValue placeholder="Sin supervisor asignado" /></UiSelectTrigger>
                  <UiSelectContent>
                    <UiSelectItem value="__none__">Sin supervisor asignado</UiSelectItem>
                    <UiSelectItem v-for="supervisor in availableSupervisors" :key="supervisor.id" :value="supervisor.id">{{ supervisor.name }} (@{{ supervisor.username }})</UiSelectItem>
                  </UiSelectContent>
                </UiSelect>
                <p class="mt-1 text-xs text-muted-foreground">Permite registrar los subordinados directos de cada supervisor.</p>
              </div>
              <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <UiLabel for="userPassword">{{ editing ? 'Nueva contraseña (opcional)' : 'Contraseña' }}</UiLabel>
                  <UiButton type="button" variant="ghost" size="sm" class="h-7 gap-1 px-2 text-xs" @click="generatePassword">
                    <RefreshCw class="size-3.5" /> Generar
                  </UiButton>
                </div>
                <div class="flex gap-2">
                  <UiInput id="userPassword" v-model="form.password" :type="showPassword ? 'text' : 'password'" :required="!editing" minlength="6" />
                  <UiButton type="button" variant="outline" size="icon" :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="showPassword = !showPassword">
                    <EyeOff v-if="showPassword" class="size-4" />
                    <Eye v-else class="size-4" />
                  </UiButton>
                </div>
                <p class="text-xs text-muted-foreground">Genera una contraseña segura de 14 caracteres.</p>
              </div>
              <label class="flex items-center gap-2 pt-6 text-sm"><input v-model="form.active" type="checkbox" /> Usuario activo</label>
              <UiDialogFooter class="sm:col-span-2">
                <UiButton type="button" variant="outline" @click="userFormOpen = false">Cancelar</UiButton>
                <UiButton type="submit" class="gap-2" :disabled="loading"><Save class="size-4" /> Guardar usuario</UiButton>
              </UiDialogFooter>
            </form>
          </UiDialogScrollContent>
        </UiDialog>
        <UiCard>
          <UiCardContent class="p-0">
            <div v-if="loading" class="p-6 text-sm text-muted-foreground">Cargando usuarios…</div>
            <div v-else class="overflow-x-auto">
              <table class="w-full min-w-[850px] text-left text-sm">
                <thead>
                  <tr class="border-b text-xs uppercase text-muted-foreground">
                    <th class="p-4">Usuario</th>
                    <th class="p-4">Correo</th>
                    <th class="p-4">Rol</th>
                    <th class="p-4">Contratos</th>
                    <th class="p-4">Sesiones</th>
                    <th class="p-4">Estado</th>
                    <th class="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="managedUser in users" :key="managedUser.id" class="border-b last:border-0">
                    <td class="p-4">
                      <p class="font-medium">{{ managedUser.name }}</p>
                      <p class="text-xs text-muted-foreground">@{{ managedUser.username }}</p>
                    </td>
                    <td class="p-4">{{ managedUser.email }}</td>
                    <td class="p-4">
                      <UiBadge variant="outline">{{ roleLabel(managedUser.role.name) }}</UiBadge>
                    </td>
                    <td class="p-4">{{ managedUser.contractCount }}</td>
                    <td class="p-4">{{ managedUser.sessionCount }}</td>
                    <td class="p-4">
                      <UiBadge :variant="managedUser.active ? 'default' : 'secondary'">{{ managedUser.active ? 'Activo'
                        : 'Inactivo' }}</UiBadge>
                    </td>
                    <td class="p-4">
                      <div class="flex justify-end gap-2">
                        <UiButton variant="outline" size="sm" class="gap-1" @click="openEdit(managedUser)">
                          <Pencil class="size-3" /> Editar
                        </UiButton>
                        <UiButton variant="outline" size="sm" @click="toggleUser(managedUser)">{{ managedUser.active ?
                          'Desactivar' : 'Activar' }}</UiButton>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!users.length">
                    <td colspan="7" class="p-8 text-center text-muted-foreground">No hay usuarios.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UiCardContent>
        </UiCard>
      </template>
      <template v-else-if="activeTab === 'Roles y permisos'">
        <section>
          <h2 class="text-xl font-semibold">Roles y permisos</h2>
          <p class="text-sm text-muted-foreground">Define qué puede hacer cada rol.</p>
        </section>
        <div class="grid gap-5 lg:grid-cols-2">
          <UiCard v-for="role in roles" :key="role.id">
            <UiCardHeader>
              <div class="flex items-center justify-between">
                <UiCardTitle>{{ roleLabel(role.name) }}</UiCardTitle>
                <UiBadge variant="secondary">{{ role.userCount }} usuarios</UiBadge>
              </div>
            </UiCardHeader>
            <UiCardContent class="space-y-3"><label v-for="permission in permissionKeys" :key="permission"
                class="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>{{ permission
                  }}</span><input v-model="role.permissions[permission]" type="checkbox"
                  :disabled="role.name === 'admin' && permission === 'admin'" /></label>
              <UiButton class="mt-2 gap-2" @click="updateRole(role)">
                <Save class="size-4" /> Guardar permisos
              </UiButton>
            </UiCardContent>
          </UiCard>
        </div>
      </template>
      <template v-else>
        <section class="flex items-end justify-between">
          <div>
            <h2 class="text-xl font-semibold">Sesiones activas</h2>
            <p class="text-sm text-muted-foreground">Revoca accesos abiertos de cualquier usuario.</p>
          </div>
          <UiButton variant="outline" class="gap-2" @click="loadSessions">
            <RefreshCw class="size-4" /> Actualizar
          </UiButton>
        </section>
        <UiCard>
          <UiCardContent class="p-0">
            <div class="overflow-x-auto">
              <table class="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr class="border-b text-xs uppercase text-muted-foreground">
                    <th class="p-4">Usuario</th>
                    <th class="p-4">IP</th>
                    <th class="p-4">Última actividad</th>
                    <th class="p-4">Expira</th>
                    <th class="p-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="session in sessions" :key="session.id" class="border-b last:border-0">
                    <td class="p-4">
                      <p class="font-medium">{{ session.user.name }}</p>
                      <p class="text-xs text-muted-foreground">{{ session.user.username }}</p>
                    </td>
                    <td class="p-4">{{ session.ipAddress || '—' }}</td>
                    <td class="p-4">{{ date(session.lastSeenAt) }}</td>
                    <td class="p-4">{{ date(session.expiresAt) }}</td>
                    <td class="p-4 text-right">
                      <UiButton variant="outline" size="sm" class="gap-1" @click="revokeSession(session)">
                        <Trash2 class="size-3" /> Revocar
                      </UiButton>
                    </td>
                  </tr>
                  <tr v-if="!sessions.length">
                    <td colspan="5" class="p-8 text-center text-muted-foreground">No hay sesiones activas.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UiCardContent>
        </UiCard>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { Eye, EyeOff, Pencil, Plus, RefreshCw, Save, Trash2 } from '@lucide/vue'

definePageMeta({
  middleware: ['auth', 'admin'],
  alias: ['/users', '/admin/accesos/usuarios', '/admin/accesos/roles', '/admin/accesos/sesiones']
})
const { user, csrfHeaders } = useAuth()
const route = useRoute()
type Role = { 
  id: string; 
  name: string; 
  permissions: Record<string, boolean>;
  userCount?: number 
}
type ManagedUser = { 
  id: string; 
  name: string; 
  username: string; 
  email: string; 
  active: boolean; 
  emailVerified: boolean; 
  createdAt: string; 
  role: Role; 
  supervisorId: string | null;
  supervisor?: { id: string; name: string; username: string } | null;
  subordinateCount: number;
  sessionCount: number; 
  contractCount: number 
}

type Session = { 
  id: string; 
  user: { 
    name: string; 
    username: string; 
    email: string 
  }; 
  ipAddress: string | null; 
  lastSeenAt: string; 
  expiresAt: string 
}

const tabs = ['Usuarios', 'Roles y permisos', 'Sesiones activas'] as const
const tabByQuery: Record<string, (typeof tabs)[number]> = {
  usuarios: 'Usuarios',
  roles: 'Roles y permisos',
  sesiones: 'Sesiones activas'
}
const tabFromQuery = (value: unknown) => typeof value === 'string' ? tabByQuery[value] : undefined
const tabFromRoute = () => {
  if (route.path.endsWith('/roles')) return 'Roles y permisos'
  if (route.path.endsWith('/sesiones')) return 'Sesiones activas'
  return tabFromQuery(route.query.tab) ?? 'Usuarios'
}

const activeTab = ref<(typeof tabs)[number]>(tabFromRoute())
const users = ref<ManagedUser[]>([]); 
const roles = ref<Role[]>([]); 
const sessions = ref<Session[]>([])
const search = ref(''); 
const loading = ref(false); 
const error = ref(''); 
const success = ref(''); 
const editing = ref<ManagedUser | null>(null); 
const userFormOpen = ref(false)

const form = reactive({ 
  name: '', 
  username: '', 
  email: '', 
  password: '', 
  role: 'user', 
  supervisorId: '__none__', 
  active: true 
})
const showPassword = ref(false)

const availableSupervisors = computed(() => users.value.filter((managedUser) => managedUser.role.name === 'supervisor' && managedUser.id !== editing.value?.id && managedUser.active))

const permissionKeys = ['admin', 'manageUsers', 'manageContracts', 'verifyContracts', 'viewContracts', 'exportContracts']

const resetMessages = () => { 
  error.value = ''; 
  success.value = '' 
}

const loadUsers = async () => { loading.value = true; resetMessages(); 
  try { 
    const response = await $fetch<{ data: ManagedUser[] }>('/api/admin/users', { 
      query: { 
        search: search.value || undefined }, 
      credentials: 'include' }); 
      
      users.value = response.data 
  } catch (err: any) { 
    error.value = err?.data?.statusMessage || 'No se pudieron cargar los usuarios.' 
  } finally { 
    loading.value = false 
  } 
}

const debouncedLoadUsers = useDebounceFn(() => loadUsers(), 350)

const loadRoles = async () => { 
  try { const response = await $fetch<{ data: Role[] }>('/api/admin/roles', { 
      credentials: 'include' 
    }); 
    roles.value = response.data 
  } catch (err: any) { 
    error.value = err?.data?.statusMessage || 'No se pudieron cargar los roles.' 
  } 
}

const loadSessions = async () => { 
  try { const response = await $fetch<{ data: Session[] }>('/api/admin/sessions', { 
      credentials: 'include' 
    }); 
    sessions.value = response.data 
  } catch (err: any) { 
    error.value = err?.data?.statusMessage || 'No se pudieron cargar las sesiones.' 
  } 
}

const loadTab = async () => { resetMessages(); 
  if (activeTab.value === 'Usuarios') 
  await loadUsers(); 
  if (activeTab.value === 'Roles y permisos') 
  await loadRoles(); 
  if (activeTab.value === 'Sesiones activas') 
  await loadSessions() 
}

const openCreate = () => { 
  editing.value = null; 
  Object.assign(form, { 
    name: '', 
    username: '', 
    email: '', 
    password: '', 
    role: roles.value[0]?.name || 'user', 
    supervisorId: '__none__',
    active: true 
  });
  showPassword.value = false
  userFormOpen.value = true 
}

const openEdit = (managedUser: ManagedUser) => { 
  editing.value = managedUser; 
  Object.assign(form, { 
    name: managedUser.name, 
    username: managedUser.username,
    email: managedUser.email, 
    password: '', 
    role: managedUser.role.name, 
    supervisorId: managedUser.supervisorId || '__none__',
    active: managedUser.active 
  }); 
  showPassword.value = false
  userFormOpen.value = true 
}

const generatePassword = () => {
  const required = ['A', 'a', '7', '!']
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*_-'
  const values = new Uint32Array(10)
  crypto.getRandomValues(values)
  const password = [...required, ...Array.from(values, (value) => alphabet[value % alphabet.length])]
  const shuffleValues = new Uint32Array(password.length)
  crypto.getRandomValues(shuffleValues)
  for (let index = password.length - 1; index > 0; index -= 1) {
    const target = shuffleValues[index] % (index + 1)
    const current = password[index]
    password[index] = password[target]
    password[target] = current
  }
  form.password = password.join('')
  showPassword.value = true
}

const saveUser = async () => { 
  loading.value = true; 
  resetMessages(); 
  try { 
    const url = editing.value ? `/api/admin/users/${editing.value.id}` : '/api/admin/users'; 
    await $fetch(url, { 
      method: editing.value ? 'PUT' : 'POST', 
      headers: await csrfHeaders(), 
      credentials: 'include', 
      body: { 
        ...form, 
        supervisorId: form.role === 'supervisor' || form.supervisorId === '__none__' ? null : form.supervisorId,
        ...(editing.value && !form.password ? { 
          password: undefined 
        } : {}) 
      } 
    }); 
    
    userFormOpen.value = false; 
    success.value = editing.value ? 'Usuario actualizado.' : 'Usuario creado.'; 
    await loadUsers() 
  } catch (err: any) { 
    error.value = err?.data?.statusMessage || 'No se pudo guardar el usuario.' 
  } finally { 
    loading.value = false 
  } 
}

const toggleUser = async (managedUser: ManagedUser) => { 
  resetMessages(); 
  try { 
    await $fetch(`/api/admin/users/${managedUser.id}`, { 
      method: 'PUT', 
      headers: await csrfHeaders(), 
      credentials: 'include', 
      body: { 
        active: !managedUser.active 
      } 
    }); 
    
    success.value = managedUser.active ? 'Usuario desactivado y sesiones revocadas.' : 'Usuario activado.'; 
    await loadUsers() 
  } catch (err: any) { 
    error.value = err?.data?.statusMessage || 'No se pudo cambiar el estado.' 
  } 
}

const updateRole = async (role: Role) => { 
  try { 
    await $fetch(`/api/admin/roles/${role.id}`, { 
      method: 'PUT', 
      headers: await csrfHeaders(), 
      credentials: 'include', 
      body: { 
        permissions: role.permissions 
      } 
    }); 
    success.value = `Permisos de ${role.name} actualizados.` 
  } catch (err: any) { 
    error.value = err?.data?.statusMessage || 'No se pudieron guardar los permisos.' 
  } 
}

const revokeSession = async (session: Session) => { 
  try { 
    await $fetch(`/api/admin/sessions/${session.id}`, { 
      method: 'DELETE', 
      headers: await csrfHeaders(), 
      credentials: 'include' 
    }); 
    
    sessions.value = sessions.value.filter((item) => item.id !== session.id); 
    success.value = 'Sesión revocada.' 
  } catch (err: any) { 
    error.value = err?.data?.statusMessage || 'No se pudo revocar la sesión.' 
  } 
}

const date = (value: string) => new Intl.DateTimeFormat('es-PE', { 
  dateStyle: 'short', 
  timeStyle: 'short' 
}).format(new Date(value))

const roleLabel = (name: string) => ({ 
  admin: 'Administrador', 
  asesor: 'Asesor', 
  supervisor: 'Supervisor', 
  verificador: 'Verificador', 
  asistente_comercial: 'Asistente comercial', 
  user: 'Usuario' 
}[name] || name)

watch(activeTab, loadTab)
watch(() => [route.path, route.query.tab], () => {
  const tab = tabFromRoute()
  if (tab !== activeTab.value) activeTab.value = tab
})
watch(search, () => debouncedLoadUsers())

onMounted(async () => { await loadRoles(); await loadTab() })
</script>
