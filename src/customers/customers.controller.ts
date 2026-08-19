import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query
} from '@nestjs/common';

import { CustomersService } from './customers.service';

import { CreateCustomerDto } from './dto/create-customer.dto';
import { PayCustomerCreditDto } from './dto/pay-customer-credit.dto';



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



}