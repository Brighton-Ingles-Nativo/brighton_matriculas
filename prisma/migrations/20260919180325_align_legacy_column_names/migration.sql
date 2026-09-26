/*
  Warnings:

  - You are about to drop the column `program` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `strategy` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `testimonials` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `bank` on the `recibos` table. All the data in the column will be lost.
  - You are about to drop the column `concepts` on the `recibos` table. All the data in the column will be lost.
  - Added the required column `estrategia` to the `contratos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `programa` to the `contratos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "contratos" DROP COLUMN "program",
DROP COLUMN "status",
DROP COLUMN "strategy",
DROP COLUMN "testimonials",
ADD COLUMN     "estado" VARCHAR(50),
ADD COLUMN     "estrategia" VARCHAR(50) NOT NULL,
ADD COLUMN     "programa" VARCHAR(20) NOT NULL,
ADD COLUMN     "testimonios" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "recibos" DROP COLUMN "bank",
DROP COLUMN "concepts",
ADD COLUMN     "banco" VARCHAR(50),
ADD COLUMN     "conceptos" VARCHAR(255);
