// src/reports/reports.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

interface StockFilterOptions {
    categoryId?: string;
    brandId?: string;
    minStock?: number;
    maxStock?: number;
    search?: string;
}

interface DateFilterOptions {
    startDate?: Date;
    endDate?: Date;
    paymentMode?: string;
}

interface PDFResult {
    buffer: Buffer;
    filename: string;
    contentType: string;
}


@Injectable()
export class ReportsService {
    constructor(private prisma: PrismaService) { }

    // ============================
    // STOCK IN HAND REPORT
    // ============================
    async getStockInHand() {
        const products = await this.prisma.products.findMany({
            include: {
                Categories: true,
                Brands: true,
            },
            orderBy: {
                Name: 'asc',
            },
        });

        return products.map((product) => ({
            Id: product.Id,
            Name: product.Name,
            Barcode: product.Barcode,
            SKU: product.SKU,
            StockQty: product.StockQty,
            Unit: product.Unit,
            CostPrice: product.CostPrice,
            Price: product.Price,
            ReorderLevel: product.ReorderLevel,
            Category: product.Categories?.Name || null,
            CategoryId: product.CategoryId,
            Brand: product.Brands?.Name || null,
            BrandId: product.BrandId,
            Amount: Number(product.CostPrice) * product.StockQty,
            Status: product.StockQty <= product.ReorderLevel ? 'LOW_STOCK' : 'OK',
        }));
    }

    // ============================
    // STOCK IN HAND WITH FILTERS
    // ============================
    async getStockInHandFiltered(options: StockFilterOptions) {
        const where: Prisma.ProductsWhereInput = {};

        if (options.categoryId) {
            where.CategoryId = options.categoryId;
        }

        if (options.brandId) {
            where.BrandId = options.brandId;
        }

        // ✅ FIXED: Properly build the StockQty filter
        const stockFilter: Prisma.IntFilter = {};

        if (options.minStock !== undefined) {
            stockFilter.gte = options.minStock;
        }

        if (options.maxStock !== undefined) {
            stockFilter.lte = options.maxStock;
        }

        if (Object.keys(stockFilter).length > 0) {
            where.StockQty = stockFilter;
        }

        if (options.search) {
            where.OR = [
                { Name: { contains: options.search, mode: 'insensitive' } },
                { Barcode: { contains: options.search } },
                { SKU: { contains: options.search, mode: 'insensitive' } },
            ];
        }

        const products = await this.prisma.products.findMany({
            where,
            include: {
                Categories: true,
                Brands: true,
            },
            orderBy: {
                Name: 'asc',
            },
        });

        return products.map((product) => ({
            Id: product.Id,
            Name: product.Name,
            Barcode: product.Barcode,
            SKU: product.SKU,
            StockQty: product.StockQty,
            Unit: product.Unit,
            CostPrice: product.CostPrice,
            Price: product.Price,
            ReorderLevel: product.ReorderLevel,
            Category: product.Categories?.Name || null,
            Brand: product.Brands?.Name || null,
            Amount: Number(product.CostPrice) * product.StockQty,
            Status: product.StockQty <= product.ReorderLevel ? 'LOW_STOCK' : 'OK',
        }));
    }

    // ============================
    // LOW STOCK REPORT
    // ============================
    async getLowStockItems() {
        const products = await this.prisma.products.findMany({
            where: {
                StockQty: {
                    lte: this.prisma.products.fields.ReorderLevel,
                },
            },
            include: {
                Categories: true,
                Brands: true,
            },
            orderBy: {
                Name: 'asc',
            },
        });

        return products.map((product) => ({
            Id: product.Id,
            Name: product.Name,
            Barcode: product.Barcode,
            SKU: product.SKU,
            StockQty: product.StockQty,
            ReorderLevel: product.ReorderLevel,
            Unit: product.Unit,
            CostPrice: product.CostPrice,
            Price: product.Price,
            Category: product.Categories?.Name || null,
            Brand: product.Brands?.Name || null,
            NeedToOrder: product.ReorderLevel - product.StockQty,
            Amount: Number(product.CostPrice) * product.StockQty,
        }));
    }

