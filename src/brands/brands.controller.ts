import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete
} from '@nestjs/common';

import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';


@Controller('brands')
export class BrandsController {


    constructor(
        private readonly brandsService: BrandsService
    ) { }



    @Get()
    findAll() {

        return this.brandsService.findAll();

    }



    @Get(':id')
    findOne(
        @Param('id') id: string
    ) {

        return this.brandsService.findOne(id);

    }



    @Post()
    create(
        @Body() dto: CreateBrandDto
    ) {

        return this.brandsService.create(dto);

    }



    @Delete(':id')
    remove(
        @Param('id') id: string
    ) {

        return this.brandsService.remove(id);

    }


}