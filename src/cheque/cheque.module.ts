import { Module } from '@nestjs/common';
import { ChequeController } from './cheque.controller';
import { ChequeService } from './cheque.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CashLedgerModule } from '../cash-ledger/cash-ledger.module';


@Module({

  imports: [
    PrismaModule,
    CashLedgerModule
  ],


  controllers: [
    ChequeController
  ],


  providers: [
    ChequeService
  ]


})
export class ChequeModule { }