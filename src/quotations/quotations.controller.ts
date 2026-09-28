import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Quotations')
@ApiBearerAuth('JWT-auth')
@Controller('quotations')
export class QuotationsController {
    constructor(private readonly service: QuotationsService) { }

    @Post()
    @Permissions('canCreateSales')
    @ApiOperation({ summary: 'Create a quotation' })
    async create(@Body() dto: CreateQuotationDto) {
        return this.service.create(dto);
    }

    @Get()
    @Permissions('canViewSales')
    @ApiOperation({ summary: 'List all quotations' })
    async findAll(@Query('status') status?: string) {
        return this.service.findAll(status);
    }

    @Get(':id')
    @Permissions('canViewSales')
    @ApiOperation({ summary: 'Get quotation detail' })
    async findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }

    @Put(':id')
    @Permissions('canCreateSales')
    @ApiOperation({ summary: 'Update a draft quotation' })
    async update(@Param('id') id: string, @Body() dto: CreateQuotationDto) {
        return this.service.update(id, dto);
    }

    @Delete(':id')
    @Permissions('canDeleteSales')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete a draft quotation' })
    async remove(@Param('id') id: string) {
        return this.service.remove(id);
    }

    @Post(':id/cancel')
    @Permissions('canCreateSales')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cancel a quotation' })
    async cancel(@Param('id') id: string) {
        return this.service.cancel(id);
    }
}