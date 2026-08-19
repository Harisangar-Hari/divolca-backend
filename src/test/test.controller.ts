import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';


// @ApiBearerAuth('JWT-auth')
// @UseGuards(JwtAuthGuard)
@Controller('test')
export class TestController {

    constructor(
        private prisma: PrismaService
    ) { }


    // @Get()
    // async testDatabase() {

    //     const products = await this.prisma.customers.findMany({
    //         take: 5,
    //     });

    //     return products;
    // }

    @Get()
    async testLedger() {

        const data = await this.prisma.customerLedgerEntries.findMany();

        return data;

    }

}