-- AlterTable
ALTER TABLE "CreditPayments" ADD COLUMN     "ChequeDate" TIMESTAMPTZ(6),
ADD COLUMN     "ClearedAt" TIMESTAMPTZ(6),
ADD COLUMN     "PaymentMethod" TEXT NOT NULL DEFAULT 'cash',
ADD COLUMN     "Reference" TEXT,
ADD COLUMN     "Status" TEXT NOT NULL DEFAULT 'cleared';
