import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class QuotationsService {
    constructor(private prisma: PrismaService) { }

    // ============================
    // CREATE
    // ============================
    async create(dto: CreateQuotationDto) {
        return await this.prisma.$transaction(
            async (tx) => {
                if (!dto.items || dto.items.length === 0) {
                    throw new BadRequestException(
                        'Quotation must have at least one item'
                    );
                }

                // Optional customer lookup
                let customerName = dto.customerName || null;
                let customerPhone = dto.customerPhone || null;

                if (dto.customerId) {
                    const customer = await tx.customers.findUnique({
                        where: { Id: dto.customerId },
                    });
                    if (!customer) {
                        throw new NotFoundException('Customer not found');
                    }
                    customerName = customerName || customer.Name;
                    customerPhone = customerPhone || customer.Phone;
                }

                // Compute line items + totals
                let subTotal = 0;
                let afterItemDiscount = 0;
                const itemsToCreate: any[] = [];

                for (const item of dto.items) {
                    const product = await tx.products.findUnique({
                        where: { Id: item.productId },
                    });
                    if (!product) {
                        throw new BadRequestException(
                            `Product ${item.productId} not found`
                        );
                    }

                    const unitPrice = Number(product.Price);
                    const qty = item.quantity;
                    const perUnitDiscount = item.discount ?? 0;
                    const totalItemDiscount = perUnitDiscount * qty;
                    const lineTotal = unitPrice * qty - totalItemDiscount;

                    subTotal += unitPrice * qty;
                    afterItemDiscount += lineTotal;

                    itemsToCreate.push({
                        Id: randomUUID(),
                        ProductId: item.productId,
                        Quantity: qty,
                        UnitPrice: unitPrice,
                        Discount: totalItemDiscount,
                        Total: lineTotal,
                    });
                }

                const invoiceDiscount = Math.max(0, dto.invoiceDiscount ?? 0);
                const totalAmount = Math.max(
                    0,
                    afterItemDiscount - invoiceDiscount
                );

                // Create with placeholder, then update to final number
                const quotationId = randomUUID();
                const created = await tx.quotations.create({
                    data: {
                        Id: quotationId,
                        QuotationNumber: `TEMP-${quotationId}`,
                        CustomerId: dto.customerId || null,
                        CustomerName: customerName,
                        CustomerPhone: customerPhone,
                        Notes: dto.notes || null,
                        SubTotal: subTotal,
                        InvoiceDiscount: invoiceDiscount,
                        TotalAmount: totalAmount,
                        Status: 'draft',
                        QuotationItems: {
                            create: itemsToCreate,
                        },
                    },
                });

                const formatted = `QTN-${String(created.Sequence).padStart(4, '0')}`;

                const final = await tx.quotations.update({
                    where: { Id: quotationId },
                    data: { QuotationNumber: formatted },
                    include: {
                        Customers: true,
                        QuotationItems: { include: { Products: true } },
                    },
                });

                return this.formatOne(final);
            },
            { timeout: 30000, maxWait: 15000 }
        );
    }

    // ============================
    // GET ALL
    // ============================
    async findAll(status?: string) {
        const where: any = {};
        if (status) where.Status = status;

        const quotes = await this.prisma.quotations.findMany({
            where,
            include: {
                Customers: true,
                QuotationItems: true,
            },
            orderBy: { CreatedAt: 'desc' },
        });

        return quotes.map((q) => this.formatList(q));
    }

    // ============================
    // GET ONE
    // ============================
    async findOne(id: string) {
        const quote = await this.prisma.quotations.findUnique({
            where: { Id: id },
            include: {
                Customers: true,
                QuotationItems: { include: { Products: true } },
            },
        });

        if (!quote) throw new NotFoundException('Quotation not found');
        return this.formatOne(quote);
    }

    // ============================
    // UPDATE (draft only)
    // ============================
    async update(id: string, dto: CreateQuotationDto) {
        return await this.prisma.$transaction(
            async (tx) => {
                const existing = await tx.quotations.findUnique({
                    where: { Id: id },
                });
                if (!existing) {
                    throw new NotFoundException('Quotation not found');
                }
                if (existing.Status !== 'draft') {
                    throw new BadRequestException(
                        'Only draft quotations can be edited'
                    );
                }

                if (!dto.items || dto.items.length === 0) {
                    throw new BadRequestException(
                        'Quotation must have at least one item'
                    );
                }

                let customerName = dto.customerName || null;
                let customerPhone = dto.customerPhone || null;
                if (dto.customerId) {
                    const customer = await tx.customers.findUnique({
                        where: { Id: dto.customerId },
                    });
                    if (customer) {
                        customerName = customerName || customer.Name;
                        customerPhone = customerPhone || customer.Phone;
                    }
                }

                // Recompute
                let subTotal = 0;
                let afterItemDiscount = 0;
                const itemsToCreate: any[] = [];

                for (const item of dto.items) {
                    const product = await tx.products.findUnique({
                        where: { Id: item.productId },
                    });
                    if (!product) {
                        throw new BadRequestException(
                            `Product ${item.productId} not found`
                        );
                    }
                    const unitPrice = Number(product.Price);
                    const qty = item.quantity;
                    const perUnitDiscount = item.discount ?? 0;
                    const totalItemDiscount = perUnitDiscount * qty;
                    const lineTotal = unitPrice * qty - totalItemDiscount;

                    subTotal += unitPrice * qty;
                    afterItemDiscount += lineTotal;

                    itemsToCreate.push({
                        Id: randomUUID(),
                        ProductId: item.productId,
                        Quantity: qty,
                        UnitPrice: unitPrice,
                        Discount: totalItemDiscount,
                        Total: lineTotal,
                    });
                }

                const invoiceDiscount = Math.max(0, dto.invoiceDiscount ?? 0);
                const totalAmount = Math.max(
                    0,
                    afterItemDiscount - invoiceDiscount
                );

                // Delete old items, insert new
                await tx.quotationItems.deleteMany({
                    where: { QuotationId: id },
                });

                const updated = await tx.quotations.update({
                    where: { Id: id },
                    data: {
                        CustomerId: dto.customerId || null,
                        CustomerName: customerName,
                        CustomerPhone: customerPhone,
                        Notes: dto.notes || null,
                        SubTotal: subTotal,
                        InvoiceDiscount: invoiceDiscount,
                        TotalAmount: totalAmount,
                        QuotationItems: {
                            create: itemsToCreate,
                        },
                    },
                    include: {
                        Customers: true,
                        QuotationItems: { include: { Products: true } },
                    },
                });

                return this.formatOne(updated);
            },
            { timeout: 30000, maxWait: 15000 }
        );
    }

    // ============================
    // DELETE (draft only)
    // ============================
    async remove(id: string) {
        const existing = await this.prisma.quotations.findUnique({
            where: { Id: id },
        });
        if (!existing) throw new NotFoundException('Quotation not found');
        if (existing.Status === 'converted') {
            throw new BadRequestException(
                'Cannot delete a converted quotation'
            );
        }

        await this.prisma.quotations.delete({ where: { Id: id } });
        return { message: 'Quotation deleted' };
    }

    // ============================
    // CANCEL (soft)
    // ============================
    async cancel(id: string) {
        const existing = await this.prisma.quotations.findUnique({
            where: { Id: id },
        });
        if (!existing) throw new NotFoundException('Quotation not found');
        if (existing.Status === 'converted') {
            throw new BadRequestException(
                'Cannot cancel a converted quotation'
            );
        }
        if (existing.Status === 'cancelled') {
            throw new BadRequestException('Already cancelled');
        }

        return this.prisma.quotations.update({
            where: { Id: id },
            data: { Status: 'cancelled' },
        });
    }

    // ============================
    // FORMATTERS
    // ============================
    private formatList(q: any) {
        return {
            Id: q.Id,
            QuotationNumber: q.QuotationNumber,
            CreatedAt: q.CreatedAt,
            UpdatedAt: q.UpdatedAt,
            CustomerId: q.CustomerId,
            CustomerName: q.CustomerName || q.Customers?.Name || 'Walk-in',
            CustomerPhone: q.CustomerPhone || q.Customers?.Phone || null,
            SubTotal: Number(q.SubTotal || 0),
            InvoiceDiscount: Number(q.InvoiceDiscount || 0),
            TotalAmount: Number(q.TotalAmount || 0),
            Status: q.Status,
            ConvertedSaleId: q.ConvertedSaleId,
            ConvertedAt: q.ConvertedAt,
            ItemsCount: q.QuotationItems?.length ?? 0,
        };
    }

    private formatOne(q: any) {
        return {
            Id: q.Id,
            QuotationNumber: q.QuotationNumber,
            CreatedAt: q.CreatedAt,
            UpdatedAt: q.UpdatedAt,
            CustomerId: q.CustomerId,
            CustomerName: q.CustomerName || q.Customers?.Name || null,
            CustomerPhone: q.CustomerPhone || q.Customers?.Phone || null,
            Customer: q.Customers
                ? {
                    Id: q.Customers.Id,
                    Name: q.Customers.Name,
                    Phone: q.Customers.Phone,
                }
                : null,
            Notes: q.Notes,
            SubTotal: Number(q.SubTotal || 0),
            InvoiceDiscount: Number(q.InvoiceDiscount || 0),
            TotalAmount: Number(q.TotalAmount || 0),
            Status: q.Status,
            ConvertedSaleId: q.ConvertedSaleId,
            ConvertedAt: q.ConvertedAt,
            Items: (q.QuotationItems || []).map((it: any) => ({
                Id: it.Id,
                ProductId: it.ProductId,
                ProductName: it.Products?.Name || 'Unknown',
                ProductBarcode: it.Products?.Barcode || null,
                Quantity: it.Quantity,
                UnitPrice: Number(it.UnitPrice || 0),
                Discount: Number(it.Discount || 0),
                Total: Number(it.Total || 0),
            })),
        };
    }
}