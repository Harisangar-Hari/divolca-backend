import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    BadRequestException,
    HttpStatus,
    HttpCode,
    Delete
} from '@nestjs/common';

import { SalesService } from './sales.service';


@Controller('sales')
export class SalesController {


    constructor(
        private readonly salesService: SalesService
    ) { }



    // =========================
    // CHECKOUT
    // =========================

    @Post('checkout')
    checkout(
        @Body() dto: any
    ) {

        return this.salesService.checkout(dto);

    }



    // =========================
    // GET ALL SALES
    // =========================

    @Get()
    getAll() {

        return this.salesService.getAll();

    }



    // =========================
    // GET SALE BY ID
    // =========================

    @Get(':id')
    getById(
        @Param('id') id: string
    ) {

        return this.salesService.getById(id);

    }



    // =========================
    // RETURN FULL INVOICE
    // =========================

    @Post('return/:invoiceNumber')
    returnInvoice(
        @Param('invoiceNumber') invoiceNumber: string
    ) {

        return this.salesService.returnInvoice(invoiceNumber);

    }



    // =========================
    // PAY CREDIT
    // =========================

    @Post('pay-credit/:saleId')
    payCredit(

        @Param('saleId') saleId: string,

        @Body() body: {
            amount: number
        }

    ) {

        return this.salesService.payCredit(
            saleId,
            body.amount
        );

    }

    @Post('pay-credits')
    async payCredits(
        @Body() dto: { saleId: string; amount: number }
    ) {
        // Validate input
        if (!dto.saleId) {
            throw new BadRequestException('Sale ID is required');
        }
        if (!dto.amount || dto.amount <= 0) {
            throw new BadRequestException('Amount must be greater than 0');
        }
        return this.salesService.payCredit(dto.saleId, dto.amount);
    }



    // =========================
    // PARTIAL RETURN
    // =========================

    @Post('return')
    returnItems(
        @Body() dto: any
    ) {

        return this.salesService.returnItems(dto);

    }



    // =========================
    // GET INVOICE
    // =========================

    @Get('invoice/:invoiceNumber')
    getInvoice(

        @Param('invoiceNumber') invoiceNumber: string

    ) {

        return this.salesService.getInvoice(invoiceNumber);

    }



    // =========================
    // REPLACEMENT
    // =========================

    @Post('replacement')
    replacement(
        @Body() dto: any
    ) {

        return this.salesService.replacement(dto);

    }

     // =========================
    // ✅ CANCEL SALE INVOICE (NEW)
    // =========================
    @Delete('cancel/:id')
    @HttpCode(HttpStatus.OK)
    async cancelSale(
        @Param('id') id: string,
        @Body() body?: { reason?: string }
    ) {
        return this.salesService.cancelSale(id, body?.reason);
    }

    // =========================
    // ✅ CANCEL SALE BY INVOICE NUMBER (NEW)
    // =========================
    @Delete('cancel/invoice/:invoiceNumber')
    @HttpCode(HttpStatus.OK)
    async cancelSaleByInvoice(
        @Param('invoiceNumber') invoiceNumber: string,
        @Body() body?: { reason?: string }
    ) {
        return this.salesService.cancelSaleByInvoice(invoiceNumber, body?.reason);
    }



}