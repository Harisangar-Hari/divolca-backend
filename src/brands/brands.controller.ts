import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
} from '@nestjs/common';

import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('brands')
export class BrandsController {
    constructor(private readonly brandsService: BrandsService) { }

    @Get()
    @Permissions('canViewProducts')
    findAll() {
        return this.brandsService.findAll();
    }

    @Get(':id')
    @Permissions('canViewProducts')
    findOne(@Param('id') id: string) {
        return this.brandsService.findOne(id);
    }

    @Post()
    @Permissions('canCreateProducts')
    create(@Body() dto: CreateBrandDto) {
        return this.brandsService.create(dto);
    }

    @Delete(':id')
    @Permissions('canDeleteProducts')
    remove(@Param('id') id: string) {
        return this.brandsService.remove(id);
    }
}