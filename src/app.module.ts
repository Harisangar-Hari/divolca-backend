import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TestController } from './test/test.controller';
import { AuthModule } from './auth/auth.module';
import { CashDashboardModule } from './cash-dashboard/cash-dashboard.module';
import { CategoriesModule } from './categories/categories.module';
import { CashLedgerModule } from './cash-ledger/cash-ledger.module';
import { ChequeModule } from './cheque/cheque.module';
import { ChequeDashboardModule } from './cheque-dashboard/cheque-dashboard.module';
import { CustomerLedgerModule } from './customer-ledger/customer-ledger.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ExpenseModule } from './expense/expense.module';
import { ProductsModule } from './products/products.module';
import { PurchasesModule } from './purchases/purchases.module';
import { SalesModule } from './sales/sales.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { BrandsModule } from './brands/brands.module';
import { ReportsModule } from './reports/reports.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,

    AuthModule,

    CashDashboardModule,

    CategoriesModule,

    CashLedgerModule,

    ChequeModule,

    ChequeDashboardModule,

    CustomerLedgerModule,

    CustomersModule,

    DashboardModule,

    ExpenseModule,

    ProductsModule,

    PurchasesModule,

    SalesModule,

    SuppliersModule,

    BrandsModule,

    ReportsModule,
  ],

  controllers: [
    AppController,
    TestController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule { }