export default defineNuxtRouteMiddleware(async () => {
  const { user, verifyToken } = useAuth()

  // La sesión se restaura en el cliente desde una cookie httpOnly.
  if (import.meta.server) return

  if (!user.value && !(await verifyToken())) {
    return navigateTo('/login')
  }

  //const allowedRoles = ['admin', 'asesor', 'supervisor', 'asistente_comercial', 'verificador']
  const allowedRoles = ['admin']
  if (!allowedRoles.includes(user.value?.role?.name || '')) {
    return navigateTo('/matriculas')
  }
})
