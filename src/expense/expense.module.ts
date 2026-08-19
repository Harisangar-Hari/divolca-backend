import { Module } from '@nestjs/common';
import { ExpenseController } from './expense.controller';
import { ExpenseService } from './expense.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CashLedgerModule } from '../cash-ledger/cash-ledger.module';


@Module({

  imports: [
    PrismaModule,
    CashLedgerModule
  ],

  controllers: [
    ExpenseController
  ],

  providers: [
    ExpenseService
  ]

})
export class ExpenseModule { }