    // ============================
    // STOCK VALUE SUMMARY
    // ============================
    async getStockValueSummary() {
        const products = await this.prisma.products.findMany({
            select: {
                StockQty: true,
                CostPrice: true,
                Price: true,
                Categories: {
                    select: {
                        Name: true,
                    },
                },
                Brands: {
                    select: {
                        Name: true,
                    },
                },
            },
        });

        let totalQuantity = 0;
        let totalCostValue = 0;
        let totalSellingValue = 0;

        const categorySummary: Record<string, { quantity: number; costValue: number; sellingValue: number }> = {};
        const brandSummary: Record<string, { quantity: number; costValue: number; sellingValue: number }> = {};

        products.forEach((product) => {
            const qty = product.StockQty || 0;
            const costValue = Number(product.CostPrice || 0) * qty;
            const sellingValue = Number(product.Price || 0) * qty;

            totalQuantity += qty;
            totalCostValue += costValue;
            totalSellingValue += sellingValue;

            const categoryName = product.Categories?.Name || 'Uncategorized';
            if (!categorySummary[categoryName]) {
                categorySummary[categoryName] = { quantity: 0, costValue: 0, sellingValue: 0 };
            }
            categorySummary[categoryName].quantity += qty;
            categorySummary[categoryName].costValue += costValue;
            categorySummary[categoryName].sellingValue += sellingValue;

            const brandName = product.Brands?.Name || 'Unbranded';
            if (!brandSummary[brandName]) {
                brandSummary[brandName] = { quantity: 0, costValue: 0, sellingValue: 0 };
            }
            brandSummary[brandName].quantity += qty;
            brandSummary[brandName].costValue += costValue;
            brandSummary[brandName].sellingValue += sellingValue;
        });

        return {
            total: {
                quantity: totalQuantity,
                costValue: totalCostValue,
                sellingValue: totalSellingValue,
                profitMargin: totalCostValue > 0 ? ((totalSellingValue - totalCostValue) / totalCostValue) * 100 : 0,
            },
            byCategory: Object.entries(categorySummary).map(([name, data]) => ({
                name,
                ...data,
                profitMargin: data.costValue > 0 ? ((data.sellingValue - data.costValue) / data.costValue) * 100 : 0,
            })),
            byBrand: Object.entries(brandSummary).map(([name, data]) => ({
                name,
                ...data,
                profitMargin: data.costValue > 0 ? ((data.sellingValue - data.costValue) / data.costValue) * 100 : 0,
            })),
        };
    }

    // ============================
    // EXPORT STOCK TO EXCEL
    // ============================
    async exportStockToExcel() {
        const products = await this.getStockInHand();

        const excelData = products.map((product) => ({
            'Item Name': product.Name,
            Barcode: product.Barcode,
            SKU: product.SKU,
            Category: product.Category || '-',
            Brand: product.Brand || '-',
            Quantity: product.StockQty,
            Unit: product.Unit,
            'Cost Price (LKR)': Number(product.CostPrice).toFixed(2),
            'Selling Price (LKR)': Number(product.Price).toFixed(2),
            'Total Value (LKR)': Number(product.Amount).toFixed(2),
            'Reorder Level': product.ReorderLevel,
            Status: product.Status === 'LOW_STOCK' ? '⚠️ Low Stock' : '✅ OK',
        }));

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Stock In Hand');

        const colWidths = [
            { wch: 30 },
            { wch: 20 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
            { wch: 10 },
            { wch: 8 },
            { wch: 18 },
            { wch: 18 },
            { wch: 20 },
            { wch: 15 },
            { wch: 15 },
        ];
        ws['!cols'] = colWidths;

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return {
            buffer,
            filename: `Stock_In_Hand_${new Date().toISOString().split('T')[0]}.xlsx`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
    }

    // ============================
    // EXPORT STOCK TO PDF
    // ============================
    // src/reports/reports.service.ts - Complete working PDF generation

    async exportStockToPDF(): Promise<PDFResult> {
        const products = await this.getStockInHand();

        // ✅ Import pdfkit with require (more reliable)
        const PDFDocument = require('pdfkit');

        // Create a new PDF document
        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margins: { top: 30, bottom: 30, left: 30, right: 30 }
        });

        // Create a promise to handle the PDF generation
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];

            // Collect PDF data chunks
            doc.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            // When PDF is complete
            doc.on('end', () => {
                try {
                    const pdfBuffer = Buffer.concat(chunks);

                    // Validate the PDF
                    if (pdfBuffer.length === 0) {
                        reject(new Error('Generated PDF is empty'));
                        return;
                    }

                    // Check if it's a valid PDF (starts with %PDF)
                    const pdfHeader = pdfBuffer.slice(0, 4).toString();
                    if (pdfHeader !== '%PDF') {
                        reject(new Error('Invalid PDF format'));
                        return;
                    }

                    resolve({
                        buffer: pdfBuffer,
                        filename: `Stock_In_Hand_${new Date().toISOString().split('T')[0]}.pdf`,
                        contentType: 'application/pdf',
                    });
                } catch (error) {
                    reject(error);
                }
            });

