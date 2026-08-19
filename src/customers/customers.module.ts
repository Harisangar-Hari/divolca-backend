import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

import { PrismaModule } from '../prisma/prisma.module';
import { CashLedgerModule } from '../cash-ledger/cash-ledger.module';


@Module({

  imports: [
    PrismaModule,
    CashLedgerModule
  ],

  controllers: [
    CustomersController
  ],

  providers: [
    CustomersService
  ],

  exports: [
    CustomersService
  ]

})
export class CustomersModule { }