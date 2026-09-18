import {
    Controller,
    Get,
    Post,
    Body,
    Query,
    Res,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';

interface PDFResult {
    buffer: Buffer;
    filename: string;
    contentType: string;
}

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    // ============================
    // STOCK REPORTS
    // ============================
    @Get('stock-in-hand')
    @Permissions('canViewReports')
    @ApiOperation({ summary: 'Get stock in hand report' })
    @ApiResponse({ status: 200, description: 'Stock report retrieved successfully' })
    async getStockInHand() {
        return this.reportsService.getStockInHand();
    }

    @Get('stock-in-hand/filtered')
    @Permissions('canViewReports')
    @ApiOperation({ summary: 'Get stock in hand report with filters' })
    @ApiQuery({ name: 'categoryId', required: false })
    @ApiQuery({ name: 'brandId', required: false })
    @ApiQuery({ name: 'minStock', required: false })
    @ApiQuery({ name: 'maxStock', required: false })
    @ApiQuery({ name: 'search', required: false })
    async getStockInHandFiltered(
        @Query('categoryId') categoryId?: string,
        @Query('brandId') brandId?: string,
        @Query('minStock') minStock?: string,
        @Query('maxStock') maxStock?: string,
        @Query('search') search?: string,
    ) {
        return this.reportsService.getStockInHandFiltered({
            categoryId,
            brandId,
            minStock: minStock ? parseInt(minStock) : undefined,
            maxStock: maxStock ? parseInt(maxStock) : undefined,
            search,
        });
    }

    @Get('low-stock')
    @Permissions('canViewReports')
    @ApiOperation({ summary: 'Get low stock items report' })
    async getLowStockItems() {
        return this.reportsService.getLowStockItems();
    }

    @Get('stock-value')
    @Permissions('canViewReports')
    @ApiOperation({ summary: 'Get stock value summary' })
    async getStockValueSummary() {
        return this.reportsService.getStockValueSummary();
    }

    @Post('export/stock-excel')
    @Permissions('canExportReports')
    @ApiOperation({ summary: 'Export stock report to Excel' })
    @HttpCode(HttpStatus.OK)
    async exportStockToExcel(@Res() res: Response) {
        const result = await this.reportsService.exportStockToExcel();
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.buffer);
    }

    @Post('export/stock-pdf')
    @Permissions('canExportReports')
    @ApiOperation({ summary: 'Export stock report to PDF' })
    @HttpCode(HttpStatus.OK)
    async exportStockToPDF(@Res() res: Response) {
        try {
            const result = (await this.reportsService.exportStockToPDF()) as PDFResult;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.setHeader('Content-Length', result.buffer.length);
            res.setHeader('Cache-Control', 'no-cache');
            res.end(result.buffer);
        } catch (error: unknown) {
            console.error('PDF generation error:', error);
            if (error instanceof Error) {
                res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
            } else {
                res.status(500).json({ message: 'Failed to generate PDF', error: 'An unknown error occurred' });
            }
        }
    }

    @Get('sales')
    @Permissions('canViewReports')
    @ApiOperation({ summary: 'Get sales report' })
    async getSalesReport(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('paymentMode') paymentMode?: string,
    ) {
        return this.reportsService.getSalesReport({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            paymentMode,
        });
    }

    @Post('export/sales-excel')
    @Permissions('canExportReports')
    @ApiOperation({ summary: 'Export sales report to Excel' })
    @HttpCode(HttpStatus.OK)
    async exportSalesToExcel(
        @Body() filters: { startDate?: string; endDate?: string; paymentMode?: string },
        @Res() res: Response,
    ) {
        const result = await this.reportsService.exportSalesToExcel({
            startDate: filters.startDate ? new Date(filters.startDate) : undefined,
            endDate: filters.endDate ? new Date(filters.endDate) : undefined,
            paymentMode: filters.paymentMode,
        });
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.buffer);
    }

    @Get('customers')
    @Permissions('canViewReports')
    @ApiOperation({ summary: 'Get customer report' })
    async getCustomerReport() {
        return this.reportsService.getCustomerReport();
    }

    @Get('purchases')
    @Permissions('canViewReports')
    @ApiOperation({ summary: 'Get purchase report' })
    async getPurchaseReport(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.reportsService.getPurchaseReport({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
    }

    @Get('profit-loss')
    @Permissions('canViewReports')
    @ApiOperation({ summary: 'Get profit & loss report' })
    async getProfitLossReport(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.reportsService.getProfitLossReport({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
    }


    // ============================
    // CUSTOMER AGING ANALYSIS
    // ============================
    @Get('customer-aging')
    @Permissions('canViewReports')
    @ApiOperation({ summary: 'Get customer aging analysis (AR aging)' })
    @ApiResponse({ status: 200, description: 'Aging data retrieved successfully' })
    async getCustomerAging() {
        return this.reportsService.getCustomerAging();
    }


    // ============================
    // OUTSTANDING INVOICES (flat list)
    // ============================
    @Get('outstanding-invoices')
    @Permissions('canViewReports')
    @ApiOperation({ summary: 'Get all unpaid invoices (flat list)' })
    @ApiResponse({ status: 200, description: 'Outstanding invoices retrieved' })
    async getOutstandingInvoices() {
        return this.reportsService.getOutstandingInvoices();
    }
}