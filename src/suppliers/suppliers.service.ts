//src/suppliers/suppliers.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashLedgerService } from '../cash-ledger/cash-ledger.service';

import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PaySupplierDto } from './dto/pay-supplier.dto';
import { randomUUID } from 'crypto';


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
        where: { Id: id },
        include: {
            Purchases: {
                include: { PurchaseItems: true },
                orderBy: { PurchaseDate: 'desc' },
            },
        },
    });

    if (!supplier) throw new NotFoundException('Supplier not found');

    return {
        Id: supplier.Id,
        Name: supplier.Name,
        Phone: supplier.Phone,
        Email: supplier.Email,
        Address: supplier.Address,
        CreatedAt: supplier.CreatedAt,

        // ✅ NEW
        AdvanceBalance: supplier.AdvanceBalance || 0,
        PendingAdvance: supplier.PendingAdvance || 0,

        purchases: supplier.Purchases.map((p) => ({
            Id: p.Id,
            InvoiceNumber: p.InvoiceNumber,
            GrandTotal: p.GrandTotal,
            PurchaseDate: p.PurchaseDate,
            itemsCount: p.PurchaseItems.length,
            PaidAmount: p.PaidAmount,
            BalanceAmount: p.BalanceAmount,
        })),
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
    // PAY SUPPLIER (FIFO + advance support)
    // =========================
    async paySupplier(dto: PaySupplierDto) {
        return await this.prisma.$transaction(
            async (tx) => {
                // 1. Resolve supplier + eligible purchases
                let supplierId: string;
                let eligiblePurchases: any[] = [];

                if (dto.purchaseIds && dto.purchaseIds.length > 0) {
                    eligiblePurchases = await tx.purchases.findMany({
                        where: {
                            Id: { in: dto.purchaseIds },
                            BalanceAmount: { gt: 0 },
                        },
                        orderBy: { PurchaseDate: 'asc' },
                    });

                    if (eligiblePurchases.length !== dto.purchaseIds.length) {
                        throw new BadRequestException(
                            'Some selected purchases are not eligible (no balance or not found)'
                        );
                    }

                    const supplierIds = new Set(
                        eligiblePurchases.map((p) => p.SupplierId)
                    );
                    if (supplierIds.size > 1) {
                        throw new BadRequestException(
                            'All selected purchases must belong to the same supplier'
                        );
                    }

                    supplierId = eligiblePurchases[0].SupplierId;
                } else if (dto.supplierId) {
                    supplierId = dto.supplierId;

                    eligiblePurchases = await tx.purchases.findMany({
                        where: {
                            SupplierId: dto.supplierId,
                            BalanceAmount: { gt: 0 },
                            Status: { not: 3 },
                        },
                        orderBy: { PurchaseDate: 'asc' },
                    });
                } else {
                    throw new BadRequestException(
                        'Either supplierId or purchaseIds is required'
                    );
                }

                // 2. Verify supplier
                const supplier = await tx.suppliers.findUnique({
                    where: { Id: supplierId },
                });
                if (!supplier) {
                    throw new NotFoundException('Supplier not found');
                }

                // 3. Total amount
                const totalBalance = eligiblePurchases.reduce(
                    (s, p) => s + Number(p.BalanceAmount),
                    0
                );
                const totalAmount =
                    dto.amount !== undefined ? Number(dto.amount) : totalBalance;

                if (totalAmount <= 0) {
                    throw new BadRequestException('Invalid amount');
                }

                // 4. Cheque validation
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

                // 5. FIFO allocation
                let remaining = totalAmount;
                const allocations: Array<{ purchase: any; amount: number }> = [];

                for (const purchase of eligiblePurchases) {
                    if (remaining <= 0) break;
                    const balance = Number(purchase.BalanceAmount);
                    const alloc = Math.min(balance, remaining);
                    allocations.push({ purchase, amount: alloc });
                    remaining -= alloc;
                }

                const advancePortion = remaining;
                const isCash = dto.paymentMethod === 'Cash';
                const chequeDate = dto.chequeDate
                    ? new Date(dto.chequeDate)
                    : null;

                // 6. Create purchase allocation rows
                const createdPayments: any[] = [];

                for (const { purchase, amount } of allocations) {
                    const payment = await tx.supplierPayments.create({
                        data: {
                            Id: randomUUID(),
                            PurchaseId: purchase.Id,
                            SupplierId: supplierId,     // ✅
                            Amount: amount,
                            PaymentMethod: dto.paymentMethod,
                            PaidAt: new Date(),
                            Status: isCash ? 'Cleared' : 'Pending',
                            ClearedAt: isCash ? new Date() : null,
                            ChequeNumber:
                                dto.paymentMethod === 'Cheque'
                                    ? dto.chequeNumber
                                    : null,
                            ChequeDate: chequeDate,
                            Notes: dto.notes || null,
                        },
                    });

                    await tx.purchases.update({
                        where: { Id: purchase.Id },
                        data: {
                            PaidAmount: { increment: amount },
                            BalanceAmount: { decrement: amount },
                        },
                    });

                    createdPayments.push({
                        PaymentId: payment.Id,
                        PurchaseId: purchase.Id,
                        InvoiceNumber: purchase.InvoiceNumber,
                        Amount: amount,
                        IsAdvance: false,
                    });
                }

                // 7. Advance portion (overpayment)
                if (advancePortion > 0) {
                    const advancePayment = await tx.supplierPayments.create({
                        data: {
                            Id: randomUUID(),
                            PurchaseId: null,
                            SupplierId: supplierId,     // ✅
                            Amount: advancePortion,
                            PaymentMethod: dto.paymentMethod,
                            PaidAt: new Date(),
                            Status: isCash ? 'Cleared' : 'Pending',
                            ClearedAt: isCash ? new Date() : null,
                            ChequeNumber:
                                dto.paymentMethod === 'Cheque'
                                    ? dto.chequeNumber
                                    : null,
                            ChequeDate: chequeDate,
                            Notes: dto.notes || 'Advance payment',
                        },
                    });

                    // Cash → immediately available advance
                    // Cheque → held as pending until cleared
                    if (isCash) {
                        await tx.suppliers.update({
                            where: { Id: supplierId },
                            data: {
                                AdvanceBalance: { increment: advancePortion },
                            },
                        });
                    } else {
                        await tx.suppliers.update({
                            where: { Id: supplierId },
                            data: {
                                PendingAdvance: { increment: advancePortion },
                            },
                        });
                    }

                    createdPayments.push({
                        PaymentId: advancePayment.Id,
                        PurchaseId: null,
                        InvoiceNumber: null,
                        Amount: advancePortion,
                        IsAdvance: true,
                    });
                }

                // 8. Cash ledger — single OUT entry for the whole amount
                if (isCash) {
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

                const allocatedToPurchases = totalAmount - advancePortion;

                return {
                    message:
                        advancePortion > 0
                            ? `${dto.paymentMethod} payment — Rs ${allocatedToPurchases.toFixed(
                                2
                            )} across ${allocations.length
                            } invoice(s), Rs ${advancePortion.toFixed(2)} held as ${isCash ? 'available' : 'pending'
                            } advance`
                            : `${dto.paymentMethod} payment — Rs ${totalAmount.toFixed(
                                2
                            )} across ${allocations.length} invoice(s)`,
                    supplierId,
                    totalAmount,
                    allocatedToPurchases,
                    advancePortion,
                    purchaseCount: allocations.length,
                    status: isCash ? 'Cleared' : 'Pending',
                    chequeNumber: dto.chequeNumber || null,
                    chequeDate: dto.chequeDate || null,
                    payments: createdPayments,
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
        const cheque = await this.prisma.supplierPayments.findUnique({
            where: { Id: id },
            include: { Purchases: true },
        });

        if (!cheque) {
            throw new NotFoundException('Cheque not found');
        }

        if (cheque.PaymentMethod !== 'Cheque') {
            throw new BadRequestException('This payment is not a cheque');
        }

        if (cheque.Status === 'Cleared') {
            throw new BadRequestException('Cheque already cleared');
        }

        if (cheque.Status === 'Bounced') {
            throw new BadRequestException('Cheque was bounced — cannot clear');
        }

        const amount = Number(cheque.Amount);
        const isAdvance = cheque.PurchaseId === null;

        return await this.prisma.$transaction(async (tx) => {
            // Mark cleared
            const updated = await tx.supplierPayments.update({
                where: { Id: id },
                data: {
                    Status: 'Cleared',
                    ClearedAt: new Date(),
                },
            });

            if (isAdvance) {
                const supplierId =
                    cheque.SupplierId || cheque.Purchases?.SupplierId;

                if (supplierId) {
                    await tx.suppliers.update({
                        where: { Id: supplierId },
                        data: {
                            PendingAdvance: { decrement: amount },
                            AdvanceBalance: { increment: amount },
                        },
                    });
                }

                await this.cashLedger.add(
                    'OUT',
                    amount,
                    'SUPPLIER_CHEQUE_ADVANCE_CLEARED',
                    cheque.ChequeNumber || 'N/A',
                    `Advance portion of cheque #${cheque.ChequeNumber} cleared`
                );
            } else if (!cheque.CashLedgerPosted) {
                await this.cashLedger.add(
                    'OUT',
                    amount,
                    'SUPPLIER_CHEQUE_CLEARED',
                    cheque.Purchases?.InvoiceNumber || 'N/A',
                    `Cheque cleared for ${cheque.Purchases?.InvoiceNumber || 'N/A'
                    }`
                );

                await tx.supplierPayments.update({
                    where: { Id: id },
                    data: { CashLedgerPosted: true },
                });
            }

            return {
                message: isAdvance
                    ? `Advance cleared — Rs ${amount} now available`
                    : `Cheque cleared successfully`,
                paymentId: updated.Id,
                status: updated.Status,
                isAdvance,
            };
        });
    }

    // =========================
    // CLEAR CHEQUE BY NUMBER (bulk)
    // =========================
    async clearChequeByNumber(chequeNumber: string) {
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

                const allCleared = rows.filter((r) => r.Status === 'Cleared');
                if (allCleared.length === rows.length) {
                    throw new BadRequestException('Cheque already cleared');
                }

                const bounced = rows.filter((r) => r.Status === 'Bounced');
                if (bounced.length > 0) {
                    throw new BadRequestException(
                        'Cheque was bounced — cannot clear'
                    );
                }

                const pending = rows.filter(
                    (r) => r.Status !== 'Cleared' && r.Status !== 'Bounced'
                );

                // ✅ Fallback supplier id
                const fallbackSupplierId =
                    rows.find((r) => r.SupplierId)?.SupplierId ||
                    rows.find((r) => r.Purchases?.SupplierId)?.Purchases
                        ?.SupplierId ||
                    null;

                let totalCleared = 0;
                let totalAdvance = 0;
                let advanceSupplierId: string | null = null;

                for (const row of pending) {
                    const amount = Number(row.Amount);
                    totalCleared += amount;

                    const isAdvance = row.PurchaseId === null;

                    await tx.supplierPayments.update({
                        where: { Id: row.Id },
                        data: {
                            Status: 'Cleared',
                            ClearedAt: new Date(),
                        },
                    });

                    if (isAdvance) {
                        totalAdvance += amount;
                        const sid = row.SupplierId || fallbackSupplierId;
                        if (sid && !advanceSupplierId) {
                            advanceSupplierId = sid;
                        }
                    } else if (!row.CashLedgerPosted) {
                        await this.cashLedger.add(
                            'OUT',
                            amount,
                            'SUPPLIER_CHEQUE_CLEARED',
                            row.Purchases?.InvoiceNumber || 'N/A',
                            `Cheque cleared for ${row.Purchases?.InvoiceNumber || 'N/A'
                            } (Cheque #${chequeNumber})`
                        );

                        await tx.supplierPayments.update({
                            where: { Id: row.Id },
                            data: { CashLedgerPosted: true },
                        });
                    }
                }

                // Move PendingAdvance → AdvanceBalance
                if (totalAdvance > 0 && advanceSupplierId) {
                    await tx.suppliers.update({
                        where: { Id: advanceSupplierId },
                        data: {
                            PendingAdvance: { decrement: totalAdvance },
                            AdvanceBalance: { increment: totalAdvance },
                        },
                    });
                }

                const invoicesCleared = pending.filter(
                    (r) => r.PurchaseId !== null
                ).length;

                return {
                    chequeNumber,
                    rowsCleared: pending.length,
                    invoicesCleared,
                    totalCleared,
                    advanceCleared: totalAdvance,
                    message:
                        totalAdvance > 0
                            ? `Cheque cleared — Rs ${(
                                totalCleared - totalAdvance
                            ).toFixed(
                                2
                            )} across ${invoicesCleared} purchase(s), Rs ${totalAdvance.toFixed(
                                2
                            )} moved to available advance`
                            : `Cheque cleared — Rs ${totalCleared.toFixed(
                                2
                            )} across ${invoicesCleared} purchase(s)`,
                };
            },
            {
                timeout: 30000,
                maxWait: 15000,
            }
        );
    }


    // =========================
    // BOUNCE CHEQUE BY NUMBER (bulk)
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

                const alreadyBounced = rows.filter(
                    (r) => r.Status === 'Bounced'
                );
                if (alreadyBounced.length === rows.length) {
                    throw new BadRequestException(
                        'Cheque already marked as bounced'
                    );
                }

                const pending = rows.filter(
                    (r) => r.Status !== 'Cleared' && r.Status !== 'Bounced'
                );

                // ✅ Fallback supplier id
                const fallbackSupplierId =
                    rows.find((r) => r.SupplierId)?.SupplierId ||
                    rows.find((r) => r.Purchases?.SupplierId)?.Purchases
                        ?.SupplierId ||
                    null;

                let totalReversed = 0;
                let totalAdvanceReversed = 0;
                let advanceSupplierId: string | null = null;
                let invoicesBounced = 0;

                for (const row of pending) {
                    const amount = Number(row.Amount);
                    totalReversed += amount;

                    const isAdvance = row.PurchaseId === null;

                    const combinedNote = reason
                        ? `${row.Notes || ''} | BOUNCED: ${reason}`.trim()
                        : `${row.Notes || ''} | BOUNCED`.trim();

                    await tx.supplierPayments.update({
                        where: { Id: row.Id },
                        data: {
                            Status: 'Bounced',
                            ClearedAt: null,
                            Notes: combinedNote,
                        },
                    });

                    if (isAdvance) {
                        totalAdvanceReversed += amount;
                        const sid = row.SupplierId || fallbackSupplierId;
                        if (sid && !advanceSupplierId) {
                            advanceSupplierId = sid;
                        }
                    } else {
                        invoicesBounced++;

                        await tx.purchases.update({
                            where: { Id: row.PurchaseId! },
                            data: {
                                PaidAmount: { decrement: amount },
                                BalanceAmount: { increment: amount },
                            },
                        });
                    }
                }

                // Reverse PendingAdvance
                if (totalAdvanceReversed > 0 && advanceSupplierId) {
                    await tx.suppliers.update({
                        where: { Id: advanceSupplierId },
                        data: {
                            PendingAdvance: { decrement: totalAdvanceReversed },
                        },
                    });
                }

                return {
                    chequeNumber,
                    rowsBounced: pending.length,
                    invoicesBounced,
                    totalReversed,
                    advanceReversed: totalAdvanceReversed,
                    message:
                        totalAdvanceReversed > 0
                            ? `Cheque bounced — Rs ${(
                                totalReversed - totalAdvanceReversed
                            ).toFixed(
                                2
                            )} re-added to outstanding across ${invoicesBounced} purchase(s), Rs ${totalAdvanceReversed.toFixed(
                                2
                            )} pending advance removed`
                            : `Cheque bounced — Rs ${totalReversed.toFixed(
                                2
                            )} re-added to outstanding across ${invoicesBounced} purchase(s)`,
                };
            },
            {
                timeout: 30000,
                maxWait: 15000,
            }
        );
    }


}