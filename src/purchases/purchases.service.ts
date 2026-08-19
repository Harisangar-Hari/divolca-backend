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



}