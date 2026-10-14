BEGIN;

ALTER TABLE "contratos"
  ADD COLUMN "firmado_acepto" BOOLEAN NOT NULL DEFAULT false;

UPDATE "contratos"
SET "firmado_acepto" = true
WHERE "firmado_at" IS NOT NULL
   OR "estado" = 'FIRMADO';

COMMIT;
