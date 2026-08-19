-- CreateTable
CREATE TABLE "CashLedgerEntries" (
    "Id" UUID NOT NULL,
    "Date" TIMESTAMPTZ(6) NOT NULL,
    "Type" TEXT NOT NULL,
    "Amount" DECIMAL NOT NULL,
    "Category" TEXT NOT NULL,
    "ReferenceId" TEXT,
    "Description" TEXT NOT NULL,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_CashLedgerEntries" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Categories" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,

    CONSTRAINT "PK_Categories" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Categories2" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,
    "Category" TEXT NOT NULL,

    CONSTRAINT "PK_Categories2" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "CreditPayments" (
    "Id" UUID NOT NULL,
    "SaleId" UUID NOT NULL,
    "Amount" DECIMAL NOT NULL,
    "PaidAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_CreditPayments" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "CustomerLedgerEntries" (
    "Id" UUID NOT NULL,
    "CustomerId" UUID NOT NULL,
    "SaleId" UUID,
    "SaleReturnId" UUID,
    "Credit" DECIMAL NOT NULL,
    "Debit" DECIMAL NOT NULL,
    "Type" TEXT NOT NULL,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_CustomerLedgerEntries" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Customers" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,
    "Phone" TEXT NOT NULL,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL,
    "LoyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "LoyaltyTier" TEXT NOT NULL DEFAULT '',
    "TotalSpent" DECIMAL NOT NULL DEFAULT 0.0,

    CONSTRAINT "PK_Customers" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Expenses" (
    "Id" UUID NOT NULL,
    "Title" TEXT NOT NULL,
    "Amount" DECIMAL NOT NULL,
    "Category" TEXT NOT NULL,
    "ExpenseDate" TIMESTAMPTZ(6) NOT NULL,
    "Notes" TEXT,

    CONSTRAINT "PK_Expenses" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Brands" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_Brands" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Products" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,
    "Barcode" TEXT NOT NULL,
    "SKU" TEXT NOT NULL DEFAULT '',
    "Description" TEXT,
    "Price" DECIMAL NOT NULL,
    "CostPrice" DECIMAL NOT NULL,
    "Discount" DECIMAL NOT NULL DEFAULT 0.0,
    "StockQty" INTEGER NOT NULL,
    "ReorderLevel" INTEGER NOT NULL DEFAULT 0,
    "Unit" TEXT NOT NULL DEFAULT 'pcs',
    "IsActive" BOOLEAN NOT NULL,
    "WarrantyMonths" INTEGER DEFAULT 0,
    "ImageUrl" TEXT,
    "CategoryId" UUID NOT NULL,
    "BrandId" UUID,

    CONSTRAINT "PK_Products" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "PurchaseItems" (
    "Id" UUID NOT NULL,
    "PurchaseId" UUID NOT NULL,
    "ProductId" UUID NOT NULL,
    "Quantity" INTEGER NOT NULL,
    "CostPrice" DECIMAL NOT NULL,

    CONSTRAINT "PK_PurchaseItems" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Purchases" (
    "Id" UUID NOT NULL,
    "InvoiceNumber" TEXT NOT NULL,
    "PurchaseDate" TIMESTAMPTZ(6) NOT NULL,
    "GrandTotal" DECIMAL NOT NULL,
    "SupplierId" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    "BalanceAmount" DECIMAL NOT NULL DEFAULT 0.0,
    "PaidAmount" DECIMAL NOT NULL DEFAULT 0.0,

    CONSTRAINT "PK_Purchases" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "SaleItems" (
    "Id" UUID NOT NULL,
    "SaleId" UUID NOT NULL,
    "ProductId" UUID NOT NULL,
    "Quantity" INTEGER NOT NULL,
    "UnitPrice" DECIMAL NOT NULL,
    "Total" DECIMAL NOT NULL,
    "Discount" DECIMAL NOT NULL DEFAULT 0.0,

    CONSTRAINT "PK_SaleItems" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "SaleReturnItems" (
    "Id" UUID NOT NULL,
    "SaleReturnId" UUID NOT NULL,
    "ProductId" UUID NOT NULL,
    "Quantity" INTEGER NOT NULL,
    "UnitPrice" DECIMAL NOT NULL,
    "Reason" TEXT,

    CONSTRAINT "PK_SaleReturnItems" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "SaleReturns" (
    "Id" UUID NOT NULL,
    "SaleId" UUID NOT NULL,
    "ReturnedAt" TIMESTAMPTZ(6) NOT NULL,
    "Reason" TEXT NOT NULL,
    "IsCreditAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "RefundAmount" DECIMAL NOT NULL DEFAULT 0.0,
    "RefundMethod" TEXT,
    "ReturnAmount" DECIMAL NOT NULL DEFAULT 0.0,

    CONSTRAINT "PK_SaleReturns" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Sales" (
    "Id" UUID NOT NULL,
    "InvoiceNumber" TEXT NOT NULL,
    "TotalAmount" DECIMAL NOT NULL,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL,
    "Status" INTEGER NOT NULL DEFAULT 0,
    "BalanceAmount" DECIMAL NOT NULL DEFAULT 0.0,
    "CustomerId" UUID,
    "IsCreditSale" BOOLEAN NOT NULL DEFAULT false,
    "paymentMode" TEXT NOT NULL DEFAULT 'cash',
    "PaidAmount" DECIMAL NOT NULL DEFAULT 0.0,
    "HasReturns" BOOLEAN NOT NULL DEFAULT false,
    "ReturnedAmount" DECIMAL NOT NULL DEFAULT 0.0,
    "InvoiceDiscount" DECIMAL NOT NULL DEFAULT 0.0,
    "SubTotal" DECIMAL NOT NULL DEFAULT 0.0,

    CONSTRAINT "PK_Sales" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "SupplierPayments" (
    "Id" UUID NOT NULL,
    "PurchaseId" UUID NOT NULL,
    "Amount" DECIMAL NOT NULL,
    "PaymentMethod" TEXT NOT NULL,
    "PaidAt" TIMESTAMPTZ(6) NOT NULL,
    "Status" TEXT,
    "CashLedgerPosted" BOOLEAN NOT NULL DEFAULT false,
    "ClearedAt" TIMESTAMPTZ(6),
    "ChequeNumber" TEXT,
    "ChequeDate" TIMESTAMPTZ(6),
    "Notes" TEXT,

    CONSTRAINT "PK_SupplierPayments" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Suppliers" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,
    "Phone" TEXT NOT NULL,
    "Email" TEXT,
    "Address" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_Suppliers" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Users" (
    "Id" UUID NOT NULL,
    "Username" TEXT NOT NULL,
    "PasswordHash" TEXT NOT NULL,
    "Role" TEXT NOT NULL,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_Users" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "__EFMigrationsHistory" (
    "MigrationId" VARCHAR(150) NOT NULL,
    "ProductVersion" VARCHAR(32) NOT NULL,

    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

-- CreateIndex
CREATE INDEX "IX_CreditPayments_SaleId" ON "CreditPayments"("SaleId");

-- CreateIndex
CREATE INDEX "IX_CustomerLedgerEntries_CustomerId" ON "CustomerLedgerEntries"("CustomerId");

-- CreateIndex
CREATE INDEX "IX_CustomerLedgerEntries_SaleId" ON "CustomerLedgerEntries"("SaleId");

-- CreateIndex
CREATE INDEX "IX_CustomerLedgerEntries_SaleReturnId" ON "CustomerLedgerEntries"("SaleReturnId");

-- CreateIndex
CREATE INDEX "IX_Products_CategoryId" ON "Products"("CategoryId");

-- CreateIndex
CREATE INDEX "IX_Products_BrandId" ON "Products"("BrandId");

-- CreateIndex
CREATE INDEX "IX_PurchaseItems_ProductId" ON "PurchaseItems"("ProductId");

-- CreateIndex
CREATE INDEX "IX_PurchaseItems_PurchaseId" ON "PurchaseItems"("PurchaseId");

-- CreateIndex
CREATE INDEX "IX_Purchases_SupplierId" ON "Purchases"("SupplierId");

-- CreateIndex
CREATE INDEX "IX_SaleItems_ProductId" ON "SaleItems"("ProductId");

-- CreateIndex
CREATE INDEX "IX_SaleItems_SaleId" ON "SaleItems"("SaleId");

-- CreateIndex
CREATE INDEX "IX_SaleReturnItems_ProductId" ON "SaleReturnItems"("ProductId");

-- CreateIndex
CREATE INDEX "IX_SaleReturnItems_SaleReturnId" ON "SaleReturnItems"("SaleReturnId");

-- CreateIndex
CREATE INDEX "IX_SaleReturns_SaleId" ON "SaleReturns"("SaleId");

-- CreateIndex
CREATE INDEX "IX_Sales_CustomerId" ON "Sales"("CustomerId");

-- CreateIndex
CREATE INDEX "IX_SupplierPayments_PurchaseId" ON "SupplierPayments"("PurchaseId");

-- AddForeignKey
ALTER TABLE "CreditPayments" ADD CONSTRAINT "FK_CreditPayments_Sales_SaleId" FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CustomerLedgerEntries" ADD CONSTRAINT "FK_CustomerLedgerEntries_Customers_CustomerId" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CustomerLedgerEntries" ADD CONSTRAINT "FK_CustomerLedgerEntries_SaleReturns_SaleReturnId" FOREIGN KEY ("SaleReturnId") REFERENCES "SaleReturns"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CustomerLedgerEntries" ADD CONSTRAINT "FK_CustomerLedgerEntries_Sales_SaleId" FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "FK_Products_Categories_CategoryId" FOREIGN KEY ("CategoryId") REFERENCES "Categories"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "FK_Products_Brands_BrandId" FOREIGN KEY ("BrandId") REFERENCES "Brands"("Id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PurchaseItems" ADD CONSTRAINT "FK_PurchaseItems_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PurchaseItems" ADD CONSTRAINT "FK_PurchaseItems_Purchases_PurchaseId" FOREIGN KEY ("PurchaseId") REFERENCES "Purchases"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Purchases" ADD CONSTRAINT "FK_Purchases_Suppliers_SupplierId" FOREIGN KEY ("SupplierId") REFERENCES "Suppliers"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleItems" ADD CONSTRAINT "FK_SaleItems_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleItems" ADD CONSTRAINT "FK_SaleItems_Sales_SaleId" FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleReturnItems" ADD CONSTRAINT "FK_SaleReturnItems_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleReturnItems" ADD CONSTRAINT "FK_SaleReturnItems_SaleReturns_SaleReturnId" FOREIGN KEY ("SaleReturnId") REFERENCES "SaleReturns"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleReturns" ADD CONSTRAINT "FK_SaleReturns_Sales_SaleId" FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "FK_Sales_Customers_CustomerId" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SupplierPayments" ADD CONSTRAINT "FK_SupplierPayments_Purchases_PurchaseId" FOREIGN KEY ("PurchaseId") REFERENCES "Purchases"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;
