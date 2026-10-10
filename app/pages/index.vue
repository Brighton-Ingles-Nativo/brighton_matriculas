<script setup lang="ts">
import { ArrowRight, Check, LockKeyhole, ShieldCheck, UserRound } from '@lucide/vue'

definePageMeta({ layout: 'public' })

const { user, isLoggedIn, logout } = useAuth()
const router = useRouter()
router.push('/login')

const handleLogout = async () => {
  await logout()
  await router.push('/')
}
</script>

<template>
  <main class="relative min-h-[100dvh] overflow-hidden bg-background">
    <div class="pointer-events-none absolute -right-40 -top-40 size-[28rem] rounded-full bg-primary/5 blur-3xl" />
    <div class="relative mx-auto grid min-h-[100dvh] max-w-7xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
      <section class="max-w-2xl">
        <div class="mb-8 flex items-center gap-3 text-sm font-medium text-muted-foreground"><span class="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck class="size-5" /></span> Brighton / Identity</div>
        <p class="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-primary">Acceso seguro</p>
        <h1 class="max-w-xl text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-6xl">Una entrada clara para todo tu sistema.</h1>
        <p class="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">Gestiona tu acceso, perfil y permisos desde una experiencia sencilla y preparada para crecer.</p>
        <div class="mt-10 flex flex-wrap gap-3">
          <template v-if="isLoggedIn">
            <UiButton size="lg" as-child class="gap-2"><NuxtLink to="/matriculas">Ver matrículas <ArrowRight class="size-4" /></NuxtLink></UiButton>
            <UiButton variant="outline" size="lg" @click="handleLogout">Cerrar sesión</UiButton>
          </template>
          <template v-else>
            <UiButton size="lg" as-child class="gap-2"><NuxtLink to="/login">Iniciar sesión <ArrowRight class="size-4" /></NuxtLink></UiButton>
            <UiButton variant="outline" size="lg" as-child><NuxtLink to="/register">Crear cuenta</NuxtLink></UiButton>
          </template>
        </div>
      </section>
      <section class="lg:justify-self-end">
        <UiCard class="relative w-full max-w-md overflow-hidden shadow-xl shadow-primary/5">
          <UiCardHeader class="border-b bg-muted/30 pb-5"><div class="flex items-center justify-between"><div><UiCardTitle class="text-xl">Control de acceso</UiCardTitle><UiCardDescription class="mt-1">Protección integrada desde el primer día.</UiCardDescription></div><LockKeyhole class="size-5 text-primary" /></div></UiCardHeader>
          <UiCardContent class="space-y-5 pt-6"><div v-for="item in ['Sesiones opacas con cookies seguras', 'Roles y permisos centralizados', 'PostgreSQL + Prisma + TypeScript']" :key="item" class="flex items-start gap-3"><span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Check class="size-3.5" /></span><span class="text-sm leading-6 text-muted-foreground">{{ item }}</span></div></UiCardContent>
          <UiCardFooter class="border-t bg-muted/20 py-4 text-xs text-muted-foreground"><UserRound class="mr-2 size-3.5" /> Tu cuenta, tus permisos, tu control.</UiCardFooter>
        </UiCard>
      </section>
    </div>
  </main>
</template>
