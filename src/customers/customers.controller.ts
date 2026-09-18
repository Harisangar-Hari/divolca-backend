import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    Put,
    Patch,
    HttpCode,
    HttpStatus,
    Delete,
} from '@nestjs/common';

import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { PayCustomerCreditDto } from './dto/pay-customer-credit.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from 'src/auth/auth.service';
import { Roles } from 'src/auth/decorators/roles.decorator';

@ApiBearerAuth('JWT-auth')
@Controller('customers')
export class CustomersController {
    constructor(private readonly customersService: CustomersService) { }

    @Get()
    @Permissions('canViewCustomers')
    async getAllCustomers() {
        return this.customersService.getAllCustomers();
    }

    @Get('credit-summary')
    @Permissions('canViewCustomers')
    async getCreditSummary() {
        return this.customersService.getCreditSummary();
    }

    @Get('search')
    @Permissions('canViewCustomers')
    async searchCustomers(@Query('q') q: string) {
        return this.customersService.searchCustomers(q);
    }

    @Post()
    @Permissions('canCreateCustomers')
    async createCustomer(@Body() dto: CreateCustomerDto) {
        return this.customersService.createCustomer(dto);
    }

    @Post('pay-customer-credit')
    @Permissions('canManageCreditPayments')
    async payCustomerCredit(@Body() dto: PayCustomerCreditDto) {
        return this.customersService.payCustomerCredit(dto);
    }

    @Get(':id/invoices')
    @Permissions('canViewCustomers')
    async getCustomerInvoices(@Param('id') id: string) {
        return this.customersService.getCustomerInvoices(id);
    }

    @Get(':id')
    @Permissions('canViewCustomers')
    async getCustomerById(@Param('id') id: string) {
        return this.customersService.getCustomerById(id);
    }

    @Put(':id')
    @Permissions('canEditCustomers')
    async updateCustomer(
        @Param('id') id: string,
        @Body() dto: UpdateCustomerDto,
    ) {
        return this.customersService.updateCustomer(id, dto);
    }

    @Patch(':id/toggle-status')
    @Permissions('canEditCustomers')
    @HttpCode(HttpStatus.OK)
    async toggleCustomerStatus(@Param('id') id: string) {
        return this.customersService.toggleCustomerStatus(id);
    }

    @Patch(':id/toggle-block')
    @Permissions('canEditCustomers')
    @HttpCode(HttpStatus.OK)
    async toggleBlockCustomer(
        @Param('id') id: string,
        @Body() body?: { reason?: string },
    ) {
        return this.customersService.toggleBlockCustomer(id, body?.reason);
    }

    @ApiBearerAuth()
    @Roles(UserRole.ADMIN)
    @Delete(':id')
    @Permissions('canDeleteCustomers')
    @HttpCode(HttpStatus.OK)
    async deleteCustomer(@Param('id') id: string) {
        return this.customersService.deleteCustomer(id);
    }
}