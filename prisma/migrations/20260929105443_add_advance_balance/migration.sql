-- AlterTable
ALTER TABLE "CreditPayments" ALTER COLUMN "SaleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Customers" ADD COLUMN     "AdvanceBalance" DECIMAL NOT NULL DEFAULT 0.0,
ADD COLUMN     "PendingAdvance" DECIMAL NOT NULL DEFAULT 0.0;
