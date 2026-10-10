<script setup lang="ts">
import { ArrowUpRight, Building2, Settings2, ShieldCheck } from '@lucide/vue'

definePageMeta({ middleware: ['auth', 'admin'] })

const sections = [
  {
    title: 'Accesos',
    description: 'Gestiona usuarios, roles, permisos y sesiones activas.',
    detail: 'Usuarios · Roles y permisos · Sesiones',
    to: '/admin/accesos/usuarios',
    icon: ShieldCheck
  },
  {
    title: 'Organización',
    description: 'Define la estructura comercial y sus responsables.',
    detail: 'Sedes · Equipos · Supervisión',
    to: '/admin/organizacion/sedes',
    icon: Building2
  },
  {
    title: 'Configuración',
    description: 'Centraliza los catálogos y parámetros de operación.',
    detail: 'Estrategias · Notificaciones · Parámetros',
    to: '/admin/configuracion',
    icon: Settings2
  }
]
</script>

<template>
  <div class="min-h-[100dvh] bg-muted/20">
    <AppHeader title="Administración" subtitle="Control de accesos, estructura y configuración" back-to="/dashboard" />
    <main class="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <section class="max-w-2xl">
        <h1 class="text-3xl font-semibold tracking-tight">Administración de la plataforma</h1>
        <p class="mt-2 leading-7 text-muted-foreground">Elige el espacio de trabajo según el tipo de cambio que necesitas realizar.</p>
      </section>

      <section aria-label="Áreas de administración" class="overflow-hidden rounded-xl border bg-card">
        <NuxtLink
          v-for="section in sections"
          :key="section.title"
          :to="section.to"
          class="group grid gap-4 px-5 py-5 transition-colors hover:bg-muted/60 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:items-center sm:gap-5"
        >
          <span class="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
            <component :is="section.icon" class="size-5" aria-hidden="true" />
          </span>
          <span class="min-w-0">
            <span class="block font-semibold text-foreground">{{ section.title }}</span>
            <span class="mt-1 block text-sm leading-6 text-muted-foreground">{{ section.description }}</span>
            <span class="mt-2 block text-xs font-medium text-muted-foreground">{{ section.detail }}</span>
          </span>
          <ArrowUpRight class="size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
        </NuxtLink>
      </section>

      <p class="text-sm text-muted-foreground">Los cambios realizados en estas áreas están restringidos a administradores.</p>
    </main>
  </div>
</template>
