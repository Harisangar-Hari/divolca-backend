//src/suppliers/suppliers.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashLedgerService } from '../cash-ledger/cash-ledger.service';

import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PaySupplierDto } from './dto/pay-supplier.dto';


@Injectable()
export class SuppliersService {


    constructor(
        private prisma: PrismaService,
        private cashLedger: CashLedgerService
    ) { }



    // =========================
    // CREATE SUPPLIER
    // =========================

    async create(dto: CreateSupplierDto) {


        return await this.prisma.suppliers.create({

            data: {

                Id: crypto.randomUUID(),

                Name: dto.name,

                Phone: dto.phone,

                Email: dto.email,

                Address: dto.address,

                CreatedAt: new Date()

            }

        });


    }





    // =========================
    // GET ALL SUPPLIERS
    // =========================

    async findAll() {


        return await this.prisma.suppliers.findMany({

            orderBy: {
                CreatedAt: 'desc'
            }

        });


    }





    // =========================
    // GET SUPPLIER BY ID
    // =========================

    async findOne(id: string) {


        const supplier = await this.prisma.suppliers.findUnique({

            where: {
                Id: id
            },

            include: {

                Purchases: {

                    include: {
                        PurchaseItems: true
                    },

                    orderBy: {
                        PurchaseDate: 'desc'
                    }

                }

            }

        });



        if (!supplier)
            throw new NotFoundException("Supplier not found");



        return {

            Id: supplier.Id,

            Name: supplier.Name,

            Phone: supplier.Phone,

            Email: supplier.Email,

            Address: supplier.Address,

            CreatedAt: supplier.CreatedAt,


            purchases: supplier.Purchases.map(p => ({

                Id: p.Id,

                InvoiceNumber: p.InvoiceNumber,

                GrandTotal: p.GrandTotal,

                PurchaseDate: p.PurchaseDate,

                itemsCount: p.PurchaseItems.length,

                PaidAmount: p.PaidAmount,

                BalanceAmount: p.BalanceAmount

            }))

        };

    }







    // =========================
    // UPDATE SUPPLIER
    // =========================

    async update(
        id: string,
        dto: UpdateSupplierDto
    ) {


        const supplier = await this.prisma.suppliers.findUnique({

            where: {
                Id: id
            }

        });



        if (!supplier)
            throw new NotFoundException();



        return await this.prisma.suppliers.update({

            where: {
                Id: id
            },

            data: {

                Name: dto.name,

                Phone: dto.phone,

                Email: dto.email,

                Address: dto.address

            }

        });


    }






    // =========================
    // DELETE SUPPLIER
    // =========================

    async remove(id: string) {


        const supplier = await this.prisma.suppliers.findUnique({

            where: {
                Id: id
            }

        });



        if (!supplier)
            throw new NotFoundException();



        await this.prisma.suppliers.delete({

            where: {
                Id: id
            }

        });


        return {
            message: "Deleted successfully"
        };


    }







    // =========================
    // CREDIT SUMMARY
    // =========================

    async creditSummary() {


        const suppliers =
            await this.prisma.suppliers.findMany({

                include: {

                    Purchases: true

                }

            });



        return suppliers.map(s => {


            const totalPurchases =
                s.Purchases.reduce(
                    (sum, p) => sum + Number(p.GrandTotal),
                    0
                );


            const totalPaid =
                s.Purchases.reduce(
                    (sum, p) => sum + Number(p.PaidAmount),
                    0
                );


            const totalBalance =
                s.Purchases.reduce(
                    (sum, p) => sum + Number(p.BalanceAmount),
                    0
                );



            return {

                Id: s.Id,

                Name: s.Name,

                Phone: s.Phone,

                TotalPurchases: totalPurchases,

                TotalPaid: totalPaid,

                TotalBalance: totalBalance,

                ActiveInvoices:
                    s.Purchases.filter(
                        p => Number(p.BalanceAmount) > 0
                    ).length

            };


        });


    }






    // =========================
    // GET SUPPLIER INVOICES
    // =========================

