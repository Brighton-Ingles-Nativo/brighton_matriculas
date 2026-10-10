<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader title="Organización" subtitle="Sedes, equipos y supervisión comercial" back-to="/admin" />
    <main class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div class="flex flex-wrap gap-2 border-b">
        <UiButton v-for="tab in tabs" :key="tab" variant="ghost" :class="activeTab === tab ? 'border-b-2 border-primary text-primary' : ''" @click="activeTab = tab">{{ tab }}</UiButton>
      </div>

      <UiAlert v-if="error" variant="destructive"><UiAlertDescription>{{ error }}</UiAlertDescription></UiAlert>
      <UiAlert v-if="success"><UiAlertDescription>{{ success }}</UiAlertDescription></UiAlert>

      <template v-if="activeTab === 'Sedes'">
        <section class="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><h2 class="text-xl font-semibold">Sedes</h2><p class="text-sm text-muted-foreground">Asigna supervisores y consulta los equipos de cada sede.</p></div>
          <div class="flex gap-2"><UiButton variant="outline" @click="loadAll"><RefreshCw class="size-4" /></UiButton><UiButton class="gap-2" @click="openSiteCreate"><Plus class="size-4" /> Nueva sede</UiButton></div>
        </section>
        <UiDialog :open="siteFormOpen" @update:open="siteFormOpen = $event">
          <UiDialogScrollContent class="max-h-[calc(100vh-3rem)] overflow-y-auto sm:max-w-2xl">
            <UiDialogHeader>
              <UiDialogTitle>{{ editingSite ? 'Editar sede' : 'Nueva sede' }}</UiDialogTitle>
              <UiDialogDescription>Una sede puede tener uno o varios supervisores.</UiDialogDescription>
            </UiDialogHeader>
            <form class="grid gap-5 sm:grid-cols-2" @submit.prevent="saveSite">
              <div class="space-y-2"><UiLabel for="site-name">Nombre de la sede</UiLabel><UiInput id="site-name" v-model="siteForm.name" required /></div>
              <label class="flex items-center gap-2 pt-7 text-sm"><input v-model="siteForm.active" type="checkbox" /> Sede activa</label>
              <div class="space-y-2 sm:col-span-2"><UiLabel>Supervisores asignados</UiLabel><div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <label v-for="supervisor in supervisors" :key="supervisor.id" class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><input v-model="siteForm.supervisorIds" type="checkbox" :value="supervisor.id" /> <span>{{ supervisor.name }} <span class="text-muted-foreground">(@{{ supervisor.username }})</span></span></label>
                <div v-if="!supervisors.length" class="flex items-center gap-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground"><span>No hay supervisores activos disponibles.</span><UiButton variant="outline" size="sm" as-child><NuxtLink to="/admin/accesos/usuarios">Crear supervisor</NuxtLink></UiButton></div>
              </div></div>
              <UiDialogFooter class="sm:col-span-2"><UiButton type="button" variant="outline" @click="siteFormOpen = false">Cancelar</UiButton><UiButton type="submit" class="gap-2" :disabled="saving"><Save class="size-4" /> Guardar sede</UiButton></UiDialogFooter>
            </form>
          </UiDialogScrollContent>
        </UiDialog>
        <UiCard><UiCardContent class="p-0"><div v-if="loading" class="p-6 text-sm text-muted-foreground">Cargando sedes…</div><div v-else class="overflow-x-auto">
          <table class="w-full min-w-[900px] text-left text-sm"><thead><tr class="border-b text-xs uppercase text-muted-foreground"><th class="p-4">Sede</th><th class="p-4">Supervisores</th><th class="p-4">Equipos</th><th class="p-4">Estado</th><th class="p-4 text-right">Acciones</th></tr></thead><tbody>
            <tr v-for="site in sites" :key="site.id" class="border-b last:border-0"><td class="p-4"><p class="font-medium">{{ site.name }}</p><p class="text-xs text-muted-foreground">{{ site.teams.length }} equipo(s)</p></td><td class="p-4"><div class="flex flex-wrap gap-1"><UiBadge v-for="supervisor in site.supervisors" :key="supervisor.id" variant="outline">{{ supervisor.name }}</UiBadge><span v-if="!site.supervisors.length" class="text-muted-foreground">Sin asignar</span></div></td><td class="p-4"><div class="space-y-1"><p v-for="team in site.teams" :key="team.id"><span class="font-medium">{{ team.name }}</span> <span class="text-xs text-muted-foreground">({{ modalityLabel(team.modality) }})</span></p><span v-if="!site.teams.length" class="text-muted-foreground">Sin equipos</span></div></td><td class="p-4"><UiBadge :variant="site.active ? 'default' : 'secondary'">{{ site.active ? 'Activa' : 'Inactiva' }}</UiBadge></td><td class="p-4"><div class="flex justify-end gap-2"><UiButton variant="outline" size="sm" class="gap-1" @click="openSiteEdit(site)"><Pencil class="size-3" /> Editar</UiButton><UiButton variant="outline" size="sm" @click="toggleSite(site)">{{ site.active ? 'Desactivar' : 'Activar' }}</UiButton></div></td></tr>
            <tr v-if="!sites.length"><td colspan="5" class="p-8 text-center text-muted-foreground">No hay sedes registradas.</td></tr>
          </tbody></table>
        </div></UiCardContent></UiCard>
      </template>

      <template v-else>
        <section class="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 class="text-xl font-semibold">Equipos</h2><p class="text-sm text-muted-foreground">Crea equipos dentro de una sede y asigna sus supervisores.</p></div><div class="flex gap-2"><UiButton variant="outline" @click="loadAll"><RefreshCw class="size-4" /></UiButton><UiButton class="gap-2" @click="openTeamCreate"><Plus class="size-4" /> Nuevo equipo</UiButton></div></section>
        <UiDialog :open="teamFormOpen" @update:open="teamFormOpen = $event">
          <UiDialogScrollContent class="max-h-[calc(100vh-3rem)] overflow-y-auto sm:max-w-3xl">
            <UiDialogHeader>
              <UiDialogTitle>{{ editingTeam ? 'Editar equipo' : 'Nuevo equipo' }}</UiDialogTitle>
              <UiDialogDescription>Un supervisor puede estar asignado a varios equipos.</UiDialogDescription>
            </UiDialogHeader>
            <form class="grid gap-5 sm:grid-cols-2" @submit.prevent="saveTeam">
              <div class="space-y-2"><UiLabel for="team-name">Nombre del equipo</UiLabel><UiInput id="team-name" v-model="teamForm.name" required /></div><div class="space-y-2"><UiLabel for="team-site">Sede</UiLabel><UiSelect v-model="teamForm.siteId" required><UiSelectTrigger id="team-site" class="w-full"><UiSelectValue placeholder="Seleccione sede" /></UiSelectTrigger><UiSelectContent><UiSelectItem v-for="site in activeSites" :key="site.id" :value="site.id">{{ site.name }}</UiSelectItem></UiSelectContent></UiSelect></div>
              <div class="space-y-2"><UiLabel for="team-modality">Modalidad del equipo</UiLabel><UiSelect v-model="teamForm.modality"><UiSelectTrigger id="team-modality" class="w-full"><UiSelectValue /></UiSelectTrigger><UiSelectContent><UiSelectItem value="PRESENCIAL">Presencial</UiSelectItem><UiSelectItem value="VIRTUAL">Virtual</UiSelectItem></UiSelectContent></UiSelect></div><label class="flex items-center gap-2 pt-7 text-sm"><input v-model="teamForm.active" type="checkbox" /> Equipo activo</label>
              <div class="space-y-2 sm:col-span-2"><UiLabel>Supervisores asignados</UiLabel><div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><label v-for="supervisor in supervisors" :key="supervisor.id" class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><input v-model="teamForm.supervisorIds" type="checkbox" :value="supervisor.id" /> <span>{{ supervisor.name }}</span></label><div v-if="!supervisors.length" class="flex items-center gap-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3"><span>No hay supervisores activos disponibles.</span><UiButton variant="outline" size="sm" as-child><NuxtLink to="/admin/accesos/usuarios">Crear supervisor</NuxtLink></UiButton></div></div></div>
              <div class="space-y-2 sm:col-span-2"><UiLabel>Miembros del equipo</UiLabel><div class="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3"><label v-for="member in activeUsers" :key="member.id" class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><input v-model="teamForm.memberIds" type="checkbox" :value="member.id" /> <span>{{ member.name }} <span class="text-muted-foreground">({{ roleLabel(member.role.name) }})</span></span></label><p v-if="!activeUsers.length" class="text-sm text-muted-foreground">No hay usuarios activos disponibles.</p></div></div>
              <UiDialogFooter class="sm:col-span-2"><UiButton type="button" variant="outline" @click="teamFormOpen = false">Cancelar</UiButton><UiButton type="submit" class="gap-2" :disabled="saving"><Save class="size-4" /> Guardar equipo</UiButton></UiDialogFooter>
            </form>
          </UiDialogScrollContent>
        </UiDialog>
        <UiCard><UiCardContent class="p-0"><div v-if="loading" class="p-6 text-sm text-muted-foreground">Cargando equipos…</div><div v-else class="overflow-x-auto"><table class="w-full min-w-[950px] text-left text-sm"><thead><tr class="border-b text-xs uppercase text-muted-foreground"><th class="p-4">Equipo</th><th class="p-4">Sede</th><th class="p-4">Modalidad</th><th class="p-4">Supervisores</th><th class="p-4">Miembros</th><th class="p-4">Estado</th><th class="p-4 text-right">Acciones</th></tr></thead><tbody><tr v-for="team in teams" :key="team.id" class="border-b last:border-0"><td class="p-4 font-medium">{{ team.name }}</td><td class="p-4">{{ team.site.name }}</td><td class="p-4">{{ modalityLabel(team.modality) }}</td><td class="p-4"><div class="flex flex-wrap gap-1"><UiBadge v-for="supervisor in team.supervisors" :key="supervisor.id" variant="outline">{{ supervisor.name }}</UiBadge><span v-if="!team.supervisors.length" class="text-muted-foreground">Sin asignar</span></div></td><td class="p-4"><UiAvatarGroup v-if="team.members.length" :aria-label="`${team.members.length} miembros`"><UiAvatar v-for="member in team.members.slice(0, 5)" :key="member.id" size="sm" :title="member.name" :aria-label="member.name"><UiAvatarFallback>{{ initials(member.name) }}</UiAvatarFallback></UiAvatar><UiAvatarGroupCount v-if="team.members.length > 5" class="size-6 text-xs">+{{ team.members.length - 5 }}</UiAvatarGroupCount></UiAvatarGroup><span v-else class="text-muted-foreground">Sin asignar</span></td><td class="p-4"><UiBadge :variant="team.active ? 'default' : 'secondary'">{{ team.active ? 'Activo' : 'Inactivo' }}</UiBadge></td><td class="p-4 text-right"><div class="flex justify-end gap-2"><UiButton variant="outline" size="sm" class="gap-1" @click="openTeamEdit(team)"><Pencil class="size-3" /> Editar</UiButton><UiButton variant="outline" size="sm" @click="toggleTeam(team)">{{ team.active ? 'Desactivar' : 'Activar' }}</UiButton></div></td></tr><tr v-if="!teams.length"><td colspan="7" class="p-8 text-center text-muted-foreground">No hay equipos registrados.</td></tr></tbody></table></div></UiCardContent></UiCard>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { Pencil, Plus, RefreshCw, Save } from '@lucide/vue'

