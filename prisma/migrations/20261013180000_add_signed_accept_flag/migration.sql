BEGIN;

ALTER TABLE "contratos"
  ADD COLUMN IF NOT EXISTS "firmado_acepto" BOOLEAN NOT NULL DEFAULT false;

UPDATE "contratos"
SET "firmado_acepto" = true
WHERE "firmado_at" IS NOT NULL
   OR "estado"::text IN ('FIRMADO', 'APROBADO');

-- Producción puede haber recibido manualmente el cambio de enum antes de que
-- Prisma aplique esta migración. Convierte FIRMADO a APROBADO solo si aún falta.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ContractStatus'
      AND e.enumlabel = 'FIRMADO'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ContractStatus'
      AND e.enumlabel = 'APROBADO'
  ) THEN
    ALTER TABLE "contratos" ALTER COLUMN "estado" DROP DEFAULT;

    CREATE TYPE "ContractStatus_nuevo" AS ENUM (
      'REVISION',
      'APROBADO',
      'ANULADO'
    );

    ALTER TABLE "contratos"
      ALTER COLUMN "estado" TYPE "ContractStatus_nuevo"
      USING (
        CASE "estado"::text
          WHEN 'FIRMADO' THEN 'APROBADO'
          ELSE "estado"::text
        END
      )::"ContractStatus_nuevo";

    DROP TYPE "ContractStatus";
    ALTER TYPE "ContractStatus_nuevo" RENAME TO "ContractStatus";

    ALTER TABLE "contratos"
      ALTER COLUMN "estado" SET DEFAULT 'REVISION'::"ContractStatus";
  END IF;
END $$;

COMMIT;
