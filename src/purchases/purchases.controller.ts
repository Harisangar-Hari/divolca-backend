import {
    Controller,
    Post,
    Get,
    Body,
    Param
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



}