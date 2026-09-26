-- CreateTable
CREATE TABLE "contratos" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "fecha_registro" TIMESTAMP(3) NOT NULL,
    "contrato_dep" VARCHAR(100),
    "contrato_prov" VARCHAR(100),
    "contrato_dist" VARCHAR(100),
    "nro_contrato" VARCHAR(20) NOT NULL,
    "titular_nombre" VARCHAR(200) NOT NULL,
    "titular_fecha_nacimiento" DATE NOT NULL,
    "titular_dni" VARCHAR(20) NOT NULL,
    "titular_email" VARCHAR(100) NOT NULL,
    "titular_direccion" VARCHAR(250) NOT NULL,
    "titular_dep" VARCHAR(100),
    "titular_prov" VARCHAR(100),
    "titular_dist" VARCHAR(100),
    "titular_celular" VARCHAR(20) NOT NULL,
    "beneficiario1_nombre" VARCHAR(200),
    "beneficiario1_fecha_nacimiento" DATE,
    "beneficiario1_dni" VARCHAR(20),
    "beneficiario1_email" VARCHAR(100),
    "beneficiario1_celular" VARCHAR(20),
    "beneficiario2_nombre" VARCHAR(200),
    "beneficiario2_fecha_nacimiento" DATE,
    "beneficiario2_dni" VARCHAR(20),
    "beneficiario2_email" VARCHAR(100),
    "beneficiario2_celular" VARCHAR(20),
    "situacion_actual" VARCHAR(20) NOT NULL,
    "tipo_vivienda" VARCHAR(20) NOT NULL,
    "autorizacion_datos" BOOLEAN NOT NULL DEFAULT false,
    "acepto" BOOLEAN NOT NULL DEFAULT false,
    "strategy" VARCHAR(50) NOT NULL,
    "fecha_inicio_pago" VARCHAR(20),
    "modality" VARCHAR(20),
    "program" VARCHAR(20) NOT NULL,
    "plan" VARCHAR(50),
    "modalidad_contado" BOOLEAN NOT NULL DEFAULT false,
    "modalidad_financiado" BOOLEAN NOT NULL DEFAULT false,
    "valor_programa" DECIMAL(10,2) NOT NULL,
    "cuota_inicial" DECIMAL(10,2) DEFAULT 0,
    "balance" DECIMAL(10,2),
    "nro_cuotas" INTEGER,
    "valor_cuota" DECIMAL(10,2),
    "otro_pago" VARCHAR(100),
    "observaciones" TEXT,
    "status" VARCHAR(50),
    "testimonials" BOOLEAN NOT NULL DEFAULT false,
    "uso_datos" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "acepto_fecha" TIMESTAMP(3),
    "acepto_ip" VARCHAR(45),
    "access_token" VARCHAR(64),
    "token_expiration" TIMESTAMP(3),

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recibos" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "rol_registro" VARCHAR(20),
    "cuota_inicial" DECIMAL(10,2),
    "concepts" VARCHAR(255),
    "otros_concepto" VARCHAR(255),
    "forma_pago" VARCHAR(50),
    "nro_operacion" VARCHAR(50),
    "bank" VARCHAR(50),
    "fecha_transaccion" DATE,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recibos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contratos_nro_contrato_key" ON "contratos"("nro_contrato");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_access_token_key" ON "contratos"("access_token");

-- CreateIndex
CREATE INDEX "contratos_usuario_id_idx" ON "contratos"("usuario_id");

-- CreateIndex
CREATE INDEX "contratos_token_expiration_idx" ON "contratos"("token_expiration");

-- CreateIndex
CREATE INDEX "recibos_contrato_id_idx" ON "recibos"("contrato_id");

-- CreateIndex
CREATE INDEX "recibos_usuario_id_idx" ON "recibos"("usuario_id");

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos" ADD CONSTRAINT "recibos_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos" ADD CONSTRAINT "recibos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
