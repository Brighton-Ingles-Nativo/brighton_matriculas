<script setup lang="ts">
import {
  BellRing,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  ListTree,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Save,
  Settings2,
} from '@lucide/vue'

definePageMeta({ middleware: ['auth', 'admin'] })

interface Strategy {
  id: string
  code: string | null
  name: string
  description: string | null
  active: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
  updatedBy: { id: string; name: string } | null
  contractCount: number
}

interface StrategyForm {
  name: string
  code: string
  description: string
  active: boolean
  displayOrder: number
}

interface PushConfigResponse {
  success: boolean
  enabled: boolean
  publicKey: string | null
}

type BrowserPermission = NotificationPermission | 'unsupported'

const { csrfHeaders } = useAuth()
const { pushEnabled, enablePush, disablePush } = useNotifications()

const strategies = ref<Strategy[]>([])
const strategiesLoading = ref(true)
const strategyFormOpen = ref(false)
const editingStrategy = ref<Strategy | null>(null)
const savingStrategy = ref(false)
const strategyError = ref('')
const strategySuccess = ref('')

const notificationError = ref('')
const notificationSuccess = ref('')
const notificationStatusLoading = ref(true)
const notificationsBusy = ref(false)
const pushConfig = ref<PushConfigResponse | null>(null)
const browserPermission = ref<BrowserPermission>('unsupported')
const browserSubscribed = ref(false)

const strategyForm = reactive<StrategyForm>({
  name: '',
  code: '',
  description: '',
  active: true,
  displayOrder: 0,
})

const hasPushSubscription = computed(() => browserSubscribed.value || pushEnabled.value)
const isPushConfigured = computed(() => pushConfig.value?.enabled === true)

const message = (error: unknown, fallback: string) => {
  const response = error as { data?: { statusMessage?: string }; statusMessage?: string }
  return response.data?.statusMessage || response.statusMessage || fallback
}

const resetStrategyForm = () => {
  Object.assign(strategyForm, {
    name: '',
    code: '',
    description: '',
    active: true,
    displayOrder: 0,
  })
}

const loadStrategies = async () => {
  strategiesLoading.value = true
  strategyError.value = ''
  try {
    const response = await $fetch<{ success: boolean; data: Strategy[] }>('/api/admin/strategies', {
      credentials: 'include',
    })
    strategies.value = response.data
  } catch (error: unknown) {
    strategyError.value = message(error, 'No se pudo cargar el catálogo de estrategias.')
  } finally {
    strategiesLoading.value = false
  }
}

const openStrategyCreate = () => {
  strategyError.value = ''
  strategySuccess.value = ''
  editingStrategy.value = null
  resetStrategyForm()
  strategyFormOpen.value = true
}

const openStrategyEdit = (strategy: Strategy) => {
  strategyError.value = ''
  strategySuccess.value = ''
  editingStrategy.value = strategy
  Object.assign(strategyForm, {
    name: strategy.name,
    code: strategy.code || '',
    description: strategy.description || '',
    active: strategy.active,
    displayOrder: strategy.displayOrder,
  })
  strategyFormOpen.value = true
}

const saveStrategy = async () => {
  savingStrategy.value = true
  strategyError.value = ''
  strategySuccess.value = ''

  try {
    const editing = editingStrategy.value
    await $fetch(editing ? `/api/admin/strategies/${editing.id}` : '/api/admin/strategies', {
      method: editing ? 'PUT' : 'POST',
      credentials: 'include',
      headers: await csrfHeaders(),
      body: {
        name: strategyForm.name.trim(),
        code: strategyForm.code.trim() || null,
        description: strategyForm.description.trim() || null,
        active: strategyForm.active,
        displayOrder: strategyForm.displayOrder,
      },
    })
    strategyFormOpen.value = false
    strategySuccess.value = editing ? 'Estrategia actualizada.' : 'Estrategia creada.'
    await loadStrategies()
  } catch (error: unknown) {
    strategyError.value = message(error, 'No se pudo guardar la estrategia.')
  } finally {
    savingStrategy.value = false
  }
}

