export default defineNuxtRouteMiddleware(async () => {
  const { user, verifyToken } = useAuth()

  if (user.value) return

  // /matriculas se renderiza en el cliente. Durante un hard refresh, Nuxt puede ejecutar
  // este middleware en el servidor antes de que el cliente haya restaurado el estado de auth.
  // Se deja que el cliente valide la cookie de sesión httpOnly en lugar de redirigir
  // prematuramente a /login.
  if (import.meta.server) return

  // El plugin de auth puede estar restaurando la sesión cuando empieza la navegación.
  // Se valida aquí antes de redirigir; de lo contrario podría ocurrir /matriculas -> /login -> /dashboard
  // aunque la cookie de sesión sea válida.
  if (import.meta.client && await verifyToken()) return

  return navigateTo('/login')
})
