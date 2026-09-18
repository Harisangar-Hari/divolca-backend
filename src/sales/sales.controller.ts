import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    BadRequestException,
    HttpStatus,
    HttpCode,
    Delete,
    Put,
    Query,
} from '@nestjs/common';

import {
    RecordBulkCreditChequeDto,
    RecordCreditChequeDto,
} from './dto/record-credit-cheque.dto';

import { SalesService } from './sales.service';
import {
    AddSaleItemDto,
    EditSaleDto,
    UpdateSaleItemDto,
} from './dto/checkout.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('sales')
export class SalesController {
    constructor(private readonly salesService: SalesService) { }

    // ============================================================
    // POST ROUTES (static first, then dynamic)
    // ============================================================

    @Post('checkout')
    @Permissions('canCreateSales')
    checkout(@Body() dto: any) {
        return this.salesService.checkout(dto);
    }

    // ---------- Credit Cheques (static) ----------
    @Post('credit-cheques')
    @Permissions('canManageCreditPayments')
    @HttpCode(HttpStatus.CREATED)
    async recordCreditCheque(@Body() dto: RecordCreditChequeDto) {
        return this.salesService.recordCreditCheque(dto);
    }

    @Post('credit-cheques/bulk')
    @Permissions('canManageCreditPayments')
    @HttpCode(HttpStatus.CREATED)
    async recordBulkCreditCheque(@Body() dto: RecordBulkCreditChequeDto) {
        return this.salesService.recordBulkCreditCheque(dto);
    }

    @Post('credit-cheques/clear-by-reference/:reference')
    @Permissions('canManageCustomerCheques')
    @HttpCode(HttpStatus.OK)
    async clearCreditChequesByReference(@Param('reference') reference: string) {
        return this.salesService.clearCreditChequesByReference(reference);
    }

    @Post('credit-cheques/bounce-by-reference/:reference')
    @Permissions('canManageCustomerCheques')
    @HttpCode(HttpStatus.OK)
    async bounceCreditChequesByReference(
        @Param('reference') reference: string,
        @Body() body?: { reason?: string },
    ) {
        return this.salesService.bounceCreditChequesByReference(
            reference,
            body?.reason,
        );
    }

    @Post('credit-cheques/:id/clear')
    @Permissions('canManageCustomerCheques')
    @HttpCode(HttpStatus.OK)
    async clearCreditCheque(@Param('id') id: string) {
        return this.salesService.clearCreditCheque(id);
    }

    @Post('credit-cheques/:id/bounce')
    @Permissions('canManageCustomerCheques')
    @HttpCode(HttpStatus.OK)
    async bounceCreditCheque(
        @Param('id') id: string,
        @Body() body?: { reason?: string },
    ) {
        return this.salesService.bounceCreditCheque(id, body?.reason);
    }

    // ---------- Pay Credit ----------
    @Post('pay-credits')
    @Permissions('canManageCreditPayments')
    async payCredits(@Body() dto: { saleId: string; amount: number }) {
        if (!dto.saleId) {
            throw new BadRequestException('Sale ID is required');
        }
        if (!dto.amount || dto.amount <= 0) {
            throw new BadRequestException('Amount must be greater than 0');
        }
        return this.salesService.payCredit(dto.saleId, dto.amount);
    }

    @Post('pay-credit/:saleId')
    @Permissions('canManageCreditPayments')
    payCredit(
        @Param('saleId') saleId: string,
        @Body() body: { amount: number },
    ) {
        return this.salesService.payCredit(saleId, body.amount);
    }

    // ---------- Returns ----------
    @Post('return')
    @Permissions('canCreateSales')
    returnItems(@Body() dto: any) {
        return this.salesService.returnItems(dto);
    }

    @Post('return/:invoiceNumber')
    @Permissions('canCreateSales')
    returnInvoice(@Param('invoiceNumber') invoiceNumber: string) {
        return this.salesService.returnInvoice(invoiceNumber);
    }

    // ---------- Replacement ----------
    @Post('replacement')
    @Permissions('canCreateSales')
    replacement(@Body() dto: any) {
        return this.salesService.replacement(dto);
    }

    // ---------- Sale items ----------
    @Post('item/:saleId')
    @Permissions('canEditSales')
    @HttpCode(HttpStatus.CREATED)
    async addSaleItem(
        @Param('saleId') saleId: string,
        @Body() dto: AddSaleItemDto,
    ) {
        return this.salesService.addSaleItem(saleId, dto);
    }

    // ============================================================
    // GET ROUTES (static first, THEN @Get(':id'))
    // ============================================================

    @Get()
    @Permissions('canViewSales')
    getAll() {
        return this.salesService.getAll();
    }

    @Get('credit-cheques')
    @Permissions('canViewCustomerCheques')
    async getIncomingCheques(@Query('status') status?: string) {
        return this.salesService.getIncomingCheques(status);
    }

    @Get('invoice/:invoiceNumber')
    @Permissions('canViewSales')
    getInvoice(@Param('invoiceNumber') invoiceNumber: string) {
        return this.salesService.getInvoice(invoiceNumber);
    }

    @Get('returns')
    @Permissions('canViewSales')
    async getAllReturns(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('customerId') customerId?: string,
        @Query('productId') productId?: string,
    ) {
        return this.salesService.getAllReturns({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            customerId,
            productId,
        });
    }

    @Get(':id')
    @Permissions('canViewSales')
    getById(@Param('id') id: string) {
        return this.salesService.getById(id);
    }

    // ============================================================
    // PUT ROUTES
    // ============================================================

    @Put('edit/:id')
    @Permissions('canEditSales')
    @HttpCode(HttpStatus.OK)
    async editSaleAfterCheckout(
        @Param('id') id: string,
        @Body() dto: EditSaleDto,
    ) {
        return this.salesService.editSaleAfterCheckout(id, dto);
    }

    @Put('item/:saleId/:itemId')
    @Permissions('canEditSales')
    @HttpCode(HttpStatus.OK)
    async updateSaleItem(
        @Param('saleId') saleId: string,
        @Param('itemId') itemId: string,
        @Body() dto: UpdateSaleItemDto,
    ) {
        return this.salesService.updateSaleItem(saleId, itemId, dto);
    }

    // ============================================================
    // DELETE ROUTES
    // ============================================================

    @Delete('cancel/:id')
    @Permissions('canDeleteSales')
    @HttpCode(HttpStatus.OK)
    async cancelSale(
        @Param('id') id: string,
        @Body() body?: { reason?: string },
    ) {
        return this.salesService.cancelSale(id, body?.reason);
    }

    @Delete('cancel/invoice/:invoiceNumber')
    @Permissions('canDeleteSales')
    @HttpCode(HttpStatus.OK)
    async cancelSaleByInvoice(
        @Param('invoiceNumber') invoiceNumber: string,
        @Body() body?: { reason?: string },
    ) {
        return this.salesService.cancelSaleByInvoice(
            invoiceNumber,
            body?.reason,
        );
    }

    @Delete('item/:saleId/:itemId')
    @Permissions('canEditSales')
    @HttpCode(HttpStatus.OK)
    async removeSaleItem(
        @Param('saleId') saleId: string,
        @Param('itemId') itemId: string,
    ) {
        return this.salesService.removeSaleItem(saleId, itemId);
    }



}