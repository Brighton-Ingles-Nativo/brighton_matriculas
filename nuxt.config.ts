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
    awsRegion: process.env.AWS_REGION || '',
    awsBucketName: process.env.AWS_BUCKET_NAME || '',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  modules: ['shadcn-nuxt'],
})