            doc.on('error', (error: any) => {
                reject(error);
            });

            try {
                // ============================
                // Build the PDF Content
                // ============================

                // Header
                doc.fontSize(20);
                doc.font('Helvetica-Bold');
                doc.fillColor('#0B6E4F');
                doc.text('Stock In Hand Report', { align: 'center' });
                doc.moveDown(0.5);

                // Date
                doc.fontSize(10);
                doc.font('Helvetica');
                doc.fillColor('#666666');
                const now = new Date();
                const dateStr = now.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                doc.text(`Generated: ${dateStr}`, { align: 'center' });
                doc.moveDown(1);

                // Summary
                const totalItems = products.length;
                const totalQuantity = products.reduce((sum, p) => sum + (p.StockQty || 0), 0);
                const totalValue = products.reduce((sum, p) => sum + Number(p.Amount || 0), 0);
                const lowStockItems = products.filter((p) => p.Status === 'LOW_STOCK').length;

                doc.fontSize(10);
                doc.font('Helvetica');
                doc.fillColor('#000000');
                doc.text(`Total Items: ${totalItems}`, 30, doc.y);
                doc.text(`Total Quantity: ${totalQuantity}`, 200, doc.y - 12);
                doc.text(`Total Value: LKR ${totalValue.toFixed(2)}`, 370, doc.y - 12);
                doc.text(`Low Stock Items: ${lowStockItems}`, 540, doc.y - 12);
                doc.moveDown(1);

                // Table Headers
                const startX = 30;
                let currentY = doc.y + 10;
                const rowHeight = 18;
                const colWidths = {
                    name: 70,
                    barcode: 45,
                    sku: 40,
                    qty: 25,
                    unit: 25,
                    costPrice: 35,
                    sellPrice: 35,
                    totalValue: 40,
                    status: 30,
                };

                // Calculate table width
                const tableWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);
                const xStart = (doc.page.width - tableWidth) / 2;

                // Draw header background
                let xPos = xStart;
                doc.rect(xStart, currentY, tableWidth, rowHeight)
                    .fill('#0B6E4F');

                // Header text
                doc.fontSize(8);
                doc.font('Helvetica-Bold');
                doc.fillColor('#FFFFFF');

                const headers = [
                    { text: 'Item Name', width: colWidths.name },
                    { text: 'Barcode', width: colWidths.barcode },
                    { text: 'SKU', width: colWidths.sku },
                    { text: 'QTY', width: colWidths.qty },
                    { text: 'Unit', width: colWidths.unit },
                    { text: 'Cost Price', width: colWidths.costPrice },
                    { text: 'Sell Price', width: colWidths.sellPrice },
                    { text: 'Total Value', width: colWidths.totalValue },
                    { text: 'Status', width: colWidths.status },
                ];

                xPos = xStart;
                headers.forEach((header) => {
                    doc.text(header.text, xPos + 3, currentY + 4, {
                        width: header.width - 6,
                        align: 'center'
                    });
                    xPos += header.width;
                });

                currentY += rowHeight;

                // Draw rows
                doc.fontSize(7);
                doc.font('Helvetica');
                doc.fillColor('#000000');

                products.forEach((product, index) => {
                    // Check for page break
                    if (currentY > doc.page.height - 50) {
                        doc.addPage();
                        currentY = 30;

                        // Redraw header on new page
                        doc.rect(xStart, currentY, tableWidth, rowHeight)
                            .fill('#0B6E4F');
                        doc.fontSize(8);
                        doc.font('Helvetica-Bold');
                        doc.fillColor('#FFFFFF');

                        xPos = xStart;
                        headers.forEach((header) => {
                            doc.text(header.text, xPos + 3, currentY + 4, {
                                width: header.width - 6,
                                align: 'center'
                            });
                            xPos += header.width;
                        });

                        currentY += rowHeight;
                        doc.fontSize(7);
                        doc.font('Helvetica');
                        doc.fillColor('#000000');
                    }

                    // Alternating row colors
                    if (index % 2 === 0) {
                        doc.rect(xStart, currentY, tableWidth, rowHeight)
                            .fill('#F3F4F6');
                    }

                    // Row data
                    const rowData = [
                        { text: product.Name || '-', width: colWidths.name, align: 'left' },
                        { text: product.Barcode || '-', width: colWidths.barcode, align: 'center' },
                        { text: product.SKU || '-', width: colWidths.sku, align: 'center' },
                        { text: String(product.StockQty || 0), width: colWidths.qty, align: 'center' },
                        { text: product.Unit || 'pcs', width: colWidths.unit, align: 'center' },
                        { text: `LKR ${Number(product.CostPrice || 0).toFixed(2)}`, width: colWidths.costPrice, align: 'right' },
                        { text: `LKR ${Number(product.Price || 0).toFixed(2)}`, width: colWidths.sellPrice, align: 'right' },
                        { text: `LKR ${Number(product.Amount || 0).toFixed(2)}`, width: colWidths.totalValue, align: 'right' },
                        { text: product.Status === 'LOW_STOCK' ? '⚠️ Low' : '✅ OK', width: colWidths.status, align: 'center' },
                    ];

                    doc.fillColor('#000000');
                    xPos = xStart;
                    rowData.forEach((cell) => {
                        doc.text(cell.text, xPos + 3, currentY + 3, {
                            width: cell.width - 6,
                            align: cell.align as any
                        });
                        xPos += cell.width;
                    });

                    currentY += rowHeight;
                });

