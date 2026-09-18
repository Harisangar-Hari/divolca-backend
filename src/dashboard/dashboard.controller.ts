import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('dashboard')
export class DashboardController {
    constructor(private service: DashboardService) {}

    @Get('stats')
    @Permissions('canViewDashboard')
    getStats() {
        return this.service.getStats();
    }

    @Get('sales-trend')
    @Permissions('canViewDashboard')
    getSalesTrend() {
        return this.service.getSalesTrend();
    }

    @Get('top-products')
    @Permissions('canViewDashboard')
    getTopProducts() {
        return this.service.getTopProducts();
    }

    @Get('low-stock-products')
    @Permissions('canViewDashboard')
    getLowStockProducts() {
        return this.service.getLowStockProducts();
    }
}