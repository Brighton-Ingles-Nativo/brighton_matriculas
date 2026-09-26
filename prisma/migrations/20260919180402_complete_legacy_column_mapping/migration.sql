/*
  Warnings:

  - You are about to drop the column `balance` on the `contratos` table. All the data in the column will be lost.
  - You are about to drop the column `modality` on the `contratos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "contratos" DROP COLUMN "balance",
DROP COLUMN "modality",
ADD COLUMN     "modalidad" VARCHAR(20),
ADD COLUMN     "saldo" DECIMAL(10,2);
