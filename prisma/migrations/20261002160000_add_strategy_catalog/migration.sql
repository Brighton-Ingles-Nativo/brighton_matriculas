CREATE TABLE IF NOT EXISTS "estrategias" (
  "id" UUID NOT NULL,
  "code" VARCHAR(50),
  "name" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  CONSTRAINT "estrategias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "estrategias_code_key" ON "estrategias"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "estrategias_name_key" ON "estrategias"("name");
CREATE INDEX IF NOT EXISTS "estrategias_active_orden_idx" ON "estrategias"("active", "orden");
CREATE INDEX IF NOT EXISTS "estrategias_created_by_id_idx" ON "estrategias"("created_by_id");
CREATE INDEX IF NOT EXISTS "estrategias_updated_by_id_idx" ON "estrategias"("updated_by_id");

ALTER TABLE "contratos"
  ADD COLUMN IF NOT EXISTS "estrategia_id" UUID,
  ADD COLUMN IF NOT EXISTS "estrategia_nombre" VARCHAR(150);

CREATE INDEX IF NOT EXISTS "contratos_estrategia_id_idx" ON "contratos"("estrategia_id");

-- Conserva las estrategias ya registradas como catálogo inicial e historiza el nombre
-- de cada matrícula sin depender de futuras ediciones del catálogo.
INSERT INTO "estrategias" ("id", "name", "active", "orden", "created_at", "updated_at")
SELECT md5(random()::text || clock_timestamp()::text || legacy."name")::uuid, legacy."name", true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT btrim("estrategia") AS "name"
  FROM "contratos_otros_datos"
  WHERE btrim(coalesce("estrategia", '')) <> ''
) AS legacy
WHERE NOT EXISTS (
  SELECT 1 FROM "estrategias" AS strategy WHERE strategy."name" = legacy."name"
);

UPDATE "contratos" AS contract
SET
  "estrategia_id" = strategy."id",
  "estrategia_nombre" = strategy."name"
FROM "contratos_otros_datos" AS legacy
INNER JOIN "estrategias" AS strategy ON strategy."name" = btrim(legacy."estrategia")
WHERE contract."id" = legacy."contrato_id"
  AND contract."estrategia_id" IS NULL
  AND btrim(coalesce(legacy."estrategia", '')) <> '';

DO $$ BEGIN
  ALTER TABLE "estrategias" ADD CONSTRAINT "estrategias_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "estrategias" ADD CONSTRAINT "estrategias_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "contratos" ADD CONSTRAINT "contratos_estrategia_id_fkey" FOREIGN KEY ("estrategia_id") REFERENCES "estrategias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
