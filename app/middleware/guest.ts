export default defineNuxtRouteMiddleware(async () => {
  const { isLoggedIn, verifyToken } = useAuth()

  if (import.meta.server) return

  if (!isLoggedIn.value && import.meta.client) await verifyToken()

  if (isLoggedIn.value) return navigateTo('/dashboard')
})
