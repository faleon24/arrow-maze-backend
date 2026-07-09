-- CreateTable
CREATE TABLE "progress_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "moves" INTEGER NOT NULL,
    "timeMs" INTEGER NOT NULL,
    "stars" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "progress_entries_userId_levelId_key" ON "progress_entries"("userId", "levelId");
