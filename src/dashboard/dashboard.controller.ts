import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';


@Controller('dashboard')
export class DashboardController {


    constructor(
        private service: DashboardService
    ) { }



    @Get('stats')
    getStats() {

        return this.service.getStats();

    }



    @Get('sales-trend')
    getSalesTrend() {

        return this.service.getSalesTrend();

    }



    @Get('top-products')
    getTopProducts() {

        return this.service.getTopProducts();

    }



    @Get('low-stock-products')
    getLowStockProducts() {

        return this.service.getLowStockProducts();

    }


}