    async getInvoices(id: string) {


        const supplier =
            await this.prisma.suppliers.findUnique({

                where: {
                    Id: id
                },

                include: {
                    Purchases: true
                }

            });



        if (!supplier)
            throw new NotFoundException();



        return {


            supplier: {

                Id: supplier.Id,

                Name: supplier.Name,

                Phone: supplier.Phone

            },


            invoices: supplier.Purchases.map(p => ({

                Id: p.Id,

                InvoiceNumber: p.InvoiceNumber,

                GrandTotal: p.GrandTotal,

                PaidAmount: p.PaidAmount,

                BalanceAmount:
                    Number(p.BalanceAmount) > 0
                        ? p.BalanceAmount
                        : 0,

                PurchaseDate: p.PurchaseDate

            }))


        };



    }








    // =========================
    // PAY SUPPLIER
    // =========================

    async paySupplier(dto: PaySupplierDto) {
        return await this.prisma.$transaction(
            async (tx) => {
                // 1. Load all purchases
                const purchases = await tx.purchases.findMany({
                    where: { Id: { in: dto.purchaseIds } },
                    include: { Suppliers: true },
                });

                if (purchases.length !== dto.purchaseIds.length) {
                    throw new NotFoundException('One or more purchases not found');
                }

                // 2. Validate all belong to the same supplier
                const supplierIds = new Set(purchases.map((p) => p.SupplierId));
                if (supplierIds.size > 1) {
                    throw new BadRequestException(
                        'All selected purchases must belong to the same supplier'
                    );
                }

                // 3. Validate at least one has outstanding balance
                const unpaid = purchases
                    .filter((p) => Number(p.BalanceAmount) > 0)
                    .sort(
                        (a, b) =>
                            new Date(a.PurchaseDate).getTime() -
                            new Date(b.PurchaseDate).getTime()
                    );

                if (unpaid.length === 0) {
                    throw new BadRequestException(
                        'Selected purchases have no outstanding balance'
                    );
                }

                // 4. Determine total amount
                const totalBalance = unpaid.reduce(
                    (s, p) => s + Number(p.BalanceAmount),
                    0
                );
                const totalAmount =
                    dto.amount !== undefined ? Number(dto.amount) : totalBalance;

                if (totalAmount <= 0) {
                    throw new BadRequestException('Invalid amount');
                }
                if (totalAmount > totalBalance) {
                    throw new BadRequestException(
                        `Exceeds total balance. Max: ${totalBalance}`
                    );
                }

                // 5. Cheque validation
                if (dto.paymentMethod === 'Cheque') {
                    if (!dto.chequeNumber) {
                        throw new BadRequestException(
                            'Cheque number is required'
                        );
                    }
                    if (!dto.chequeDate) {
                        throw new BadRequestException('Cheque date is required');
                    }
                }

                // 6. Allocate amount FIFO across purchases
                let remaining = totalAmount;
                const allocations: Array<{
                    purchase: (typeof unpaid)[number];
                    amount: number;
                }> = [];

                for (const purchase of unpaid) {
                    if (remaining <= 0) break;
                    const pay = Math.min(
                        Number(purchase.BalanceAmount),
                        remaining
                    );
                    allocations.push({ purchase, amount: pay });
                    remaining -= pay;
                }

                // 7. Update each purchase + create one SupplierPayments row per purchase
                const paymentResults: Array<{
                    purchaseId: string;
                    invoiceNumber: string;
                    amount: number;
                    newPaidAmount: number;
                    newBalanceAmount: number;
                    paymentId: string;
                }> = [];

                for (const { purchase, amount } of allocations) {
                    const updatedPurchase = await tx.purchases.update({
                        where: { Id: purchase.Id },
                        data: {
                            PaidAmount: { increment: amount },
                            BalanceAmount: { decrement: amount },
                        },
                    });

                    const payment = await tx.supplierPayments.create({
                        data: {
                            Id: crypto.randomUUID(),
                            PurchaseId: purchase.Id,
                            Amount: amount,
                            PaymentMethod: dto.paymentMethod,
                            PaidAt: new Date(),
                            Status:
                                dto.paymentMethod === 'Cash'
                                    ? 'Cleared'
                                    : 'Pending',
                            ChequeNumber:
                                dto.paymentMethod === 'Cheque'
                                    ? dto.chequeNumber
                                    : null,
                            ChequeDate:
                                dto.paymentMethod === 'Cheque' && dto.chequeDate
                                    ? new Date(dto.chequeDate)
                                    : null,
                            Notes: dto.notes || null,
                        },
                    });

                    paymentResults.push({
                        purchaseId: purchase.Id,
                        invoiceNumber: purchase.InvoiceNumber,
                        amount,
                        newPaidAmount: Number(updatedPurchase.PaidAmount),
                        newBalanceAmount: Number(updatedPurchase.BalanceAmount),
                        paymentId: payment.Id,
                    });
                }

                // 8. Cash ledger — single entry for total (cash only)
                if (dto.paymentMethod === 'Cash') {
                    const reference =
                        allocations.length === 1
                            ? allocations[0].purchase.InvoiceNumber
                            : `${allocations.length} purchases`;

                    await this.cashLedger.add(
                        'OUT',
                        totalAmount,
                        'SUPPLIER_PAYMENT',
                        reference,
                        `Cash payment to supplier for ${reference}`
                    );
                }

                return {
                    message:
                        dto.paymentMethod === 'Cheque'
                            ? `Cheque recorded for ${allocations.length} purchase(s) — awaiting clearance`
                            : `Cash payment recorded for ${allocations.length} purchase(s)`,
                    totalAmount,
                    purchasesPaid: allocations.length,
                    status:
                        dto.paymentMethod === 'Cash' ? 'Cleared' : 'Pending',
                    chequeNumber: dto.chequeNumber || null,
                    chequeDate: dto.chequeDate || null,
                    payments: paymentResults,
                };
            },
            {
                timeout: 30000,
                maxWait: 15000,
            }
        );
    }






