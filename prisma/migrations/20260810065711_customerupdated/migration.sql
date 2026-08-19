/*
  Warnings:

  - A unique constraint covering the columns `[Email]` on the table `Customers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('RETAIL', 'WHOLESALE', 'CORPORATE', 'VIP', 'GOVERNMENT', 'EDUCATIONAL');

-- AlterTable
ALTER TABLE "Customers" ADD COLUMN     "Address" TEXT,
ADD COLUMN     "AlternativePhone" TEXT,
ADD COLUMN     "AvailableCredit" DECIMAL DEFAULT 0.0,
ADD COLUMN     "BillingAddress" TEXT,
ADD COLUMN     "BlockReason" TEXT,
ADD COLUMN     "City" TEXT,
ADD COLUMN     "CompanyName" TEXT,
ADD COLUMN     "Country" TEXT DEFAULT 'Bangladesh',
ADD COLUMN     "CreditBalance" DECIMAL NOT NULL DEFAULT 0.0,
ADD COLUMN     "CreditLimit" DECIMAL DEFAULT 0.0,
ADD COLUMN     "CreditRiskScore" INTEGER,
ADD COLUMN     "CustomerType" "CustomerType" NOT NULL DEFAULT 'RETAIL',
ADD COLUMN     "DeliveryAddress" TEXT,
ADD COLUMN     "Email" TEXT,
ADD COLUMN     "Fax" TEXT,
ADD COLUMN     "IsActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "IsBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "LastPaymentDate" TIMESTAMP(3),
ADD COLUMN     "LastPurchaseDate" TIMESTAMP(3),
ADD COLUMN     "Notes" TEXT,
ADD COLUMN     "PaymentTerms" TEXT,
ADD COLUMN     "PostalCode" TEXT,
ADD COLUMN     "State" TEXT,
ADD COLUMN     "TaxNumber" TEXT,
ADD COLUMN     "UpdatedAt" TIMESTAMPTZ(6),
ADD COLUMN     "Website" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customers_Email_key" ON "Customers"("Email");
