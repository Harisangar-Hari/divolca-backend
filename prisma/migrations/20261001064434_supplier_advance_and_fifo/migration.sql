-- AlterTable
ALTER TABLE "SupplierPayments" ADD COLUMN     "SupplierId" UUID,
ALTER COLUMN "PurchaseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Suppliers" ADD COLUMN     "AdvanceBalance" DECIMAL NOT NULL DEFAULT 0.0,
ADD COLUMN     "PendingAdvance" DECIMAL NOT NULL DEFAULT 0.0;

-- CreateIndex
CREATE INDEX "SupplierPayments_SupplierId_idx" ON "SupplierPayments"("SupplierId");

-- CreateIndex
CREATE INDEX "SupplierPayments_ChequeNumber_idx" ON "SupplierPayments"("ChequeNumber");

-- CreateIndex
CREATE INDEX "SupplierPayments_Status_idx" ON "SupplierPayments"("Status");

-- AddForeignKey
ALTER TABLE "SupplierPayments" ADD CONSTRAINT "FK_SupplierPayments_Suppliers_SupplierId" FOREIGN KEY ("SupplierId") REFERENCES "Suppliers"("Id") ON DELETE SET NULL ON UPDATE NO ACTION;
