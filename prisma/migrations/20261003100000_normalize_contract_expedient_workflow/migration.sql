BEGIN;

CREATE TYPE "ContractStatus" AS ENUM ('REVISION', 'FIRMADO', 'ANULADO');
CREATE TYPE "ExpedientStatus" AS ENUM ('CREADO', 'REBOTADO', 'AGENDADO', 'OBSERVADO', 'VERIFICADO');
CREATE TYPE "ExpedientLocation" AS ENUM ('ASESOR', 'SUPERVISOR', 'ASISTENTE_COMERCIAL', 'VERIFICACION');

ALTER TABLE "contratos"
  ADD COLUMN "estado_nuevo" "ContractStatus";

UPDATE "contratos"
SET "estado_nuevo" = CASE
  WHEN "estado" = '-5' THEN 'ANULADO'::"ContractStatus"
  WHEN "acepto" = true THEN 'FIRMADO'::"ContractStatus"
  ELSE 'REVISION'::"ContractStatus"
END;

ALTER TABLE "contratos" DROP COLUMN "estado";
ALTER TABLE "contratos" RENAME COLUMN "estado_nuevo" TO "estado";
ALTER TABLE "contratos" RENAME COLUMN "acepto_fecha" TO "firmado_at";
ALTER TABLE "contratos" RENAME COLUMN "acepto_ip" TO "firmado_ip";
ALTER TABLE "contratos" DROP COLUMN "acepto";

ALTER TABLE "contratos"
  ALTER COLUMN "estado" SET NOT NULL,
  ALTER COLUMN "estado" SET DEFAULT 'REVISION'::"ContractStatus";

ALTER TABLE "expedientes"
  ADD COLUMN "estado_nuevo" "ExpedientStatus",
  ADD COLUMN "ubicacion_actual" "ExpedientLocation",
  ADD COLUMN "responsable_id" UUID,
  ADD COLUMN "primer_contacto_at" TIMESTAMP(3),
  ADD COLUMN "estrategia_confirmada" BOOLEAN,
  ADD COLUMN "estrategia_observacion" TEXT,
  ADD COLUMN "asesor_validacion_confirmado" BOOLEAN,
  ADD COLUMN "asesor_validacion_nombre" VARCHAR(200),
  ADD COLUMN "inicio_clases_at" TIMESTAMP(3),
  ADD COLUMN "fecha_pago" TIMESTAMP(3);

UPDATE "expedientes"
SET
  "estado_nuevo" = CASE "status"
    WHEN 'REBOTADO_COMERCIAL' THEN 'REBOTADO'::"ExpedientStatus"
    WHEN 'REBOTADO_VERIFICACION' THEN 'REBOTADO'::"ExpedientStatus"
    WHEN 'CITA_PROGRAMADA' THEN 'AGENDADO'::"ExpedientStatus"
    WHEN 'VERIFICADA_CON_OBSERVACIONES' THEN 'OBSERVADO'::"ExpedientStatus"
    WHEN 'VERIFICADA' THEN 'VERIFICADO'::"ExpedientStatus"
    ELSE 'CREADO'::"ExpedientStatus"
  END,
  "ubicacion_actual" = CASE "status"
    WHEN 'EN_COMERCIAL' THEN 'ASISTENTE_COMERCIAL'::"ExpedientLocation"
    WHEN 'EN_VERIFICACION' THEN 'VERIFICACION'::"ExpedientLocation"
    WHEN 'REBOTADO_VERIFICACION' THEN 'ASISTENTE_COMERCIAL'::"ExpedientLocation"
    WHEN 'REBOTADO_COMERCIAL' THEN 'ASESOR'::"ExpedientLocation"
    ELSE 'ASESOR'::"ExpedientLocation"
  END;

ALTER TABLE "expedientes" DROP COLUMN "status";
ALTER TABLE "expedientes" RENAME COLUMN "estado_nuevo" TO "status";

ALTER TABLE "expedientes"
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'CREADO'::"ExpedientStatus",
  ALTER COLUMN "ubicacion_actual" SET NOT NULL;

CREATE TABLE "expediente_movimientos" (
  "id" UUID NOT NULL,
  "expediente_id" UUID NOT NULL,
  "estado_anterior" "ExpedientStatus",
  "estado_nuevo" "ExpedientStatus",
  "ubicacion_anterior" "ExpedientLocation",
  "ubicacion_nueva" "ExpedientLocation",
  "usuario_id" UUID NOT NULL,
  "observation" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "expediente_movimientos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expediente_movimientos_expediente_id_created_at_idx"
  ON "expediente_movimientos"("expediente_id", "created_at");

CREATE INDEX "expedientes_responsable_id_idx"
  ON "expedientes"("responsable_id");

ALTER TABLE "expedientes"
  ADD CONSTRAINT "expedientes_responsable_id_fkey"
  FOREIGN KEY ("responsable_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expediente_movimientos"
  ADD CONSTRAINT "expediente_movimientos_expediente_id_fkey"
  FOREIGN KEY ("expediente_id") REFERENCES "expedientes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "expediente_movimientos_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
