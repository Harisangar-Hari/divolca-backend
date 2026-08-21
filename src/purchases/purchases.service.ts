import {
    Injectable,
    BadRequestException,
    NotFoundException
} from '@nestjs/common';


import { PrismaService } from '../prisma/prisma.service';

import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { randomUUID } from 'crypto';


@Injectable()
export class PurchasesService {


    constructor(
        private prisma: PrismaService
    ) { }




    async create(dto: CreatePurchaseDto) {
        return await this.prisma.$transaction(async (tx) => {
            const supplier = await tx.suppliers.findUnique({
                where: { Id: dto.supplierId }
            });

            if (!supplier) {
                throw new BadRequestException("Supplier not found");
            }

            let total = 0;
            const purchaseItems: any[] = [];

            // ✅ Generate UUID for the internal Id
            const purchaseId = randomUUID();

            // ✅ Check if PurchaseNumber exists (if provided)
            if (dto.purchaseNumber) {
                const existing = await tx.purchases.findFirst({
                    where: { PurchaseNumber: dto.purchaseNumber }
                });

                if (existing) {
                    throw new BadRequestException(`Purchase Number "${dto.purchaseNumber}" already exists`);
                }
            }

            for (const item of dto.items) {
                const product = await tx.products.findUnique({
                    where: { Id: item.productId }
                });

                if (!product) {
                    throw new BadRequestException("Product not found");
                }

                await tx.products.update({
                    where: { Id: item.productId },
                    data: {
                        StockQty: { increment: item.quantity },
                        CostPrice: item.costPrice
                    }
                });

                const lineTotal = item.quantity * item.costPrice;
                total += lineTotal;

                purchaseItems.push({
                    Id: randomUUID(),
                    ProductId: item.productId,
                    Quantity: item.quantity,
                    CostPrice: item.costPrice
                });
            }

            const purchase = await tx.purchases.create({
                data: {
                    Id: purchaseId,
                    PurchaseNumber: dto.purchaseNumber || null, // ✅ Can be null
                    InvoiceNumber: "PUR-" + Date.now(),
                    SupplierId: dto.supplierId,
                    PurchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
                    GrandTotal: total,
                    PaidAmount: 0,

                    BalanceAmount: total,
                    Status: 0,
                    PurchaseItems: {
                        create: purchaseItems
                    }
                },
                include: {
                    Suppliers: true
                }
            });

            return {
                Id: purchase.Id,
                PurchaseNumber: purchase.PurchaseNumber,
                InvoiceNumber: purchase.InvoiceNumber,
                GrandTotal: purchase.GrandTotal,
                PaidAmount: purchase.PaidAmount,
                BalanceAmount: purchase.BalanceAmount,
                supplierName: supplier.Name
            };
        });
    }





    async findAll() {


        return await this.prisma.purchases.findMany({

            orderBy: {
                PurchaseDate: 'desc'
            },


            include: {


                Suppliers: true,


                _count: {


                    select: {
                        PurchaseItems: true
                    }


                }


            }


        });



    }





    async findOne(id: string) {

        const purchase =
            await this.prisma.purchases.findUnique({

                where: {
                    Id: id
                },

                include: {

                    Suppliers: true,

                    PurchaseItems: {

                        include: {
                            Products: true
                        }

                    }

                }

            });


        if (!purchase) {

            throw new NotFoundException(
                "Purchase not found"
            );

        }


        return {

            Id: purchase.Id,

            InvoiceNumber: purchase.InvoiceNumber,

            GrandTotal: purchase.GrandTotal,

            PaidAmount: purchase.PaidAmount,

            BalanceAmount: purchase.BalanceAmount,
            purchaseNumber: purchase.PurchaseNumber,

            PurchaseDate: purchase.PurchaseDate,

            Status: purchase.Status,
            supplier: purchase.Suppliers
                ? {

                    Id: purchase.Suppliers.Id,

                    Name: purchase.Suppliers.Name,

                    Phone: purchase.Suppliers.Phone,

                    Email: purchase.Suppliers.Email,

                    Address: purchase.Suppliers.Address

                }
                : null,


            items: purchase.PurchaseItems.map(item => ({

                ProductId: item.ProductId,

                productName: item.Products?.Name ?? "",

                Quantity: item.Quantity,

                CostPrice: item.CostPrice,


                lineTotal:
                    Number(item.Quantity) *
                    Number(item.CostPrice)

            }))

        };

    }

    async cancelPurchase(purchaseId: string, reason?: string) {
        return await this.prisma.$transaction(async (tx) => {
            // 1. Find the purchase
            const purchase = await tx.purchases.findUnique({
                where: { Id: purchaseId },
                include: {
                    PurchaseItems: {
                        include: {
                            Products: true
                        }
                    },
                    Suppliers: true
                }
            });

            if (!purchase) {
                throw new NotFoundException('Purchase not found');
            }

            // 2. Check if already cancelled
            if (purchase.Status === 3) { // 3 = CANCELLED
                throw new BadRequestException('Purchase is already cancelled');
            }

            // 3. Check if fully paid (if any payments made)
            if (Number(purchase.PaidAmount) > 0) {
                throw new BadRequestException('Cannot cancel a purchase that has payments made');
            }

            // 4. Restore stock quantities (deduct the stock that was added)
            for (const item of purchase.PurchaseItems) {
                await tx.products.update({
                    where: { Id: item.ProductId },
                    data: {
                        StockQty: { decrement: item.Quantity },
                    },
                });
            }

            // 5. Update purchase status to CANCELLED
            const updatedPurchase = await tx.purchases.update({
                where: { Id: purchase.Id },
                data: {
                    Status: 3, // 3 = CANCELLED
                    BalanceAmount: 0,
                },
            });

            return {
                message: `Purchase ${purchase.InvoiceNumber} cancelled successfully${reason ? ` (${reason})` : ''}`,
                purchase: {
                    Id: updatedPurchase.Id,
                    InvoiceNumber: updatedPurchase.InvoiceNumber,
                    Status: updatedPurchase.Status,
                },
            };
        }, {
            timeout: 15000,
            maxWait: 10000,
        });
    }

    // ============================
    // ✅ CANCEL PURCHASE BY INVOICE NUMBER
    // ============================
    async cancelPurchaseByInvoice(invoiceNumber: string, reason?: string) {
        const purchase = await this.prisma.purchases.findFirst({
            where: { InvoiceNumber: invoiceNumber },
        });

        if (!purchase) {
            throw new NotFoundException(`Purchase with invoice ${invoiceNumber} not found`);
        }

        return this.cancelPurchase(purchase.Id, reason);
    }

}