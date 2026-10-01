-- AddForeignKey
ALTER TABLE "CreditPayments" ADD CONSTRAINT "FK_CreditPayments_Customers_CustomerId" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE SET NULL ON UPDATE NO ACTION;
