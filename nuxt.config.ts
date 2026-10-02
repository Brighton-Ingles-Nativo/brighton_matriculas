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
      from: process.env.MAIL_FROM || '',
      fromName: process.env.MAIL_FROM_NAME || 'Brighton Inglés Nativo',
    },
    expedientUploadDir: process.env.EXPEDIENT_UPLOAD_DIR || '.data/expedients',
  },

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  modules: ['shadcn-nuxt'],
})
