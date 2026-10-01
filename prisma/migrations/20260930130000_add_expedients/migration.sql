CREATE TABLE "expedientes" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "enviado_comercial_at" TIMESTAMP(3),
    "enviado_verificacion_at" TIMESTAMP(3),
    "verificado_at" TIMESTAMP(3),
    CONSTRAINT "expedientes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expediente_documentos" (
    "id" UUID NOT NULL,
    "expediente_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "nombre_archivo" VARCHAR(255) NOT NULL,
    "ruta_archivo" VARCHAR(500) NOT NULL,
    "tipo_mime" VARCHAR(100) NOT NULL,
    "tamano_archivo" INTEGER,
    "cargado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expediente_documentos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "expedientes_contrato_id_key" ON "expedientes"("contrato_id");
CREATE INDEX "expedientes_status_idx" ON "expedientes"("status");
CREATE INDEX "expediente_documentos_expediente_id_idx" ON "expediente_documentos"("expediente_id");

ALTER TABLE "expedientes"
  ADD CONSTRAINT "expedientes_contrato_id_fkey"
  FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expediente_documentos"
  ADD CONSTRAINT "expediente_documentos_expediente_id_fkey"
  FOREIGN KEY ("expediente_id") REFERENCES "expedientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
