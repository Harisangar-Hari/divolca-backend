-- CreateTable
CREATE TABLE "Quotations" (
    "Id" UUID NOT NULL,
    "Sequence" SERIAL NOT NULL,
    "QuotationNumber" TEXT NOT NULL,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6),
    "CustomerId" UUID,
    "CustomerName" TEXT,
    "CustomerPhone" TEXT,
    "Notes" TEXT,
    "SubTotal" DECIMAL NOT NULL DEFAULT 0.0,
    "InvoiceDiscount" DECIMAL NOT NULL DEFAULT 0.0,
    "TotalAmount" DECIMAL NOT NULL DEFAULT 0.0,
    "Status" TEXT NOT NULL DEFAULT 'draft',
    "ConvertedSaleId" UUID,
    "ConvertedAt" TIMESTAMPTZ(6),

    CONSTRAINT "PK_Quotations" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "QuotationItems" (
    "Id" UUID NOT NULL,
    "QuotationId" UUID NOT NULL,
    "ProductId" UUID NOT NULL,
    "Quantity" INTEGER NOT NULL,
    "UnitPrice" DECIMAL NOT NULL,
    "Discount" DECIMAL NOT NULL DEFAULT 0.0,
    "Total" DECIMAL NOT NULL,

    CONSTRAINT "PK_QuotationItems" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quotations_Sequence_key" ON "Quotations"("Sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Quotations_QuotationNumber_key" ON "Quotations"("QuotationNumber");

-- CreateIndex
CREATE INDEX "IX_Quotations_CustomerId" ON "Quotations"("CustomerId");

-- CreateIndex
CREATE INDEX "IX_Quotations_Status" ON "Quotations"("Status");

-- CreateIndex
CREATE INDEX "IX_QuotationItems_QuotationId" ON "QuotationItems"("QuotationId");

-- CreateIndex
CREATE INDEX "IX_QuotationItems_ProductId" ON "QuotationItems"("ProductId");

-- AddForeignKey
ALTER TABLE "Quotations" ADD CONSTRAINT "FK_Quotations_Customers_CustomerId" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuotationItems" ADD CONSTRAINT "FK_QuotationItems_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuotationItems" ADD CONSTRAINT "FK_QuotationItems_Quotations_QuotationId" FOREIGN KEY ("QuotationId") REFERENCES "Quotations"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;
