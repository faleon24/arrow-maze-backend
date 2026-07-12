/*
  Warnings:

  - You are about to drop the column `cells` on the `levels` table. All the data in the column will be lost.
  - Added the required column `arrows` to the `levels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `collectibles` to the `levels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `walls` to the `levels` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "levels" DROP COLUMN "cells",
ADD COLUMN     "arrows" JSONB NOT NULL,
ADD COLUMN     "collectibles" JSONB NOT NULL,
ADD COLUMN     "timeLimitMs" INTEGER,
ADD COLUMN     "walls" JSONB NOT NULL;

-- AddForeignKey
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
