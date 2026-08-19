import { Module } from '@nestjs/common';
import { CashLedgerService } from './cash-ledger.service';
import { PrismaModule } from '../prisma/prisma.module';


@Module({

  imports: [
    PrismaModule
  ],

  providers: [
    CashLedgerService
  ],

  exports: [
    CashLedgerService
  ]

})
export class CashLedgerModule { }