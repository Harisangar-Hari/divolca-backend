import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    NotFoundException,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';

import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiConsumes, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BulkImportDto } from './dto/bulk-import.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('products')
export class ProductsController {
    constructor(private service: ProductsService) { }

    // Static routes FIRST — must be before :id
    @Get('name')
    @Permissions('canViewProducts')
    search(@Query('search') search: string) {
        return this.service.search(search);
    }

    @Get('barcode/:barcode')
    @Permissions('canViewProducts')
    findBarcode(@Param('barcode') barcode: string) {
        return this.service.findByBarcode(barcode);
    }

    @Get()
    @Permissions('canViewProducts')
    findAll() {
        return this.service.findAll();
    }

    @Get(':id')
    @Permissions('canViewProducts')
    async findOne(@Param('id') id: string) {
        const product = await this.service.findOne(id);
        if (!product) throw new NotFoundException();
        return product;
    }

    @Post()
    @Permissions('canCreateProducts')
    create(@Body() dto: CreateProductDto) {
        return this.service.create(dto);
    }

    @Put(':id')
    @Permissions('canEditProducts')
    update(@Param('id') id: string, @Body() dto: CreateProductDto) {
        return this.service.update(id, dto);
    }

    @Post('bulk-import')
    @Permissions('canCreateProducts')
    @ApiOperation({ summary: 'Bulk import products from Excel' })
    @ApiResponse({ status: 201, description: 'Products imported successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @HttpCode(HttpStatus.CREATED)
    async bulkImport(@Body() dto: BulkImportDto) {
        return this.service.bulkImport(dto);
    }

    @Delete(':id')
    @Permissions('canDeleteProducts')
    remove(@Param('id') id: string) {
        return this.service.remove(id);
    }

    @Post('upload-image')
    @Permissions('canEditProducts')
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                image: { type: 'string', format: 'binary' },
            },
        },
    })
    @UseInterceptors(
        FileInterceptor('image', {
            storage: diskStorage({
                destination: './uploads/products',
                filename: (req, file, callback) => {
                    const filename = Date.now() + extname(file.originalname);
                    callback(null, filename);
                },
            }),
        })
    )
    uploadImage(@UploadedFile() file: Express.Multer.File) {
        return { url: `/uploads/products/${file.filename}` };
    }
}