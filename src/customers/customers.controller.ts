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
    Delete
} from '@nestjs/common';

import { CustomersService } from './customers.service';

import { CreateCustomerDto } from './dto/create-customer.dto';
import { PayCustomerCreditDto } from './dto/pay-customer-credit.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';



@Controller('customers')
export class CustomersController {


    constructor(
        private readonly customersService: CustomersService
    ) { }



    // =========================
    // GET ALL CUSTOMERS
    // =========================

    @Get()
    async getAllCustomers() {

        return this.customersService.getAllCustomers();

    }

     @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteCustomer(
        @Param('id') id: string
    ) {
        return this.customersService.deleteCustomer(id);
    }


    // =========================
    // CREDIT SUMMARY
    // =========================

    @Get('credit-summary')
    async getCreditSummary() {

        return this.customersService.getCreditSummary();

    }



    // =========================
    // SEARCH CUSTOMER
    // =========================

    @Get('search')
    async searchCustomers(
        @Query('q') q: string
    ) {

        return this.customersService.searchCustomers(q);

    }



    // =========================
    // CREATE CUSTOMER
    // =========================

    @Post()
    async createCustomer(
        @Body() dto: CreateCustomerDto
    ) {

        return this.customersService.createCustomer(dto);

    }



    // =========================
    // PAY CUSTOMER CREDIT
    // =========================

    @Post('pay-customer-credit')
    async payCustomerCredit(
        @Body() dto: PayCustomerCreditDto
    ) {

        return this.customersService.payCustomerCredit(dto);

    }



    // =========================
    // CUSTOMER INVOICES
    // IMPORTANT:
    // Keep before :id route
    // =========================

    @Get(':id/invoices')
    async getCustomerInvoices(
        @Param('id') id: string
    ) {

        return this.customersService.getCustomerInvoices(id);

    }



    // =========================
    // CUSTOMER DETAILS
    // =========================

    @Get(':id')
    async getCustomerById(
        @Param('id') id: string
    ) {

        return this.customersService.getCustomerById(id);

    }

      @Put(':id')
    async updateCustomer(
        @Param('id') id: string,
        @Body() dto: UpdateCustomerDto
    ) {
        return this.customersService.updateCustomer(id, dto);
    }

    // =========================
    // ✅ TOGGLE CUSTOMER STATUS (NEW)
    // =========================
    @Patch(':id/toggle-status')
    @HttpCode(HttpStatus.OK)
    async toggleCustomerStatus(
        @Param('id') id: string
    ) {
        return this.customersService.toggleCustomerStatus(id);
    }

    // =========================
    // ✅ TOGGLE BLOCK CUSTOMER (NEW)
    // =========================
    @Patch(':id/toggle-block')
    @HttpCode(HttpStatus.OK)
    async toggleBlockCustomer(
        @Param('id') id: string,
        @Body() body?: { reason?: string }
    ) {
        return this.customersService.toggleBlockCustomer(id, body?.reason);
    }




}