definePageMeta({
  middleware: ['auth', 'admin'],
  alias: ['/sites', '/admin/organizacion/sedes', '/admin/organizacion/equipos']
})
const { csrfHeaders } = useAuth()
const route = useRoute()
const tabs = ['Sedes', 'Equipos'] as const
const tabFromRoute = () => route.path.endsWith('/equipos') || route.query.tab === 'equipos' ? 'Equipos' : 'Sedes'
const activeTab = ref<(typeof tabs)[number]>(tabFromRoute())
type Supervisor = { 
  id: string; 
  name: string; 
  username: string; 
  active?: boolean 
}
type Site = { 
  id: string; 
  name: string; 
  active: boolean; 
  supervisors: Supervisor[]; 
  teams: { 
    id: string; 
    name: string; 
    modality: string; 
    active: boolean; 
    supervisors: Supervisor[] 
  }[] 
}
type Member = Supervisor & { role: { name: string } }
type Team = { 
  id: string; 
  name: string; 
  modality: string; 
  active: boolean; 
  site: { 
    id: string; 
    name: string 
  };
  supervisors: Supervisor[]; 
  members: Member[] 
}
const sites = ref<Site[]>([]); 
const teams = ref<Team[]>([]); 
const supervisors = ref<Supervisor[]>([]); 
const activeUsers = ref<Member[]>([])
const loading = ref(false); 
const saving = ref(false); 
const error = ref(''); 
const success = ref('')
const editingSite = ref<Site | null>(null); 
const editingTeam = ref<Team | null>(null); 
const siteFormOpen = ref(false); 
const teamFormOpen = ref(false);

