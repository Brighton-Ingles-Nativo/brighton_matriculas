import { defineConfig } from 'prisma/config'

// Prisma config files do not load `.env` automatically. Load it for local CLI
// commands while preserving environment variables supplied by the runtime.
try {
  process.loadEnvFile()
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}

const datasourceUrl = process.env.DATABASE_URL

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts'
  },
  ...(datasourceUrl ? { datasource: { url: datasourceUrl } } : {})
})
