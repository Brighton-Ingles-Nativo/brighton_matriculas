<script setup lang="ts">
import { ArrowLeft, LoaderCircle } from '@lucide/vue'

definePageMeta({ layout: 'public', middleware: 'guest' })

const { login } = useAuth()
const router = useRouter()
const form = reactive({ username: '', password: '', rememberMe: true })
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await login(form)
    if (response.success) await router.push('/matriculas')
    else error.value = response.message
  } catch {
    error.value = 'No pudimos conectar con el servidor.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="grid min-h-[100dvh] lg:grid-cols-[0.9fr_1.1fr]">
    <section class="hidden bg-primary p-12 text-primary-foreground lg:flex lg:items-center lg:justify-center">
      <NuxtLink to="/" class="flex items-center justify-center">
        <img src="/assets/images/logoBlanco.webp" alt="Brighton" class="h-24 w-auto object-contain" />
      </NuxtLink>
    </section>

    <section class="flex items-center justify-center bg-muted/20 px-6 py-12">
      <div class="w-full max-w-md">
        <NuxtLink to="/" class="mb-12 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden">
          <ArrowLeft class="size-4" /> Volver al inicio</NuxtLink>
          <div class="mb-8">
              <div class="mb-7 flex justify-center lg:hidden">
                <div class="grid size-24 place-items-center rounded-2xl bg-primary">
                  <img src="/assets/images/logoBlanco.webp" alt="Brighton" class="h-14 w-auto object-contain" />
                </div>
              </div>
              <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Bienvenido de nuevo</p>
              <h2 class="mt-2 text-3xl font-semibold tracking-tight">Iniciar sesión</h2>
              <p class="mt-2 text-muted-foreground">Ingresa tus credenciales para continuar.</p>
            </div>

            <form class="space-y-5" @submit.prevent="handleLogin">
              <div class="space-y-2">
                <UiLabel for="username">Usuario o correo</UiLabel>
                <UiInput id="username" v-model="form.username" name="username" autocomplete="username" placeholder="Ingresar correo o usuario" required />
              </div>
              <div class="space-y-2">
                <UiLabel for="password">Contraseña</UiLabel>
                <UiInput id="password" v-model="form.password" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required />
              </div>
              <label class="flex items-center gap-2 text-sm text-muted-foreground">
                <UiCheckbox v-model="form.rememberMe" /> Mantener mi sesión</label>
                <UiAlert v-if="error" variant="destructive">
                  <UiAlertDescription>{{ error }}</UiAlertDescription>
                </UiAlert>
                <UiButton class="w-full gap-2" size="lg" type="submit" :disabled="loading">
                  <LoaderCircle v-if="loading" class="size-4 animate-spin" />{{ loading ? 'Validando…' : 'Ingresar' }}</UiButton>
            </form>
        <!-- <p class="mt-8 text-center text-sm text-muted-foreground">¿Aún no tienes cuenta? <NuxtLink to="/register" class="font-medium text-foreground underline underline-offset-4">Regístrate</NuxtLink></p> -->
      </div>
    </section>

  </main>
</template>