                // Draw table border
                doc.rect(xStart, doc.y - currentY + 1, tableWidth, currentY - (doc.y - currentY + 1))
                    .stroke();

                // Footer
                const pageCount = doc.bufferedPageRange().count;
                doc.fontSize(8);
                doc.font('Helvetica');
                doc.fillColor('#999999');
                doc.text(
                    `Generated by Karrali POS | Page 1 of ${pageCount}`,
                    doc.page.width / 2,
                    doc.page.height - 20,
                    { align: 'center' }
                );

                // Finalize the PDF
                doc.end();

            } catch (error) {
                reject(error);
            }
        });
    }
    // ============================
    // SALES REPORT
    // ============================
    async getSalesReport(filters: DateFilterOptions) {
        const where: Prisma.SalesWhereInput = {};

        // ✅ Build CreatedAt filter properly
        const createdAtFilter: Prisma.DateTimeFilter = {};

        if (filters.startDate) {
            createdAtFilter.gte = filters.startDate;
        }

        if (filters.endDate) {
            createdAtFilter.lte = filters.endDate;
        }

        if (Object.keys(createdAtFilter).length > 0) {
            where.CreatedAt = createdAtFilter;
        }

        if (filters.paymentMode) {
            where.paymentMode = filters.paymentMode;
        }

        const sales = await this.prisma.sales.findMany({
            where,
            include: {
                Customers: true,
                SaleItems: {
                    include: {
                        Products: true,
                    },
                },
                SalePayments: true,
            },
            orderBy: {
                CreatedAt: 'desc',
            },
        });

        return sales.map((sale) => ({
            Id: sale.Id,
            InvoiceNumber: sale.InvoiceNumber,
            TotalAmount: sale.TotalAmount,
            PaidAmount: sale.PaidAmount,
            BalanceAmount: sale.BalanceAmount,
            PaymentMode: sale.paymentMode,
            IsCreditSale: sale.IsCreditSale,
            CreatedAt: sale.CreatedAt,
            CustomerName: sale.Customers?.Name || 'Walk-in Customer',
            CustomerPhone: sale.Customers?.Phone || '',
            Items: sale.SaleItems.map((item) => ({
                Name: item.Products.Name,
                Quantity: item.Quantity,
                UnitPrice: item.UnitPrice,
                Total: item.Total,
                Discount: item.Discount,
            })),
            TotalItems: sale.SaleItems.length,
        }));
    }

    // ============================
    // EXPORT SALES TO EXCEL
    // ============================
    async exportSalesToExcel(filters: DateFilterOptions) {
        const sales = await this.getSalesReport(filters);

        const excelData = sales.map((sale) => ({
            'Invoice No': sale.InvoiceNumber,
            Date: sale.CreatedAt.toLocaleString(),
            Customer: sale.CustomerName,
            'Phone': sale.CustomerPhone,
            'Total Amount (LKR)': Number(sale.TotalAmount).toFixed(2),
            'Paid Amount (LKR)': Number(sale.PaidAmount).toFixed(2),
            'Balance (LKR)': Number(sale.BalanceAmount).toFixed(2),
            'Payment Mode': sale.PaymentMode.toUpperCase(),
            'Credit Sale': sale.IsCreditSale ? 'Yes' : 'No',
            'Items': sale.TotalItems,
        }));

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');

        const colWidths = [
            { wch: 20 },
            { wch: 20 },
            { wch: 25 },
            { wch: 15 },
            { wch: 18 },
            { wch: 18 },
            { wch: 18 },
            { wch: 15 },
            { wch: 12 },
            { wch: 10 },
        ];
        ws['!cols'] = colWidths;

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return {
            buffer,
            filename: `Sales_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
    }

    // ============================
    // CUSTOMER REPORT
    // ============================
    async getCustomerReport() {
        const customers = await this.prisma.customers.findMany({
            include: {
                Sales: true,
            },
            orderBy: {
                CreatedAt: 'desc',
            },
        });

        return customers.map((customer) => ({
            Id: customer.Id,
            Name: customer.Name,
            Phone: customer.Phone,
            Email: customer.Email,
            Address: customer.Address,
            CustomerType: customer.CustomerType,
            CreditBalance: customer.CreditBalance,
            CreditLimit: customer.CreditLimit,
            TotalSpent: customer.TotalSpent,
            LoyaltyPoints: customer.LoyaltyPoints,
            LoyaltyTier: customer.LoyaltyTier,
            TotalInvoices: customer.Sales.length,
            TotalCredit: customer.Sales
                .filter((s) => s.IsCreditSale)
                .reduce((sum, s) => sum + Number(s.TotalAmount), 0),
            TotalPaid: customer.Sales
                .reduce((sum, s) => sum + Number(s.PaidAmount), 0),
        }));
    }

    // ============================
    // PURCHASE REPORT
    // ============================
    async getPurchaseReport(filters: DateFilterOptions) {
        const where: Prisma.PurchasesWhereInput = {};

        // ✅ Build PurchaseDate filter properly
        const purchaseDateFilter: Prisma.DateTimeFilter = {};

        if (filters.startDate) {
            purchaseDateFilter.gte = filters.startDate;
        }

        if (filters.endDate) {
            purchaseDateFilter.lte = filters.endDate;
        }

        if (Object.keys(purchaseDateFilter).length > 0) {
            where.PurchaseDate = purchaseDateFilter;
        }

        const purchases = await this.prisma.purchases.findMany({
            where,
            include: {
                Suppliers: true,
                PurchaseItems: {
                    include: {
                        Products: true,
                    },
                },
            },
            orderBy: {
                PurchaseDate: 'desc',
            },
        });

        return purchases.map((purchase) => ({
            Id: purchase.Id,
            InvoiceNumber: purchase.InvoiceNumber,
            PurchaseDate: purchase.PurchaseDate,
            GrandTotal: purchase.GrandTotal,
            PaidAmount: purchase.PaidAmount,
            BalanceAmount: purchase.BalanceAmount,
            SupplierName: purchase.Suppliers?.Name || 'Unknown',
            SupplierPhone: purchase.Suppliers?.Phone || '',
            Items: purchase.PurchaseItems.map((item) => ({
                Name: item.Products.Name,
                Quantity: item.Quantity,
                CostPrice: item.CostPrice,
                Total: Number(item.CostPrice) * item.Quantity,
            })),
            TotalItems: purchase.PurchaseItems.length,
        }));
    }

    // ============================
    // PROFIT & LOSS REPORT
    // ============================
    async getProfitLossReport(filters: DateFilterOptions) {
        const where: Prisma.SalesWhereInput = {};

        // ✅ Build CreatedAt filter properly
        const createdAtFilter: Prisma.DateTimeFilter = {};

        if (filters.startDate) {
            createdAtFilter.gte = filters.startDate;
        }

        if (filters.endDate) {
            createdAtFilter.lte = filters.endDate;
        }

        if (Object.keys(createdAtFilter).length > 0) {
            where.CreatedAt = createdAtFilter;
        }

        const sales = await this.prisma.sales.findMany({
            where,
            include: {
                SaleItems: {
                    include: {
                        Products: true,
                    },
                },
            },
        });

        let totalRevenue = 0;
        let totalCost = 0;
        let totalProfit = 0;

        sales.forEach((sale) => {
            sale.SaleItems.forEach((item) => {
                const revenue = Number(item.Total);
                const cost = Number(item.Products.CostPrice) * item.Quantity;

                totalRevenue += revenue;
                totalCost += cost;
                totalProfit += revenue - cost;
            });
        });

        const totalSales = sales.length;
        const totalCreditSales = sales.filter((s) => s.IsCreditSale).length;
        const totalCashSales = totalSales - totalCreditSales;

        return {
            summary: {
                totalSales,
                totalRevenue,
                totalCost,
                totalProfit,
                profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
                totalCreditSales,
                totalCashSales,
            },
            sales: sales.map((sale) => ({
                InvoiceNumber: sale.InvoiceNumber,
                TotalAmount: sale.TotalAmount,
                CreatedAt: sale.CreatedAt,
                IsCreditSale: sale.IsCreditSale,
                Items: sale.SaleItems.length,
            })),
        };
    }
}