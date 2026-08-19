/*
  Warnings:

  - A unique constraint covering the columns `[PurchaseNumber]` on the table `Purchases` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Purchases" ADD COLUMN     "PurchaseNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Purchases_PurchaseNumber_key" ON "Purchases"("PurchaseNumber");
