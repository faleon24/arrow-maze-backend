/*
  Warnings:

  - You are about to drop the column `layout` on the `levels` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `levels` table. All the data in the column will be lost.
  - You are about to drop the column `number` on the `levels` table. All the data in the column will be lost.
  - You are about to drop the column `parMoves` on the `levels` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[index]` on the table `levels` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cells` to the `levels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `index` to the `levels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `parTimeMs` to the `levels` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "levels_number_key";

-- AlterTable
ALTER TABLE "levels" DROP COLUMN "layout",
DROP COLUMN "name",
DROP COLUMN "number",
DROP COLUMN "parMoves",
ADD COLUMN     "cells" JSONB NOT NULL,
ADD COLUMN     "index" INTEGER NOT NULL,
ADD COLUMN     "parTimeMs" INTEGER NOT NULL,
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "levels_index_key" ON "levels"("index");
