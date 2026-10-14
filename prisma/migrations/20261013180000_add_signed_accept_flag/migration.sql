BEGIN;

DO $$
DECLARE
  status_labels TEXT[];
  signed_flag_added BOOLEAN := false;
BEGIN
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
  INTO status_labels
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE n.nspname = 'public'
    AND t.typname = 'ContractStatus';

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contratos'
      AND column_name = 'firmado_acepto'
  ) THEN
    ALTER TABLE "contratos"
      ADD COLUMN "firmado_acepto" BOOLEAN NOT NULL DEFAULT false;
    signed_flag_added := true;
  END IF;

  -- Backfill only when creating the flag. Do not overwrite existing flag data.
  IF signed_flag_added THEN
    IF status_labels @> ARRAY['FIRMADO']::TEXT[] THEN
      UPDATE "contratos"
      SET "firmado_acepto" = true
      WHERE "firmado_at" IS NOT NULL
         OR "estado"::text = 'FIRMADO';
    ELSE
      UPDATE "contratos"
      SET "firmado_acepto" = true
      WHERE "firmado_at" IS NOT NULL;
    END IF;
  END IF;

  -- The target enum is already correct: leave estado values and type untouched.
  IF status_labels IS NULL OR NOT (
    status_labels @> ARRAY['REVISION', 'APROBADO', 'ANULADO']::TEXT[]
    AND status_labels <@ ARRAY['REVISION', 'APROBADO', 'ANULADO']::TEXT[]
  ) THEN
    IF status_labels IS NULL OR NOT (
      status_labels @> ARRAY['REVISION', 'FIRMADO', 'ANULADO']::TEXT[]
      AND status_labels <@ ARRAY['REVISION', 'FIRMADO', 'ANULADO']::TEXT[]
    ) THEN
      RAISE EXCEPTION 'Unexpected ContractStatus labels: %', status_labels;
    END IF;

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