    // =========================
    // SUPPLIER LEDGER
    // =========================

    async getLedger(id: string) {



        const supplier =
            await this.prisma.suppliers.findUnique({

                where: {
                    Id: id
                },

                include: {
                    Purchases: true
                }


            });



        if (!supplier)
            throw new NotFoundException();



        const payments =
            await this.prisma.supplierPayments.findMany({

                where: {

                    Purchases: {
                        SupplierId: id
                    }

                },

                include: {

                    Purchases: {

                        select: {

                            InvoiceNumber: true

                        }

                    }

                },

                orderBy: {

                    PaidAt: 'desc'

                }


            });




        return {


            supplier: {

                Id: supplier.Id,

                Name: supplier.Name,

                Phone: supplier.Phone

            },


            summary: {


                totalPurchases:
                    supplier.Purchases.reduce(
                        (sum, p) => sum + Number(p.GrandTotal), 0
                    ),


                totalPaid:
                    supplier.Purchases.reduce(
                        (sum, p) => sum + Number(p.PaidAmount), 0
                    ),


                totalOutstanding:
                    supplier.Purchases.reduce(
                        (sum, p) => sum + Number(p.BalanceAmount), 0
                    )

            },


            invoices: supplier.Purchases,


            payments


        };



    }







    // =========================
    // CLEAR CHEQUE
    // =========================

    async clearCheque(id: string) {



        const payment =
            await this.prisma.supplierPayments.findUnique({

                where: {
                    Id: id
                },

                include: {
                    Purchases: true
                }

            });



        if (!payment)
            throw new NotFoundException();



        if (payment.Status === "Cleared")
            throw new BadRequestException(
                "Already cleared"
            );



        await this.prisma.supplierPayments.update({

            where: {
                Id: id
            },

            data: {


                Status: "Cleared",

                ClearedAt: new Date()


            }

        });





        if (!payment.CashLedgerPosted) {


            await this.cashLedger.add(

                "OUT",

                Number(payment.Amount),

                "CHEQUE_CLEARED",

                payment.Purchases.InvoiceNumber,

                `Cheque cleared ${payment.ChequeNumber}`

            );



            await this.prisma.supplierPayments.update({

                where: {
                    Id: id
                },

                data: {

                    CashLedgerPosted: true

                }


            });


        }




        return {


            Id: id,

            Status: "Cleared",

            ClearedAt: new Date()


        };



    }

