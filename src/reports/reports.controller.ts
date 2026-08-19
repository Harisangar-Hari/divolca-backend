// src/reports/reports.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    Res,
    HttpCode,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

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
    // STOCK IN HAND REPORT
    // ============================
    @Get('stock-in-hand')
    @ApiOperation({ summary: 'Get stock in hand report' })
    @ApiResponse({ status: 200, description: 'Stock report retrieved successfully' })
    async getStockInHand() {
        return this.reportsService.getStockInHand();
    }

    // ============================
    // STOCK IN HAND WITH FILTERS
    // ============================
    @Get('stock-in-hand/filtered')
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

    // ============================
    // LOW STOCK REPORT
    // ============================
    @Get('low-stock')
    @ApiOperation({ summary: 'Get low stock items report' })
    @ApiResponse({ status: 200, description: 'Low stock report retrieved successfully' })
    async getLowStockItems() {
        return this.reportsService.getLowStockItems();
    }

    // ============================
    // STOCK VALUE SUMMARY
    // ============================
    @Get('stock-value')
    @ApiOperation({ summary: 'Get stock value summary' })
    @ApiResponse({ status: 200, description: 'Stock value summary retrieved successfully' })
    async getStockValueSummary() {
        return this.reportsService.getStockValueSummary();
    }

    // ============================
    // EXPORT STOCK TO EXCEL
    // ============================
    @Post('export/stock-excel')
    @ApiOperation({ summary: 'Export stock report to Excel' })
    @HttpCode(HttpStatus.OK)
    async exportStockToExcel(@Res() res: Response) {
        const result = await this.reportsService.exportStockToExcel();

        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.buffer);
    }

    // ============================
    // EXPORT STOCK TO PDF
    // ============================
    @Post('export/stock-pdf')
    @ApiOperation({ summary: 'Export stock report to PDF' })
    @HttpCode(HttpStatus.OK)
    async exportStockToPDF(@Res() res: Response) {
        try {
            const result = await this.reportsService.exportStockToPDF() as PDFResult;

            // Set headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.setHeader('Content-Length', result.buffer.length);
            res.setHeader('Cache-Control', 'no-cache');

            // Send the PDF buffer
            res.end(result.buffer);
        } catch (error: unknown) {
            // ✅ Type guard to handle unknown error
            console.error('PDF generation error:', error);

            // Check if error is an instance of Error
            if (error instanceof Error) {
                res.status(500).json({
                    message: 'Failed to generate PDF',
                    error: error.message,
                });
            } else {
                // Handle non-Error objects
                res.status(500).json({
                    message: 'Failed to generate PDF',
                    error: 'An unknown error occurred',
                });
            }
        }
    }

    // ============================
    // SALES REPORT
    // ============================
    @Get('sales')
    @ApiOperation({ summary: 'Get sales report' })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    @ApiQuery({ name: 'paymentMode', required: false })
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

    // ============================
    // EXPORT SALES TO EXCEL
    // ============================
    @Post('export/sales-excel')
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

    // ============================
    // CUSTOMER REPORT
    // ============================
    @Get('customers')
    @ApiOperation({ summary: 'Get customer report' })
    async getCustomerReport() {
        return this.reportsService.getCustomerReport();
    }

    // ============================
    // PURCHASE REPORT
    // ============================
    @Get('purchases')
    @ApiOperation({ summary: 'Get purchase report' })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    async getPurchaseReport(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.reportsService.getPurchaseReport({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
    }

    // ============================
    // PROFIT & LOSS REPORT
    // ============================
    @Get('profit-loss')
    @ApiOperation({ summary: 'Get profit & loss report' })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    async getProfitLossReport(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.reportsService.getProfitLossReport({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
    }
}