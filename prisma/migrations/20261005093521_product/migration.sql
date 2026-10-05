-- DropForeignKey
ALTER TABLE "SaleItems" DROP CONSTRAINT "FK_SaleItems_Products_ProductId";

-- AddForeignKey
ALTER TABLE "SaleItems" ADD CONSTRAINT "FK_SaleItems_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE RESTRICT ON UPDATE NO ACTION;
