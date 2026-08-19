import { Module } from '@nestjs/common';
import { CashDashboardController } from './cash-dashboard.controller';
import { CashDashboardService } from './cash-dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
  ],
  controllers: [CashDashboardController],
  providers: [CashDashboardService]
})
export class CashDashboardModule { }