const siteForm = reactive({ 
  name: '', 
  active: true, 
  supervisorIds: [] as string[] 
})

const teamForm = reactive({ 
  name: '', 
  siteId: '', 
  modality: 'PRESENCIAL', 
  active: true, 
  supervisorIds: [] as string[], 
  memberIds: [] as string[] 
})
const activeSites = computed(() => sites.value.filter((site) => site.active || site.id === teamForm.siteId))
const resetMessages = () => { 
  error.value = ''; 
  success.value = '' 
}

const message = (err: any, fallback: string) => err?.data?.statusMessage || fallback

const loadAll = async () => { 
  loading.value = true; 
  resetMessages(); 
  try { const [siteResponse, teamResponse, supervisorResponse, userResponse] = await Promise.all([
      $fetch<{ data: Site[] }>('/api/admin/sites', { 
      credentials: 'include' 
      }), 
      $fetch<{ data: Team[] }>('/api/admin/teams', { 
        credentials: 'include' 
      }), 
      $fetch<{ data: Supervisor[] }>('/api/admin/users', { 
        query: { 
          role: 'supervisor' 
        }, 
        credentials: 'include' 
      }), 
      $fetch<{ data: Member[] }>('/api/admin/users', { 
        credentials: 'include' 
      })
    ]); 
  
    sites.value = siteResponse.data; 
    teams.value = teamResponse.data; 
    supervisors.value = supervisorResponse.data.filter((user) => user.active); 
    activeUsers.value = userResponse.data.filter((user) => user.active) as Member[] 
  } catch (err: any) { 
    error.value = message(err, 'No se pudo cargar la organización.') 
  } finally { 
    loading.value = false 
  } 
}

