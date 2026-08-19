-- AlterTable
ALTER TABLE "CreditPayments" ADD COLUMN     "Note" TEXT;

-- CreateTable
CREATE TABLE "SalePayments" (
    "Id" UUID NOT NULL,
    "SaleId" UUID NOT NULL,
    "PaymentMode" TEXT NOT NULL,
    "Amount" DECIMAL NOT NULL,
    "Status" TEXT NOT NULL,
    "Reference" TEXT,
    "PaidAt" TIMESTAMPTZ(6) NOT NULL,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_SalePayments" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE INDEX "SalePayments_SaleId_idx" ON "SalePayments"("SaleId");

-- AddForeignKey
ALTER TABLE "SalePayments" ADD CONSTRAINT "SalePayments_SaleId_fkey" FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
