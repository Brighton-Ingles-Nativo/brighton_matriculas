-- CreateTable
CREATE TABLE "equipos_usuarios" (
    "id" UUID NOT NULL,
    "equipo_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipos_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipos_usuarios_equipo_id_usuario_id_key" ON "equipos_usuarios"("equipo_id", "usuario_id");
CREATE INDEX "equipos_usuarios_usuario_id_idx" ON "equipos_usuarios"("usuario_id");

-- AddForeignKey
ALTER TABLE "equipos_usuarios" ADD CONSTRAINT "equipos_usuarios_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipos_usuarios" ADD CONSTRAINT "equipos_usuarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
