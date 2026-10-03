-- CreateEnum
CREATE TYPE "modalidad_equipo" AS ENUM ('PRESENCIAL', 'VIRTUAL');

-- CreateTable
CREATE TABLE "sedes" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipos" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "modalidad" "modalidad_equipo" NOT NULL,
    "sede_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sedes_supervisores" (
    "id" UUID NOT NULL,
    "sede_id" UUID NOT NULL,
    "supervisor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sedes_supervisores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipos_supervisores" (
    "id" UUID NOT NULL,
    "equipo_id" UUID NOT NULL,
    "supervisor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipos_supervisores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sedes_name_key" ON "sedes"("name");
CREATE UNIQUE INDEX "equipos_name_key" ON "equipos"("name");
CREATE INDEX "equipos_sede_id_idx" ON "equipos"("sede_id");
CREATE UNIQUE INDEX "sedes_supervisores_sede_id_supervisor_id_key" ON "sedes_supervisores"("sede_id", "supervisor_id");
CREATE INDEX "sedes_supervisores_supervisor_id_idx" ON "sedes_supervisores"("supervisor_id");
CREATE UNIQUE INDEX "equipos_supervisores_equipo_id_supervisor_id_key" ON "equipos_supervisores"("equipo_id", "supervisor_id");
CREATE INDEX "equipos_supervisores_supervisor_id_idx" ON "equipos_supervisores"("supervisor_id");

-- AlterTable
ALTER TABLE "users" ADD COLUMN "supervisor_id" UUID;
CREATE INDEX "users_supervisor_id_idx" ON "users"("supervisor_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sedes_supervisores" ADD CONSTRAINT "sedes_supervisores_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sedes_supervisores" ADD CONSTRAINT "sedes_supervisores_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipos_supervisores" ADD CONSTRAINT "equipos_supervisores_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipos_supervisores" ADD CONSTRAINT "equipos_supervisores_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
