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

Como esta base corresponde al ambiente de desarrollo y sus datos pueden
eliminarse, para reconstruirla completamente desde las migraciones usa:

```bash
pnpm prisma:reset:dev
```

Este comando elimina las tablas, ejecuta las 16 migraciones desde cero y
ejecuta el seed configurado. No se ejecuta automáticamente al iniciar Docker,
porque borraría la base en cada reinicio del contenedor.

En una base existente, no uses `prisma db push`. Primero verifica que la base
ya tenga la estructura representada por las migraciones históricas y registra
el baseline una sola vez:

```bash
pnpm prisma:baseline
pnpm prisma:deploy
```

La migración `20261003100000_normalize_contract_expedient_workflow` transforma
los campos legacy del contrato (`acepto`, `acepto_fecha` y `acepto_ip`) y debe
ejecutarse mediante `prisma migrate deploy`, antes del seed.

Seed inicial (roles, usuario administrador y datos del respaldo legacy):

```bash
pnpm prisma:seed
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

## Docker

Levantar la aplicación y PostgreSQL:

```bash
docker compose up -d --build
```

La aplicación estará disponible en `http://localhost:3000`. En este ambiente
de desarrollo, el servicio `app` reinicia la base al levantarse mediante
`prisma migrate reset --force`: ejecuta las migraciones desde cero y luego el
seed. Esto elimina los datos actuales en cada recreación o reinicio del
contenedor.

Para una base existente que no deba borrarse, no se debe usar este compose;
debe utilizarse `prisma migrate deploy` con un baseline previamente registrado.
Nunca se debe usar `prisma db push --accept-data-loss` sobre datos que deban
conservarse.

El contenedor de la aplicación tiene reinicio automático (`unless-stopped`). La
persistencia y los respaldos de PostgreSQL quedan a cargo del servicio externo
de base de datos.

Para detener los servicios:

```bash
docker compose down
```

Los datos de PostgreSQL se conservan en el volumen `postgres_data`. Para
configurar credenciales, puertos o correo, copiar `.env.example` a `.env` y
ajustar las variables antes de levantar los contenedores.

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
