<script setup lang="ts">
import type { UpdateProfileRequest } from '~/shared/types/auth'

definePageMeta({ middleware: 'auth' })
const { user, updateProfile, changePassword } = useAuth()
const profileForm = reactive({ name: '', username: '', email: '' })
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const profileLoading = ref(false); const profileError = ref(''); const profileSuccess = ref('')
const passwordLoading = ref(false); const passwordError = ref(''); const passwordSuccess = ref('')

const initializeProfileForm = () => { 
  if (user.value) Object.assign(profileForm, { 
    name: user.value.name || '', 
    username: user.value.username || '', 
    email: user.value.email || '' 
  }) 
}
const resetProfileForm = () => { 
  initializeProfileForm(); 
  profileError.value = ''; 
  profileSuccess.value = ''
}
const resetPasswordForm = () => { Object.assign(passwordForm, { currentPassword: '', newPassword: '', confirmPassword: '' }); passwordError.value = ''; passwordSuccess.value = '' }

const handleUpdateProfile = async () => {
  if (profileLoading.value) return
  profileLoading.value = true; profileError.value = ''; profileSuccess.value = ''
  const updates: UpdateProfileRequest = {}
  if (profileForm.name !== user.value?.name) updates.name = profileForm.name
  if (profileForm.username !== user.value?.username) updates.username = profileForm.username
  if (profileForm.email !== user.value?.email) updates.email = profileForm.email
  if (!Object.keys(updates).length) { 
    profileError.value = 'No hay cambios para actualizar'; 
    profileLoading.value = false; 
    return 
  }
  try { 
    const response = await updateProfile(updates); 
    if (response.success) { 
      profileSuccess.value = 'Perfil actualizado correctamente'; 
      initializeProfileForm() 
    } 
    else profileError.value = response.message 
  } catch { 
    profileError.value = 'No pudimos conectar con el servidor.' 
  } finally { 
    profileLoading.value = false 
  }
}

const handleChangePassword = async () => {
  if (passwordLoading.value) return
  passwordLoading.value = true; 
  passwordError.value = ''; 
  passwordSuccess.value = ''
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = 'Las nuevas contraseñas no coinciden'; 
    passwordLoading.value = false; 
    return 
}
  try { const response = await changePassword(passwordForm); if (response.success) { passwordSuccess.value = 'Contraseña actualizada correctamente'; resetPasswordForm() } else passwordError.value = response.message } catch { passwordError.value = 'No pudimos conectar con el servidor.' } finally { passwordLoading.value = false }
}

onMounted(initializeProfileForm)
watch(user, initializeProfileForm, { deep: true })
</script>

<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader title="Mi perfil" subtitle="Administra tus datos y credenciales" back-to="/dashboard" />
    <main class="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div class="grid gap-6 lg:grid-cols-2">
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Datos personales</UiCardTitle>
            <UiCardDescription>Esta información se mostrará en tu cuenta.</UiCardDescription>
          </UiCardHeader>
          <UiCardContent>
            <form class="space-y-5" @submit.prevent="handleUpdateProfile">
              <div class="space-y-2">
                <UiLabel for="name">Nombre completo</UiLabel>
                <UiInput id="name" v-model="profileForm.name" autocomplete="name" />
              </div>
              <div class="space-y-2">
                <UiLabel for="username">Usuario</UiLabel>
                <UiInput id="username" v-model="profileForm.username" autocomplete="username" />
              </div>
              <div class="space-y-2">
                <UiLabel for="email">Correo electrónico</UiLabel>
                <UiInput id="email" v-model="profileForm.email" type="email" autocomplete="email" />
              </div>
              <UiAlert v-if="profileError" variant="destructive">
                <UiAlertDescription>{{ profileError }}</UiAlertDescription>
              </UiAlert>
              <UiAlert v-if="profileSuccess">
                <UiAlertDescription>{{ profileSuccess }}</UiAlertDescription>
              </UiAlert>
              <div class="flex justify-end gap-2">
                <UiButton type="button" variant="outline" @click="resetProfileForm">Cancelar</UiButton>
                <UiButton type="submit" :disabled="profileLoading">{{ profileLoading ? 'Guardando…' : 'Guardar cambios'
                  }}</UiButton>
              </div>
            </form>
          </UiCardContent>
        </UiCard>
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Seguridad</UiCardTitle>
            <UiCardDescription>Actualiza tu contraseña periódicamente.</UiCardDescription>
          </UiCardHeader>
          <UiCardContent>
            <form class="space-y-5" @submit.prevent="handleChangePassword">
              <div class="space-y-2">
                <UiLabel for="currentPassword">Contraseña actual</UiLabel>
                <UiInput id="currentPassword" v-model="passwordForm.currentPassword" type="password"
                  autocomplete="current-password" required />
              </div>
              <div class="space-y-2">
                <UiLabel for="newPassword">Nueva contraseña</UiLabel>
                <UiInput id="newPassword" v-model="passwordForm.newPassword" type="password" autocomplete="new-password"
                  minlength="6" required />
              </div>
              <div class="space-y-2">
                <UiLabel for="confirmPassword">Confirmar contraseña</UiLabel>
                <UiInput id="confirmPassword" v-model="passwordForm.confirmPassword" type="password"
                  autocomplete="new-password" minlength="6" required />
              </div>
              <UiAlert v-if="passwordError" variant="destructive">
                <UiAlertDescription>{{ passwordError }}</UiAlertDescription>
              </UiAlert>
              <UiAlert v-if="passwordSuccess">
                <UiAlertDescription>{{ passwordSuccess }}</UiAlertDescription>
              </UiAlert>
              <div class="flex justify-end gap-2">
                <UiButton type="button" variant="outline" @click="resetPasswordForm">Limpiar</UiButton>
                <UiButton type="submit" :disabled="passwordLoading">{{ passwordLoading ? 'Actualizando…' : 'Cambiar contraseña' }}</UiButton>
              </div>
            </form>
          </UiCardContent>
        </UiCard>
      </div>
      <UiCard>
        <UiCardHeader>
          <UiCardTitle>Resumen de cuenta</UiCardTitle>
          <UiCardDescription>Estado actual de tu identidad en Brighton.</UiCardDescription>
        </UiCardHeader>
        <UiCardContent>
          <dl class="grid gap-5 sm:grid-cols-3">
            <div>
              <dt class="text-sm text-muted-foreground">Rol</dt>
              <dd class="mt-1">
                <UiBadge>{{ user?.role?.name || 'Sin rol' }}</UiBadge>
              </dd>
            </div>
            <div>
              <dt class="text-sm text-muted-foreground">Estado</dt>
              <dd class="mt-1 font-medium">{{ user?.active ? 'Activo' : 'Inactivo' }}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted-foreground">Miembro desde</dt>
              <dd class="mt-1 font-medium">{{ user?.created_at ? new Date(user.created_at).toLocaleDateString('es-PE') :
                '—' }}</dd>
            </div>
          </dl>
        </UiCardContent>
      </UiCard>
    </main>
  </div>
</template>
