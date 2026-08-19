import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param
} from '@nestjs/common';

import { SuppliersService } from './suppliers.service';

import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PaySupplierDto } from './dto/pay-supplier.dto';



@Controller('suppliers')
export class SuppliersController {


    constructor(
        private readonly suppliersService: SuppliersService
    ) { }



    @Get()
    findAll() {

        return this.suppliersService.findAll();

    }



    @Get('credit-summary')
    creditSummary() {

        return this.suppliersService.creditSummary();

    }



    @Get(':id')
    findOne(
        @Param('id') id: string
    ) {

        return this.suppliersService.findOne(id);

    }



    @Get(':id/invoices')
    getInvoices(
        @Param('id') id: string
    ) {

        return this.suppliersService.getInvoices(id);

    }



    @Post()
    create(
        @Body() dto: CreateSupplierDto
    ) {

        return this.suppliersService.create(dto);

    }



    @Put(':id')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateSupplierDto
    ) {

        return this.suppliersService.update(id, dto);

    }



    @Delete(':id')
    remove(
        @Param('id') id: string
    ) {

        return this.suppliersService.remove(id);

    }



    @Post('pay')
    paySupplier(
        @Body() dto: PaySupplierDto
    ) {

        return this.suppliersService.paySupplier(dto);

    }



    @Get(':id/ledger')
    getLedger(
        @Param('id') id: string
    ) {

        return this.suppliersService.getLedger(id);

    }



    @Post('cheque/clear/:id')
    clearCheque(
        @Param('id') id: string
    ) {

        return this.suppliersService.clearCheque(id);

    }



}