const toggleStrategy = async (strategy: Strategy) => {
  strategyError.value = ''
  strategySuccess.value = ''
  try {
    await $fetch(`/api/admin/strategies/${strategy.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: await csrfHeaders(),
      body: { active: !strategy.active },
    })
    strategySuccess.value = strategy.active ? 'Estrategia desactivada.' : 'Estrategia activada.'
    await loadStrategies()
  } catch (error: unknown) {
    strategyError.value = message(error, 'No se pudo cambiar el estado de la estrategia.')
  }
}

const refreshNotificationStatus = async () => {
  notificationStatusLoading.value = true
  notificationError.value = ''

  try {
    pushConfig.value = await $fetch<PushConfigResponse>('/api/notifications/push-config', {
      credentials: 'include',
    })
  } catch (error: unknown) {
    pushConfig.value = null
    notificationError.value = message(error, 'No se pudo consultar la configuración de notificaciones.')
  }

  if (!import.meta.client || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    browserPermission.value = 'unsupported'
    browserSubscribed.value = false
    pushEnabled.value = false
    notificationStatusLoading.value = false
    return
  }

  browserPermission.value = Notification.permission
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    browserSubscribed.value = Boolean(await registration?.pushManager.getSubscription())
    pushEnabled.value = browserSubscribed.value
  } catch {
    browserSubscribed.value = false
    pushEnabled.value = false
  } finally {
    notificationStatusLoading.value = false
  }
}

const toggleBrowserNotifications = async () => {
  notificationsBusy.value = true
  notificationError.value = ''
  notificationSuccess.value = ''

  try {
    if (hasPushSubscription.value) {
      await disablePush()
      notificationSuccess.value = 'Las notificaciones se desactivaron en este navegador.'
    } else {
      const enabled = await enablePush()
      if (!enabled) {
        await refreshNotificationStatus()
        notificationError.value = isPushConfigured.value
          ? 'El navegador no concedió permiso para recibir notificaciones.'
          : 'La entrega de notificaciones push aún no está habilitada en el servidor.'
        return
      }
      notificationSuccess.value = 'Las notificaciones están activas en este navegador.'
    }
    await refreshNotificationStatus()
  } catch (error: unknown) {
    notificationError.value = message(error, 'No se pudo actualizar la suscripción de este navegador.')
  } finally {
    notificationsBusy.value = false
  }
}

const permissionLabel = (permission: BrowserPermission) => ({
  granted: 'Permitidas',
  denied: 'Bloqueadas',
  default: 'Pendientes de autorización',
  unsupported: 'No compatibles',
}[permission])

const formatDate = (value: string) => new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value))

onMounted(() => {
  void loadStrategies()
  void refreshNotificationStatus()
})
</script>

<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader title="Configuración" subtitle="Catálogos y parámetros funcionales" back-to="/admin" />

    <main class="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <section class="max-w-3xl">
        <h1 class="text-3xl font-semibold tracking-tight">Configuración funcional</h1>
        <p class="mt-2 leading-7 text-muted-foreground">
          Administra los valores que afectan el registro comercial y las preferencias de notificación de este navegador.
        </p>
      </section>

      <section aria-labelledby="strategies-heading" class="space-y-5">
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div class="max-w-2xl">
            <div class="flex items-center gap-2 text-sm font-medium text-primary">
              <ListTree class="size-4" aria-hidden="true" />
              Catálogo comercial
            </div>
            <h2 id="strategies-heading" class="mt-2 text-2xl font-semibold tracking-tight">Estrategias comerciales</h2>
            <p class="mt-1 text-sm leading-6 text-muted-foreground">
              Define las estrategias disponibles al registrar una matrícula. Desactiva las que ya no deben aparecer, sin perder su historial.
            </p>
          </div>
          <div class="flex shrink-0 gap-2">
            <UiButton variant="outline" :disabled="strategiesLoading" aria-label="Actualizar estrategias" @click="loadStrategies">
              <RefreshCw :class="['size-4', { 'animate-spin': strategiesLoading }]" aria-hidden="true" />
            </UiButton>
            <UiButton class="gap-2" @click="openStrategyCreate">
              <Plus class="size-4" aria-hidden="true" />
              Nueva estrategia
            </UiButton>
          </div>
        </div>

        <UiAlert v-if="strategyError" variant="destructive">
          <CircleAlert class="size-4" aria-hidden="true" />
          <UiAlertDescription>{{ strategyError }}</UiAlertDescription>
        </UiAlert>
        <UiAlert v-if="strategySuccess">
          <CheckCircle2 class="size-4" aria-hidden="true" />
          <UiAlertDescription>{{ strategySuccess }}</UiAlertDescription>
        </UiAlert>

        <UiCard v-if="strategyFormOpen">
          <UiCardHeader>
            <UiCardTitle>{{ editingStrategy ? 'Editar estrategia' : 'Nueva estrategia' }}</UiCardTitle>
            <UiCardDescription>
              El código es opcional y sirve para identificar la estrategia en reportes e integraciones.
            </UiCardDescription>
          </UiCardHeader>
          <form class="grid gap-5 p-6 pt-0 sm:grid-cols-2" @submit.prevent="saveStrategy">
            <div class="space-y-2">
              <UiLabel for="strategy-name">Nombre</UiLabel>
              <UiInput id="strategy-name" v-model="strategyForm.name" minlength="2" maxlength="150" required autofocus />
            </div>
            <div class="space-y-2">
              <UiLabel for="strategy-code">Código opcional</UiLabel>
              <UiInput id="strategy-code" v-model="strategyForm.code" maxlength="50" placeholder="REFERIDOS" />
              <p class="text-xs leading-5 text-muted-foreground">Letras, números, guiones y guiones bajos.</p>
            </div>
            <div class="space-y-2 sm:col-span-2">
              <UiLabel for="strategy-description">Descripción</UiLabel>
              <UiTextarea id="strategy-description" v-model="strategyForm.description" :maxlength="2000" rows="3" placeholder="Indica cuándo debe usarse esta estrategia." />
            </div>
            <div class="space-y-2">
              <UiLabel for="strategy-order">Orden de visualización</UiLabel>
              <UiInput
                id="strategy-order"
                :model-value="strategyForm.displayOrder"
                type="number"
                min="0"
                max="100000"
                @update:model-value="strategyForm.displayOrder = Number($event)"
              />
              <p class="text-xs leading-5 text-muted-foreground">Los números menores se muestran primero.</p>
            </div>
            <label class="flex items-center gap-3 self-end pb-1 text-sm font-medium">
              <UiCheckbox v-model="strategyForm.active" />
              Estrategia activa
            </label>
            <div class="flex justify-end gap-2 sm:col-span-2">
              <UiButton type="button" variant="outline" @click="strategyFormOpen = false">Cancelar</UiButton>
              <UiButton type="submit" class="gap-2" :disabled="savingStrategy">
                <LoaderCircle v-if="savingStrategy" class="size-4 animate-spin" aria-hidden="true" />
                <Save v-else class="size-4" aria-hidden="true" />
                {{ savingStrategy ? 'Guardando…' : 'Guardar estrategia' }}
              </UiButton>
            </div>
          </form>
        </UiCard>

        <UiCard>
          <UiCardContent class="p-0">
            <div v-if="strategiesLoading" class="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
              Cargando estrategias…
            </div>
            <div v-else-if="strategies.length" class="overflow-x-auto">
              <table class="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr class="border-b text-xs uppercase text-muted-foreground">
                    <th class="p-4 font-medium">Estrategia</th>
                    <th class="p-4 font-medium">Código</th>
                    <th class="p-4 font-medium">Orden</th>
                    <th class="p-4 font-medium">Matrículas</th>
                    <th class="p-4 font-medium">Estado</th>
                    <th class="p-4 font-medium">Última actualización</th>
                    <th class="p-4 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="strategy in strategies" :key="strategy.id" class="border-b last:border-0">
                    <td class="p-4">
                      <p class="font-medium">{{ strategy.name }}</p>
                      <p v-if="strategy.description" class="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{{ strategy.description }}</p>
                    </td>
                    <td class="p-4 text-muted-foreground">{{ strategy.code || '—' }}</td>
                    <td class="p-4 tabular-nums">{{ strategy.displayOrder }}</td>
                    <td class="p-4 tabular-nums">{{ strategy.contractCount }}</td>
                    <td class="p-4">
                      <UiBadge :variant="strategy.active ? 'default' : 'secondary'">{{ strategy.active ? 'Activa' : 'Inactiva' }}</UiBadge>
                    </td>
                    <td class="p-4">
                      <p>{{ formatDate(strategy.updatedAt) }}</p>
                      <p v-if="strategy.updatedBy" class="mt-1 text-xs text-muted-foreground">{{ strategy.updatedBy.name }}</p>
                    </td>
                    <td class="p-4">
                      <div class="flex justify-end gap-2">
                        <UiButton variant="outline" size="sm" class="gap-1" @click="openStrategyEdit(strategy)">
                          <Pencil class="size-3" aria-hidden="true" />
                          Editar
                        </UiButton>
                        <UiButton variant="outline" size="sm" @click="toggleStrategy(strategy)">
                          {{ strategy.active ? 'Desactivar' : 'Activar' }}
                        </UiButton>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="px-6 py-10 text-center">
              <ListTree class="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
              <p class="mt-3 font-medium">Aún no hay estrategias registradas</p>
              <p class="mt-1 text-sm text-muted-foreground">Crea la primera para que pueda seleccionarse en las matrículas.</p>
              <UiButton class="mt-5 gap-2" @click="openStrategyCreate">
                <Plus class="size-4" aria-hidden="true" />
                Nueva estrategia
              </UiButton>
            </div>
          </UiCardContent>
        </UiCard>
      </section>

      <section aria-labelledby="notifications-heading" class="space-y-5 border-t pt-10">
        <div class="max-w-3xl">
          <div class="flex items-center gap-2 text-sm font-medium text-primary">
            <BellRing class="size-4" aria-hidden="true" />
            Preferencia del dispositivo
          </div>
          <h2 id="notifications-heading" class="mt-2 text-2xl font-semibold tracking-tight">Notificaciones del navegador</h2>
          <p class="mt-1 text-sm leading-6 text-muted-foreground">
            Controla si este navegador puede recibir avisos. Esta preferencia no modifica otros equipos ni las reglas de entrega del sistema.
          </p>
        </div>

        <UiAlert v-if="notificationError" variant="destructive">
          <CircleAlert class="size-4" aria-hidden="true" />
          <UiAlertDescription>{{ notificationError }}</UiAlertDescription>
        </UiAlert>
        <UiAlert v-if="notificationSuccess">
          <CheckCircle2 class="size-4" aria-hidden="true" />
          <UiAlertDescription>{{ notificationSuccess }}</UiAlertDescription>
        </UiAlert>

        <UiCard>
          <UiCardHeader class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <UiCardTitle>Estado de la suscripción</UiCardTitle>
              <UiCardDescription class="mt-1">Revisa los tres requisitos antes de activar los avisos en este dispositivo.</UiCardDescription>
            </div>
            <UiButton variant="outline" size="sm" class="gap-2" :disabled="notificationStatusLoading || notificationsBusy" @click="refreshNotificationStatus">
              <RefreshCw :class="['size-4', { 'animate-spin': notificationStatusLoading }]" aria-hidden="true" />
              Actualizar estado
            </UiButton>
          </UiCardHeader>
          <UiCardContent class="space-y-6">
            <div v-if="notificationStatusLoading" class="flex items-center gap-3 py-2 text-sm text-muted-foreground">
              <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
              Comprobando este navegador…
            </div>
            <dl v-else class="divide-y rounded-lg border">
              <div class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <dt class="font-medium">Servicio de notificaciones</dt>
                  <dd class="mt-1 text-sm text-muted-foreground">Configuración segura del servidor para enviar avisos push.</dd>
                </div>
                <UiBadge :variant="isPushConfigured ? 'default' : 'secondary'">
                  {{ isPushConfigured ? 'Disponible' : 'Pendiente en servidor' }}
                </UiBadge>
              </div>
              <div class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <dt class="font-medium">Permiso del navegador</dt>
                  <dd class="mt-1 text-sm text-muted-foreground">La autorización se concede desde el navegador cuando decides activarlas.</dd>
                </div>
                <UiBadge :variant="browserPermission === 'granted' ? 'default' : 'secondary'">{{ permissionLabel(browserPermission) }}</UiBadge>
              </div>
              <div class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <dt class="font-medium">Suscripción de este dispositivo</dt>
                  <dd class="mt-1 text-sm text-muted-foreground">Se guarda de forma independiente en cada navegador.</dd>
                </div>
                <UiBadge :variant="hasPushSubscription ? 'default' : 'secondary'">{{ hasPushSubscription ? 'Activa' : 'Inactiva' }}</UiBadge>
              </div>
            </dl>

            <UiAlert v-if="!isPushConfigured" variant="default">
              <Settings2 class="size-4" aria-hidden="true" />
              <UiAlertDescription>
                El envío push debe habilitarse con las credenciales del servidor. Hasta entonces, las notificaciones dentro de la plataforma seguirán disponibles en el centro de notificaciones.
              </UiAlertDescription>
            </UiAlert>

            <div class="flex flex-col justify-between gap-4 border-t pt-5 sm:flex-row sm:items-center">
              <p class="max-w-xl text-sm leading-6 text-muted-foreground">
                {{ hasPushSubscription ? 'Puedes desactivar esta suscripción sin afectar las notificaciones de otros navegadores.' : 'Al activarlas, el navegador puede solicitarte permiso una sola vez.' }}
              </p>
              <UiButton class="shrink-0 gap-2" :disabled="notificationsBusy || !isPushConfigured || browserPermission === 'unsupported'" @click="toggleBrowserNotifications">
                <LoaderCircle v-if="notificationsBusy" class="size-4 animate-spin" aria-hidden="true" />
                <Power v-else class="size-4" aria-hidden="true" />
                {{ hasPushSubscription ? 'Desactivar en este navegador' : 'Activar en este navegador' }}
              </UiButton>
            </div>

            <NuxtLink to="/notificaciones" class="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              Ver centro de notificaciones
              <ExternalLink class="size-3.5" aria-hidden="true" />
            </NuxtLink>
          </UiCardContent>
        </UiCard>
      </section>
    </main>
  </div>
</template>
