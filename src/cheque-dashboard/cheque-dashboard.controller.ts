import { Controller, Get } from '@nestjs/common';
import { ChequeDashboardService } from './cheque-dashboard.service';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('cheques/dashboard')
export class ChequeDashboardController {
    constructor(private chequeDashboardService: ChequeDashboardService) { }

    @Get()
    @Permissions('canViewSupplierCheques')
    getDashboard() {
        return this.chequeDashboardService.getDashboard();
    }

    @Get('pending')
    @Permissions('canViewSupplierCheques')
    getPending() {
        return this.chequeDashboardService.getPendingCheques();
    }

    @Get('cheques/overdue')
    @Permissions('canViewSupplierCheques')
    getOverdue() {
        return this.chequeDashboardService.getOverdueCheques();
    }

    @Get('cheques/calendar')
    @Permissions('canViewSupplierCheques')
    getCalendar() {
        return this.chequeDashboardService.getChequeCalendar();
    }
}