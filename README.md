# Brighton — Plataforma de Matrículas

Sistema de gestión de matrículas para Brighton Inglés Nativo. Reescritura completa del sistema legado en PHP a un stack moderno con Nuxt 4, Vue 3 y Prisma.

## Stack

- **Framework:** Nuxt 4 + Vue 3 (TypeScript)
- **UI:** Tailwind CSS v4 + shadcn-nuxt (Reka UI)
- **ORM:** Prisma con PostgreSQL
- **Auth:** Sesiones por hash almacenadas en BD, middleware de roles
- **Package manager:** pnpm

## Módulos

- **Auth** — login, registro, logout, perfil, cambio de contraseña, CSRF
- **Matrículas** — listado, creación, edición, detalle de contrato
- **Recibos** — listado, creación, vista individual
- **Vista pública** — contrato accesible por token temporal sin login
- **Admin** — gestión de usuarios, roles y sesiones activas
- **Exportación** — descarga de contratos en CSV
- **Integraciones** — consulta de DNI (DNI Perú) y búsqueda de RUC

## Requisitos

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 14

## Setup

Instalar dependencias:

```bash
pnpm install
```

Configurar variables de entorno:

```bash
cp .env.example .env
```

Editar `.env` con la URL de tu base de datos:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/brighton?schema=public"
```

Ejecutar migraciones y generar cliente Prisma:

```bash
pnpm prisma:migrate
pnpm prisma:generate
```

Seed inicial (roles y usuario administrador):

```bash
pnpm dlx prisma db seed
```

## Desarrollo

```bash
pnpm dev -o
```

La aplicación corre en `http://localhost:3000`.

## Producción

Build:

```bash
pnpm build
```

Preview local del build:

```bash
pnpm preview
```

## Variables de entorno

| Variable          | Descripción                              | Default                     |
|-------------------|------------------------------------------|-----------------------------|
| `DATABASE_URL`    | Cadena de conexión PostgreSQL            | —                           |
| `MAIL_ENABLED`    | Habilitar envío de correos (`true/false`)| `false`                     |
| `MAIL_FROM`       | Dirección remitente                      | —                           |
| `MAIL_FROM_NAME`  | Nombre remitente                         | `Brighton Inglés Nativo`    |

## Estructura del proyecto

```
app/
├── components/     # Componentes Vue (UI shadcn + propios)
├── composables/    # useAuth, useTheme
├── layouts/        # default (autenticado), public
├── middleware/     # auth, guest, admin
├── pages/          # Rutas de la aplicación
│   ├── matricula/  # Lista, nueva, detalle
│   ├── recibo/     # Vista individual, nueva
│   ├── contrato/   # Vista pública
│   └── ...
├── plugins/        # auth.client
└── shared/types/   # Tipos TypeScript compartidos

server/
├── api/
│   ├── auth/       # login, logout, me, register, profile
│   ├── contracts/  # CRUD de matrículas + exportación
│   ├── receipts/   # CRUD de recibos
│   ├── admin/      # Usuarios, roles, sesiones
│   └── public/     # Endpoints sin autenticación
└── utils/          # prisma, auth, mailer, DNI/RUC

prisma/
├── schema.prisma   # Modelos: Role, User, UserSession, Contract, Receipt
├── migrations/     # 5 migraciones aplicadas
└── seed.ts         # Datos iniciales
```
