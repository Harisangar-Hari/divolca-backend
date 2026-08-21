import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    HttpCode,
    Delete,
    HttpStatus
} from '@nestjs/common';


import { PurchasesService } from './purchases.service';

import { CreatePurchaseDto } from './dto/create-purchase.dto';



@Controller('purchases')
export class PurchasesController {


    constructor(
        private service: PurchasesService
    ) { }



    @Post()
    create(
        @Body() dto: CreatePurchaseDto
    ) {

        return this.service.create(dto);

    }



    @Get()
    findAll() {

        return this.service.findAll();

    }




    @Get(':id')
    findOne(
        @Param('id') id: string
    ) {

        return this.service.findOne(id);

    }

     @Delete('cancel/:id')
    @HttpCode(HttpStatus.OK)
    async cancelPurchase(
        @Param('id') id: string,
        @Body() body?: { reason?: string }
    ) {
        return this.service.cancelPurchase(id, body?.reason);
    }

    // ✅ Cancel purchase by invoice number
    @Delete('cancel/invoice/:invoiceNumber')
    @HttpCode(HttpStatus.OK)
    async cancelPurchaseByInvoice(
        @Param('invoiceNumber') invoiceNumber: string,
        @Body() body?: { reason?: string }
    ) {
        return this.service.cancelPurchaseByInvoice(invoiceNumber, body?.reason);
    }



}