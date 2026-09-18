import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
} from '@nestjs/common';

import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PaySupplierDto } from './dto/pay-supplier.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('suppliers')
export class SuppliersController {
    constructor(private readonly suppliersService: SuppliersService) {}

    @Get()
    @Permissions('canViewSuppliers')
    findAll() {
        return this.suppliersService.findAll();
    }

    @Get('credit-summary')
    @Permissions('canViewSuppliers')
    creditSummary() {
        return this.suppliersService.creditSummary();
    }

    @Get(':id')
    @Permissions('canViewSuppliers')
    findOne(@Param('id') id: string) {
        return this.suppliersService.findOne(id);
    }

    @Get(':id/invoices')
    @Permissions('canViewSuppliers')
    getInvoices(@Param('id') id: string) {
        return this.suppliersService.getInvoices(id);
    }

    @Get(':id/ledger')
    @Permissions('canViewSuppliers')
    getLedger(@Param('id') id: string) {
        return this.suppliersService.getLedger(id);
    }

    @Post()
    @Permissions('canCreateSuppliers')
    create(@Body() dto: CreateSupplierDto) {
        return this.suppliersService.create(dto);
    }

    @Put(':id')
    @Permissions('canEditSuppliers')
    update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
        return this.suppliersService.update(id, dto);
    }

    @Delete(':id')
    @Permissions('canDeleteSuppliers')
    remove(@Param('id') id: string) {
        return this.suppliersService.remove(id);
    }

    @Post('pay')
    @Permissions('canEditPurchases')
    paySupplier(@Body() dto: PaySupplierDto) {
        return this.suppliersService.paySupplier(dto);
    }

    @Post('cheque/clear/:id')
    @Permissions('canManageSupplierCheques')
    clearCheque(@Param('id') id: string) {
        return this.suppliersService.clearCheque(id);
    }
}