export default defineNuxtRouteMiddleware(() => {
  const { user, hasRole, hasPermission } = useAuth()
  
  // Verificar si tiene rol de admin o permisos de admin
  if (!hasRole('admin') && !hasPermission('admin')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Acceso denegado: Se requieren permisos de administrador'
    })
  }
})