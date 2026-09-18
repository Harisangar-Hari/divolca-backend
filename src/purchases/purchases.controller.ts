import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    HttpCode,
    Delete,
    HttpStatus,
} from '@nestjs/common';

import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('purchases')
export class PurchasesController {
    constructor(private service: PurchasesService) { }

    @Post()
    @Permissions('canCreatePurchases')
    create(@Body() dto: CreatePurchaseDto) {
        return this.service.create(dto);
    }

    @Get()
    @Permissions('canViewPurchases')
    findAll() {
        return this.service.findAll();
    }

    @Get(':id')
    @Permissions('canViewPurchases')
    findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }

    @Delete('cancel/:id')
    @Permissions('canDeletePurchases')
    @HttpCode(HttpStatus.OK)
    async cancelPurchase(
        @Param('id') id: string,
        @Body() body?: { reason?: string },
    ) {
        return this.service.cancelPurchase(id, body?.reason);
    }

    @Delete('cancel/invoice/:invoiceNumber')
    @Permissions('canDeletePurchases')
    @HttpCode(HttpStatus.OK)
    async cancelPurchaseByInvoice(
        @Param('invoiceNumber') invoiceNumber: string,
        @Body() body?: { reason?: string },
    ) {
        return this.service.cancelPurchaseByInvoice(
            invoiceNumber,
            body?.reason,
        );
    }
}