// https://nuxt.com/docs/api/configuration/nuxt-config (configuración de Nuxt)
import tailwindcss from "@tailwindcss/vite";
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  runtimeConfig: {
    sessionCookieName: process.env.NODE_ENV === 'production' ? '__Host-brighton_session' : 'brighton_session',
    csrfCookieName: 'brighton_csrf',
    sessionTtlHours: 24,
    rememberSessionTtlDays: 30,
    mail: {
      enabled: process.env.MAIL_ENABLED === 'true',
      fromName: process.env.MAIL_FROM_NAME || 'Brighton Inglés Nativo',
      providerUrl: process.env.MAIL_PROVIDER_URL || '',
    },
  },

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  modules: ['shadcn-nuxt'],
})
