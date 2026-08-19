import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CashLedgerModule } from '../cash-ledger/cash-ledger.module';


@Module({

  imports: [
    PrismaModule,
    CashLedgerModule
  ],

  controllers: [
    SalesController
  ],

  providers: [
    SalesService
  ],

  exports: [
    SalesService
  ]

})
export class SalesModule { }