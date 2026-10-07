import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts'
  },
  datasource: {
    // `prisma generate` runs while building the image, before runtime
    // environment variables are available. Migrations still use the real
    // DATABASE_URL supplied by EasyPanel when the container starts.
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public'
  }
})
