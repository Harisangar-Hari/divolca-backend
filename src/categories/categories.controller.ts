import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param
} from '@nestjs/common';


import { CategoriesService } from './categories.service';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';


@Controller('categories')
export class CategoriesController {


    constructor(
        private readonly service: CategoriesService
    ) { }



    // GET ALL

    @Get()
    findAll() {

        return this.service.findAll();

    }

    @Get(':id')
    findOne(
        @Param('id') id: string,

    ) {

        return this.service.findOne(id);

    }

    // CREATE

    @Post()
    create(
        @Body() dto: CreateCategoryDto
    ) {

        return this.service.create(dto);

    }



    // UPDATE

    @Put(':id')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateCategoryDto
    ) {

        return this.service.update(
            id,
            dto
        );

    }



    // DELETE

    @Delete(':id')
    remove(
        @Param('id') id: string
    ) {

        return this.service.remove(id);

    }


}