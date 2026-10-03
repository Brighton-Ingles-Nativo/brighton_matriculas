<script setup lang="ts">
import { ArrowUpRight, Check, ShieldCheck, UserRound } from '@lucide/vue'

definePageMeta({ middleware: 'auth', ssr: false })
const { user, hasPermission, verifyToken } = useAuth()

onMounted(async () => { if (!user.value) await verifyToken() })
</script>

<template>
  <div class="min-h-[100dvh] bg-muted/20"><AppHeader title="Dashboard" subtitle="Resumen de tu cuenta y permisos" /><main class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
    <section class="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/10 sm:p-8"><div class="relative z-10 max-w-xl"><p class="text-sm font-medium text-primary-foreground/60">Sesión activa</p><h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Hola, {{ user?.name || 'Usuario' }}.</h1><p class="mt-3 leading-7 text-primary-foreground/70">Tienes acceso al sistema con el rol <span class="font-medium text-primary-foreground">{{ user?.role?.name || 'sin rol' }}</span>.</p></div><ShieldCheck class="absolute -bottom-8 -right-5 size-44 text-primary-foreground/10" /></section>
    <div class="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <UiCard><UiCardHeader><UiCardTitle>Información de la cuenta</UiCardTitle><UiCardDescription>Datos asociados a tu identidad.</UiCardDescription></UiCardHeader><UiCardContent><dl class="grid gap-5 sm:grid-cols-2"><div v-for="item in [{ label: 'Nombre', value: user?.name }, { label: 'Usuario', value: user?.username }, { label: 'Correo', value: user?.email }, { label: 'Rol', value: user?.role?.name }]" :key="item.label"><dt class="text-sm text-muted-foreground">{{ item.label }}</dt><dd class="mt-1 font-medium">{{ item.value || '—' }}</dd></div><div><dt class="text-sm text-muted-foreground">Estado</dt><dd class="mt-1"><UiBadge variant="secondary" class="gap-1"><span class="size-1.5 rounded-full bg-emerald-500" />{{ user?.active ? 'Activo' : 'Inactivo' }}</UiBadge></dd></div><div><dt class="text-sm text-muted-foreground">Correo</dt><dd class="mt-1"><UiBadge :variant="user?.email_verified ? 'secondary' : 'outline'">{{ user?.email_verified ? 'Verificado' : 'Pendiente' }}</UiBadge></dd></div></dl></UiCardContent></UiCard>
      <UiCard><UiCardHeader><UiCardTitle>Accesos disponibles</UiCardTitle><UiCardDescription>Permisos de tu rol actual.</UiCardDescription></UiCardHeader><UiCardContent class="space-y-3"><div v-for="(enabled, permission) in user?.role?.permissions" :key="permission" class="flex items-center justify-between rounded-lg border px-3 py-2.5"><span class="text-sm capitalize">{{ permission }}</span><UiBadge :variant="enabled ? 'default' : 'outline'" class="gap-1"><Check v-if="enabled" class="size-3" />{{ enabled ? 'Permitido' : 'No disponible' }}</UiBadge></div><p v-if="!user?.role?.permissions" class="text-sm text-muted-foreground">No hay permisos configurados.</p></UiCardContent></UiCard>
    </div>
    <UiCard v-if="hasPermission('admin')"><UiCardHeader class="flex-row items-center justify-between"><div><UiCardTitle>Administración</UiCardTitle><UiCardDescription>Gestiona accesos, organización y configuración de la plataforma.</UiCardDescription></div><UiButton variant="outline" size="sm" as-child class="gap-2"><NuxtLink to="/admin">Abrir administración <ArrowUpRight class="size-4" /></NuxtLink></UiButton></UiCardHeader></UiCard>
    <div class="flex items-center justify-between rounded-xl border bg-background px-4 py-3 text-sm text-muted-foreground"><span class="flex items-center gap-2"><UserRound class="size-4" /> ¿Necesitas actualizar tus datos?</span><NuxtLink to="/profile" class="font-medium text-foreground underline underline-offset-4">Ver mi perfil</NuxtLink></div>
  </main></div>
</template>
