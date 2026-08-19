import { Module } from '@nestjs/common';
import { CustomerLedgerController } from './customer-ledger.controller';
import { CustomerLedgerService } from './customer-ledger.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule
  ],
  controllers: [CustomerLedgerController],
  providers: [CustomerLedgerService]
})
export class CustomerLedgerModule { }
