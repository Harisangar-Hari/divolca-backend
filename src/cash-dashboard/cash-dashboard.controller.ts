import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { CashDashboardService } from './cash-dashboard.service';
import { ManualCashDto } from './dto/manual-cash.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('cash-dashboard')
export class CashDashboardController {
    constructor(private service: CashDashboardService) { }

    @Get('daily')
    @Permissions('canViewCashDashboard')
    async getDaily(@Query('date') date: string) {
        return this.service.getDaily(new Date(date));
    }

    @Post('manual')
    @Permissions('canCreateExpenses')
    async addManualCash(@Body() dto: ManualCashDto) {
        return this.service.addManualCash(dto);
    }
}