    async clearChequeByNumber(chequeNumber: string) {
        return await this.prisma.$transaction(async (tx) => {
            const rows = await tx.supplierPayments.findMany({
                where: {
                    ChequeNumber: chequeNumber,
                    PaymentMethod: 'Cheque',
                },
                include: { Purchases: true },
            });

            if (rows.length === 0) {
                throw new NotFoundException(
                    `No cheque payments found with number ${chequeNumber}`
                );
            }

            const pending = rows.filter((r) => r.Status !== 'Cleared');
            if (pending.length === 0) {
                throw new BadRequestException('Cheque already cleared');
            }

            let totalCleared = 0;

            for (const row of pending) {
                const amount = Number(row.Amount);
                totalCleared += amount;

                await tx.supplierPayments.update({
                    where: { Id: row.Id },
                    data: { Status: 'Cleared', ClearedAt: new Date() },
                });

                if (!row.CashLedgerPosted) {
                    await this.cashLedger.add(
                        'OUT',
                        amount,
                        'SUPPLIER_CHEQUE_CLEAR',
                        row.Purchases.InvoiceNumber,
                        `Cheque cleared for ${row.Purchases.InvoiceNumber} (Cheque #${chequeNumber})`
                    );

                    await tx.supplierPayments.update({
                        where: { Id: row.Id },
                        data: { CashLedgerPosted: true },
                    });
                }
            }

            return {
                chequeNumber,
                rowsCleared: pending.length,
                totalCleared,
                message: `Cheque cleared — Rs ${totalCleared} posted across ${pending.length} purchase(s)`,
            };
        });
    }



    // =========================
    // BOUNCE CHEQUE BY NUMBER (multi-invoice)
    // =========================
    async bounceChequeByNumber(chequeNumber: string, reason?: string) {
        return await this.prisma.$transaction(
            async (tx) => {
                const rows = await tx.supplierPayments.findMany({
                    where: {
                        ChequeNumber: chequeNumber,
                        PaymentMethod: 'Cheque',
                    },
                    include: { Purchases: true },
                });

                if (rows.length === 0) {
                    throw new NotFoundException(
                        `No cheque payments found with number ${chequeNumber}`
                    );
                }

                const cleared = rows.filter((r) => r.Status === 'Cleared');
                if (cleared.length > 0) {
                    throw new BadRequestException(
                        'Cannot bounce a cleared cheque'
                    );
                }

                const alreadyBounced = rows.filter((r) => r.Status === 'Bounced');
                if (alreadyBounced.length === rows.length) {
                    throw new BadRequestException(
                        'Cheque already marked as bounced'
                    );
                }

                const pending = rows.filter((r) => r.Status !== 'Bounced');

                let totalReversed = 0;

                for (const row of pending) {
                    const amount = Number(row.Amount);
                    totalReversed += amount;

                    // 1. Reverse the purchase balance
                    await tx.purchases.update({
                        where: { Id: row.PurchaseId },
                        data: {
                            PaidAmount: { decrement: amount },
                            BalanceAmount: { increment: amount },
                        },
                    });

                    // 2. Mark the payment row as bounced
                    const combinedNotes = reason
                        ? `${row.Notes || ''} | BOUNCED: ${reason}`.trim()
                        : `${row.Notes || ''} | BOUNCED`.trim();

                    await tx.supplierPayments.update({
                        where: { Id: row.Id },
                        data: {
                            Status: 'Bounced',
                            ClearedAt: null,
                            Notes: combinedNotes,
                        },
                    });
                }

                return {
                    chequeNumber,
                    rowsBounced: pending.length,
                    totalReversed,
                    message: `Cheque bounced — Rs ${totalReversed} re-added to supplier outstanding across ${pending.length} purchase(s)`,
                };
            },
            {
                timeout: 30000,
                maxWait: 15000,
            }
        );
    }


}