const openSiteCreate = () => { 
  editingSite.value = null; 
  Object.assign(siteForm, { 
    name: '', 
    active: true, 
    supervisorIds: [] 
  }); 
  siteFormOpen.value = true 
}

const openSiteEdit = (site: Site) => { 
  editingSite.value = site; 
  Object.assign(siteForm, { 
    name: site.name, 
    active: site.active, 
    supervisorIds: site.supervisors.map((item) => item.id) 
  }); 
  siteFormOpen.value = true 
}

const saveSite = async () => { 
  saving.value = true; 
  resetMessages(); 
  try { 
    await $fetch(editingSite.value ? `/api/admin/sites/${editingSite.value.id}` : '/api/admin/sites', { 
      method: editingSite.value ? 'PUT' : 'POST', 
      headers: await csrfHeaders(), 
      credentials: 'include', 
      body: siteForm 
    }); 
    siteFormOpen.value = false; 
    success.value = editingSite.value ? 'Sede actualizada.' : 'Sede creada.'; 
    await loadAll() 
  } catch (err: any) { 
    error.value = message(err, 'No se pudo guardar la sede.') 
  } finally { 
    saving.value = false 
  } 
}

const toggleSite = async (site: Site) => { 
  resetMessages(); 
  try { 
    await $fetch(`/api/admin/sites/${site.id}`, { 
      method: 'PUT', 
      headers: await csrfHeaders(), 
      credentials: 'include', 
      body: { 
        active: !site.active 
      } 
    }); 
    success.value = site.active ? 'Sede desactivada.' : 'Sede activada.'; 
    await loadAll() 
  } catch (err: any) { 
    error.value = message(err, 'No se pudo cambiar el estado de la sede.') 
  } 
}

