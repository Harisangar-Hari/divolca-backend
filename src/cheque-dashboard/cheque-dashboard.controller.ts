import { Controller, Get } from '@nestjs/common';
import { ChequeDashboardService } from './cheque-dashboard.service';


@Controller('cheques/dashboard')
export class ChequeDashboardController {


    constructor(
        private chequeDashboardService: ChequeDashboardService
    ) { }



    // =========================
    // FULL DASHBOARD
    // =========================

    @Get()
    getDashboard() {

        return this.chequeDashboardService.getDashboard();

    }




    // =========================
    // PENDING
    // =========================

    @Get('pending')
    getPending() {

        return this.chequeDashboardService.getPendingCheques();

    }





    // =========================
    // OVERDUE
    // =========================

    @Get('cheques/overdue')
    getOverdue() {

        return this.chequeDashboardService.getOverdueCheques();

    }





    // =========================
    // CALENDAR
    // =========================

    @Get('cheques/calendar')
    getCalendar() {

        return this.chequeDashboardService.getChequeCalendar();

    }


}