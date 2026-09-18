import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
} from '@nestjs/common';

import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('categories')
export class CategoriesController {
    constructor(private readonly service: CategoriesService) { }

    @Get()
    @Permissions('canViewCategories')
    findAll() {
        return this.service.findAll();
    }

    @Get(':id')
    @Permissions('canViewCategories')
    findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }

    @Post()
    @Permissions('canCreateCategories')
    create(@Body() dto: CreateCategoryDto) {
        return this.service.create(dto);
    }

    @Put(':id')
    @Permissions('canEditCategories')
    update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
        return this.service.update(id, dto);
    }

    @Delete(':id')
    @Permissions('canDeleteCategories')
    remove(@Param('id') id: string) {
        return this.service.remove(id);
    }
}