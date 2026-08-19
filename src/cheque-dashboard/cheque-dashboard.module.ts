import { Module } from '@nestjs/common';
import { ChequeDashboardController } from './cheque-dashboard.controller';
import { ChequeDashboardService } from './cheque-dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';


@Module({
  imports: [
    PrismaModule
  ],

  controllers: [
    ChequeDashboardController
  ],

  providers: [
    ChequeDashboardService
  ]
})
export class ChequeDashboardModule { }