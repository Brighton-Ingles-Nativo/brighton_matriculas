/*
  Warnings:

  - You are about to drop the column `autorizacion_datos` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `beneficiario1_celular` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `beneficiario1_dni` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `beneficiario1_email` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `beneficiario1_fecha_nacimiento` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `beneficiario1_nombre` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `beneficiario2_celular` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `beneficiario2_dni` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `beneficiario2_email` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `beneficiario2_fecha_nacimiento` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `beneficiario2_nombre` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `estrategia` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `observaciones` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `situacion_actual` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `testimonios` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `tipo_vivienda` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `titular_celular` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `titular_dep` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `titular_direccion` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `titular_dist` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `titular_dni` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `titular_email` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `titular_fecha_nacimiento` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `titular_nombre` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `titular_prov` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `uso_datos` on the `contratos` table. All the data in the column will be lost.
  - Added the required column `cliente_id` to the `contratos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "contratos" DROP COLUMN "autorizacion_datos",
DROP COLUMN "beneficiario1_celular",
DROP COLUMN "beneficiario1_dni",
DROP COLUMN "beneficiario1_email",
DROP COLUMN "beneficiario1_fecha_nacimiento",
DROP COLUMN "beneficiario1_nombre",
DROP COLUMN "beneficiario2_celular",
DROP COLUMN "beneficiario2_dni",
DROP COLUMN "beneficiario2_email",
DROP COLUMN "beneficiario2_fecha_nacimiento",
DROP COLUMN "beneficiario2_nombre",
DROP COLUMN "estrategia",
DROP COLUMN "observaciones",
DROP COLUMN "situacion_actual",
DROP COLUMN "testimonios",
DROP COLUMN "tipo_vivienda",
DROP COLUMN "titular_celular",
DROP COLUMN "titular_dep",
DROP COLUMN "titular_direccion",
DROP COLUMN "titular_dist",
DROP COLUMN "titular_dni",
DROP COLUMN "titular_email",
DROP COLUMN "titular_fecha_nacimiento",
DROP COLUMN "titular_nombre",
DROP COLUMN "titular_prov",
DROP COLUMN "uso_datos",
ADD COLUMN     "cliente_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "titular_nombre" VARCHAR(200) NOT NULL,
    "titular_fecha_nacimiento" DATE NOT NULL,
    "titular_dni" VARCHAR(20) NOT NULL,
    "titular_email" VARCHAR(100) NOT NULL,
    "titular_direccion" VARCHAR(250) NOT NULL,
    "titular_dep" VARCHAR(100),
    "titular_prov" VARCHAR(100),
    "titular_dist" VARCHAR(100),
    "titular_celular" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumnos" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "fecha_nacimiento" DATE,
    "dni" VARCHAR(20),
    "email" VARCHAR(100),
    "celular" VARCHAR(20),

    CONSTRAINT "alumnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos_alumnos" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "alumno_id" UUID NOT NULL,

    CONSTRAINT "contratos_alumnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos_otros_datos" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "situacion_actual" VARCHAR(20) NOT NULL,
    "tipo_vivienda" VARCHAR(20) NOT NULL,
    "autorizacion_datos" BOOLEAN NOT NULL DEFAULT false,
    "estrategia" VARCHAR(50) NOT NULL,
    "observaciones" TEXT,
    "testimonios" BOOLEAN NOT NULL DEFAULT false,
    "uso_datos" BOOLEAN,

    CONSTRAINT "contratos_otros_datos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clientes_usuario_id_idx" ON "clientes"("usuario_id");

-- CreateIndex
CREATE INDEX "clientes_titular_dni_idx" ON "clientes"("titular_dni");

-- CreateIndex
CREATE INDEX "alumnos_cliente_id_idx" ON "alumnos"("cliente_id");

-- CreateIndex
CREATE INDEX "alumnos_dni_idx" ON "alumnos"("dni");

-- CreateIndex
CREATE INDEX "contratos_alumnos_alumno_id_idx" ON "contratos_alumnos"("alumno_id");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_alumnos_contrato_id_alumno_id_key" ON "contratos_alumnos"("contrato_id", "alumno_id");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_otros_datos_contrato_id_key" ON "contratos_otros_datos"("contrato_id");

-- CreateIndex
CREATE INDEX "contratos_cliente_id_idx" ON "contratos"("cliente_id");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_alumnos" ADD CONSTRAINT "contratos_alumnos_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_alumnos" ADD CONSTRAINT "contratos_alumnos_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_otros_datos" ADD CONSTRAINT "contratos_otros_datos_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
