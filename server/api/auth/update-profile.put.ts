import type { UpdateProfileRequest, AuthResponse } from '~/shared/types/auth'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../utils/prisma'
import { assertCsrf, getUserBySession, parsePermissions } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  try {
    const currentUser = await getUserBySession(event)

    if (!currentUser) {
      return {
        success: false,
        message: 'Sesión inválida o expirada'
      } as AuthResponse
    }

    const body = await readBody<UpdateProfileRequest>(event)

    // Validaciones básicas
    if (!body.username && !body.email && !body.name && !body.pic_user) {
      return {
        success: false,
        message: 'Debe proporcionar al menos un campo para actualizar'
      } as AuthResponse
    }

    // Validar formato de email si se proporciona
    if (body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.email)) {
        return {
          success: false,
          message: 'Formato de email inválido'
        } as AuthResponse
      }
    }

    // Verificar si el username o email ya existen (excluyendo el usuario actual)
    if (body.username || body.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          NOT: { id: currentUser.id },
          OR: [
            ...(body.username ? [{ username: body.username }] : []),
            ...(body.email ? [{ email: body.email }] : [])
          ]
        }
      })

      if (existingUser) {
        return {
          success: false,
          message: 'El usuario o email ya existe'
        } as AuthResponse
      }
    }

    // Construir query de actualización dinámicamente
    const data: Prisma.UserUpdateInput = {}

    if (body.username) {
      data.username = body.username
    }

    if (body.email) {
      data.email = body.email
    }

    if (body.name) {
      data.name = body.name
    }

    if (body.pic_user !== undefined) {
      data.picUser = body.pic_user
    }

    await prisma.user.update({ where: { id: currentUser.id }, data })

    // Obtener usuario actualizado con rol
    const updatedUser = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { role: true }
    })

    if (!updatedUser) {
      return {
        success: false,
        message: 'No se pudo recuperar el perfil actualizado'
      } as AuthResponse
    }

    const userResponse = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      name: updatedUser.name,
      pic_user: updatedUser.picUser ?? undefined,
      active: updatedUser.active,
      email_verified: updatedUser.emailVerified,
      role_id: updatedUser.roleId,
      created_at: updatedUser.createdAt,
      updated_at: updatedUser.updatedAt,
      role: {
        id: updatedUser.role.id,
        name: updatedUser.role.name,
        permissions: parsePermissions(updatedUser.role.permissions),
        created_at: updatedUser.role.createdAt
      }
    }

    return {
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: userResponse
    } as AuthResponse

  } catch (error) {
    console.error('Error actualizando perfil:', error)
    return {
      success: false,
      message: 'Error interno del servidor'
    } as AuthResponse
  }
})
