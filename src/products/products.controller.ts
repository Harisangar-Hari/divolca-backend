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
    HttpStatus
} from '@nestjs/common';

import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';

import {
    UploadedFile,
    UseInterceptors
} from '@nestjs/common';


import {
    FileInterceptor
} from '@nestjs/platform-express';


import {
    diskStorage
} from 'multer';


import {
    extname
} from 'path';

import {
    ApiConsumes,
    ApiBody,
    ApiOperation,
    ApiResponse
} from '@nestjs/swagger';
import { BulkImportDto } from './dto/bulk-import.dto';


@Controller('products')
export class ProductsController {


    constructor(
        private service: ProductsService
    ) { }

    @Get('name')
    search(
        @Query('search') search: string
    ) {

        return this.service.search(search);

    }

    // GET ALL

    @Get()
    findAll() {

        return this.service.findAll();

    }



    // GET BY ID

    @Get(':id')
    async findOne(
        @Param('id') id: string
    ) {

        const product =
            await this.service.findOne(id);


        if (!product)
            throw new NotFoundException();


        return product;

    }



    // CREATE

    @Post()
    create(
        @Body() dto: CreateProductDto
    ) {

        return this.service.create(dto);

    }



    // UPDATE

    @Put(':id')
    update(
        @Param('id') id: string,
        @Body() dto: CreateProductDto
    ) {

        return this.service.update(
            id,
            dto
        );

    }
     // ✅ BULK IMPORT (NEW)
    @Post('bulk-import')
    @ApiOperation({ summary: 'Bulk import products from Excel' })
    @ApiResponse({ status: 201, description: 'Products imported successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @HttpCode(HttpStatus.CREATED)
    async bulkImport(
        @Body() dto: BulkImportDto
    ) {
        return this.service.bulkImport(dto);
    }



    // DELETE

    @Delete(':id')
    remove(
        @Param('id') id: string
    ) {

        return this.service.remove(id);

    }



    // BARCODE SEARCH

    @Get('barcode/:barcode')
    findBarcode(
        @Param('barcode') barcode: string
    ) {

        return this.service.findByBarcode(barcode);

    }



    @Post('upload-image')

    @ApiConsumes('multipart/form-data')

    @ApiBody({

        schema: {

            type: 'object',

            properties: {

                image: {

                    type: 'string',

                    format: 'binary'

                }

            }

        }

    })


    @UseInterceptors(

        FileInterceptor(

            'image',

            {

                storage: diskStorage({

                    destination:
                        './uploads/products',


                    filename:
                        (req, file, callback) => {


                            const filename =
                                Date.now()
                                +
                                extname(file.originalname);


                            callback(
                                null,
                                filename
                            );


                        }


                })

            }

        )

    )


    uploadImage(

        @UploadedFile()
        file: Express.Multer.File

    ) {


        return {

            url:
                `/uploads/products/${file.filename}`

        };


    }
    



}