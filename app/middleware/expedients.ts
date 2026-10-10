export default defineNuxtRouteMiddleware(async () => {
  const { user, verifyToken } = useAuth()

  // La sesión se restaura en el cliente desde una cookie httpOnly.
  if (import.meta.server) return

  if (!user.value && !(await verifyToken())) {
    return navigateTo('/login')
  }

  if (user.value?.role?.name !== 'admin') {
    return navigateTo('/matriculas')
  }
})
