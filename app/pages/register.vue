<template>
  <main class="grid min-h-[100dvh] lg:grid-cols-[0.9fr_1.1fr]">
    <section class="hidden bg-primary text-primary-foreground p-12 lg:flex lg:items-center lg:justify-center">
      <NuxtLink to="/" class="flex items-center justify-center">
        <img src="/assets/images/logoBlanco.webp" alt="Brighton" class="h-24 w-auto object-contain" />
      </NuxtLink>
    </section>
    <section class="flex items-center justify-center px-6 py-12">
      <div class="w-full max-w-md">
        <NuxtLink to="/"
          class="mb-12 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden">
          <ArrowLeft class="size-4" /> Volver al inicio
        </NuxtLink>
        <div class="mb-8">
          <div class="mb-7 flex justify-center lg:hidden">
            <div class="grid size-24 place-items-center rounded-2xl bg-primary">
              <img src="/assets/images/logoBlanco.webp" alt="Brighton" class="h-14 w-auto object-contain" />
            </div>
          </div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Nuevo acceso</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight">Crear cuenta</h2>
          <p class="mt-2 text-muted-foreground">Completa tus datos para comenzar.</p>
        </div>
        <form class="space-y-4" @submit.prevent="handleRegister">
          <div class="space-y-2">
            <UiLabel for="name">Nombre completo</UiLabel>
            <UiInput id="name" v-model="form.name" autocomplete="name" placeholder="Tu nombre completo" required />
          </div>
          <div class="space-y-2">
            <UiLabel for="username">Usuario</UiLabel>
            <UiInput id="username" v-model="form.username" autocomplete="username" placeholder="tu_usuario" required />
          </div>
          <div class="space-y-2">
            <UiLabel for="email">Correo electrónico</UiLabel>
            <UiInput id="email" v-model="form.email" type="email" autocomplete="email" placeholder="tu@email.com"
              required />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <UiLabel for="password">Contraseña</UiLabel>
              <UiInput id="password" v-model="form.password" type="password" autocomplete="new-password"
                placeholder="Mínimo 6 caracteres" minlength="6" required />
            </div>
            <div class="space-y-2">
              <UiLabel for="confirmPassword">Confirmar</UiLabel>
              <UiInput id="confirmPassword" v-model="confirmPassword" type="password" autocomplete="new-password"
                placeholder="Repite tu contraseña" minlength="6" required />
            </div>
          </div>
          <UiAlert v-if="error" variant="destructive">
            <UiAlertDescription>{{ error }}</UiAlertDescription>
          </UiAlert>
          <UiAlert v-if="success">
            <UiAlertDescription>{{ success }}</UiAlertDescription>
          </UiAlert>
          <UiButton class="mt-2 w-full gap-2" size="lg" type="submit" :disabled="loading">
            <LoaderCircle v-if="loading" class="size-4 animate-spin" />{{ loading ? 'Creando cuenta…' : 'Crear cuenta'
            }}
          </UiButton>
        </form>
        <p class="mt-8 text-center text-sm text-muted-foreground">¿Ya tienes cuenta? <NuxtLink to="/login"
            class="font-medium text-foreground underline underline-offset-4">Inicia sesión</NuxtLink>
        </p>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
  import { ArrowLeft, LoaderCircle } from '@lucide/vue'

  definePageMeta({ layout: 'public', middleware: 'guest' })
  const { register } = useAuth()
  const router = useRouter()
  const form = reactive({ name: '', username: '', email: '', password: '' })
  const confirmPassword = ref('')
  const loading = ref(false)
  const error = ref('')
  const success = ref('')

  const handleRegister = async () => {
    if (loading.value) return
    loading.value = true; 
    error.value = ''; 
    success.value = ''
    if (form.password !== confirmPassword.value) { 
      error.value = 'Las contraseñas no coinciden'; 
      loading.value = false; 
      return 
    }
    try {
      const response = await register(form)
      if (response.success) { 
        success.value = 'Cuenta creada. Te llevaremos al inicio de sesión.'; 
        Object.assign(form, { 
          name: '', 
          username: '', 
          email: '', 
          password: '' 
        }); 
        confirmPassword.value = ''; 
        
        window.setTimeout(() => router.push('/login'), 1600) 
      }
      else error.value = response.message
    } catch { 
      error.value = 'No pudimos conectar con el servidor.' 
    } finally { 
      loading.value = false 
    }
  }
</script>
