ALTER TABLE "expedientes"
  ADD COLUMN IF NOT EXISTS "observacion" TEXT,
  ADD COLUMN IF NOT EXISTS "observacion_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "observacion_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "cita_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cita_reprogramada_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tipo_cita" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "calificacion_asesoria" INTEGER;

CREATE TABLE IF NOT EXISTS "solicitudes_anulacion" (
  "id" UUID NOT NULL,
  "contrato_id" UUID NOT NULL,
  "solicitado_por" UUID NOT NULL,
  "revisado_por" UUID,
  "reason" TEXT NOT NULL,
  "observacion_revision" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revisado_at" TIMESTAMP(3),
  CONSTRAINT "solicitudes_anulacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "solicitudes_anulacion_contrato_id_key" ON "solicitudes_anulacion"("contrato_id");
CREATE INDEX IF NOT EXISTS "solicitudes_anulacion_status_created_at_idx" ON "solicitudes_anulacion"("status", "created_at");
CREATE INDEX IF NOT EXISTS "solicitudes_anulacion_solicitado_por_idx" ON "solicitudes_anulacion"("solicitado_por");
CREATE INDEX IF NOT EXISTS "expedientes_observacion_by_id_idx" ON "expedientes"("observacion_by_id");

DO $$ BEGIN
  ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_observacion_by_id_fkey" FOREIGN KEY ("observacion_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "solicitudes_anulacion" ADD CONSTRAINT "solicitudes_anulacion_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "solicitudes_anulacion" ADD CONSTRAINT "solicitudes_anulacion_solicitado_por_fkey" FOREIGN KEY ("solicitado_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "solicitudes_anulacion" ADD CONSTRAINT "solicitudes_anulacion_revisado_por_fkey" FOREIGN KEY ("revisado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
