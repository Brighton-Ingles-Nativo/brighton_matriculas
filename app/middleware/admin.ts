export default defineNuxtRouteMiddleware(async () => {
  const { user, verifyToken, hasRole, hasPermission } = useAuth()

  // La sesión se restaura en el navegador desde una cookie httpOnly. Durante SSR
  // `user` todavía es null, por lo que no debemos rechazar la ruta antes de que
  // el cliente pueda validar la sesión.
  if (import.meta.server) return

  if (!user.value && !(await verifyToken())) {
    return navigateTo('/login')
  }

  // Verificar si tiene rol de admin o permisos de admin
  if (!hasRole('admin') && !hasPermission('admin')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Acceso denegado: Se requieren permisos de administrador'
    })
  }
})