const openTeamCreate = () => { 
  editingTeam.value = null; 
  Object.assign(teamForm, { 
    name: '', 
    siteId: activeSites.value[0]?.id || '', 
    modality: 'PRESENCIAL', 
    active: true, 
    supervisorIds: [], 
    memberIds: [] 
  }); 
  teamFormOpen.value = true 
}

const openTeamEdit = (team: Team) => { 
  editingTeam.value = team; 
  Object.assign(teamForm, { 
    name: team.name, 
    siteId: team.site.id, 
    modality: team.modality, 
    active: team.active, 
    supervisorIds: team.supervisors.map((item) => item.id), 
    memberIds: team.members.map((item) => item.id) 
  }); 
  teamFormOpen.value = true 
}

const saveTeam = async () => { 
  saving.value = true; 
  resetMessages(); 
  try { 
    await $fetch(editingTeam.value ? `/api/admin/teams/${editingTeam.value.id}` : '/api/admin/teams', { 
      method: editingTeam.value ? 'PUT' : 'POST', 
      headers: await csrfHeaders(), 
      credentials: 'include', 
      body: teamForm 
    }); 
    teamFormOpen.value = false; 
    success.value = editingTeam.value ? 'Equipo actualizado.' : 'Equipo creado.'; 
    await loadAll() 
  } catch (err: any) { 
    error.value = message(err, 'No se pudo guardar el equipo.') 
  } finally { 
    saving.value = false 
  } 
}

const toggleTeam = async (team: Team) => { 
  resetMessages(); 
  try { 
    await $fetch(`/api/admin/teams/${team.id}`, { 
      method: 'PUT', 
      headers: await csrfHeaders(), 
      credentials: 'include', 
      body: { 
        active: !team.active 
      } 
    }); 
    success.value = team.active ? 'Equipo desactivado.' : 'Equipo activado.'; 
    await loadAll() 
  } catch (err: any) { 
    error.value = message(err, 'No se pudo cambiar el estado del equipo.') 
  } 
}

const modalityLabel = (value: string) => value === 'PRESENCIAL' ? 'Presencial' : 'Virtual'
const roleLabel = (value: string) => ({ 
  admin: 'Administrador', 
  asesor: 'Asesor', 
  supervisor: 'Supervisor', 
  verificador: 'Verificador', 
  asistente_comercial: 'Asistente comercial', 
  user: 'Usuario' 
}[value] || value)

const initials = (value: string) => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')

watch(() => [route.path, route.query.tab], () => {
  const tab = tabFromRoute()
  if (tab !== activeTab.value) activeTab.value = tab
})
onMounted(loadAll)
</script>
