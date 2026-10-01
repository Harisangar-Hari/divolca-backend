//src/cheque/cheque.service.ts

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashLedgerService } from '../cash-ledger/cash-ledger.service';


@Injectable()
export class ChequeService {


    constructor(

        private prisma: PrismaService,

        private cashLedger: CashLedgerService

    ) { }



    async processDueCheques() {
        const today = new Date();

        const cheques = await this.prisma.supplierPayments.findMany({
            where: {
                PaymentMethod: 'Cheque',
                Status: 'Pending',
                ChequeDate: { lte: today },
            },
            include: { Purchases: true },
        });

        let processed = 0;
        let totalCleared = 0;
        let advanceCleared = 0;

        for (const cheque of cheques) {
            const amount = Number(cheque.Amount);
            const isAdvance = cheque.PurchaseId === null;

            await this.prisma.supplierPayments.update({
                where: { Id: cheque.Id },
                data: {
                    Status: 'Cleared',
                    ClearedAt: new Date(),
                },
            });

            if (isAdvance) {
                const supplierId =
                    cheque.SupplierId || cheque.Purchases?.SupplierId;

                if (supplierId) {
                    await this.prisma.suppliers.update({
                        where: { Id: supplierId },
                        data: {
                            PendingAdvance: { decrement: amount },
                            AdvanceBalance: { increment: amount },
                        },
                    });
                }

                if (!cheque.CashLedgerPosted) {
                    await this.cashLedger.add(
                        'OUT',
                        amount,
                        'SUPPLIER_CHEQUE_ADVANCE_CLEARED',
                        cheque.ChequeNumber || 'N/A',
                        `Advance of cheque #${cheque.ChequeNumber} cleared`
                    );

                    await this.prisma.supplierPayments.update({
                        where: { Id: cheque.Id },
                        data: { CashLedgerPosted: true },
                    });
                }

                advanceCleared += amount;
            } else if (!cheque.CashLedgerPosted) {
                await this.cashLedger.add(
                    'OUT',
                    amount,
                    'SUPPLIER_CHEQUE_CLEAR',
                    cheque.Purchases?.InvoiceNumber || 'N/A',
                    `Cheque cleared for ${cheque.Purchases?.InvoiceNumber || 'N/A'
                    }`
                );

                await this.prisma.supplierPayments.update({
                    where: { Id: cheque.Id },
                    data: { CashLedgerPosted: true },
                });
            }

            processed++;
            totalCleared += amount;
        }

        return {
            message: `Processed ${processed} due cheque(s)`,
            processed,
            totalCleared,
            advanceCleared,
        };
    }

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

        // ✅ NEW — block bounced cheques
        if (cheque.Status === 'Bounced') {
            throw new BadRequestException(
                'Cheque was bounced — cannot clear'
            );
        }

        const amount = Number(cheque.Amount);
        const isAdvance = cheque.PurchaseId === null;

        return await this.prisma.$transaction(async (tx) => {
            // ✅ NEW — advance rows: move PendingAdvance → AdvanceBalance
            if (isAdvance) {
                const supplierId =
                    cheque.SupplierId || cheque.Purchases?.SupplierId || null;

                if (supplierId) {
                    await tx.suppliers.update({
                        where: { Id: supplierId },
                        data: {
                            PendingAdvance: { decrement: amount },
                            AdvanceBalance: { increment: amount },
                        },
                    });
                }

                if (!cheque.CashLedgerPosted) {
                    await this.cashLedger.add(
                        'OUT',
                        amount,
                        'SUPPLIER_CHEQUE_ADVANCE_CLEARED',
                        cheque.ChequeNumber || 'N/A',
                        `Advance portion of cheque #${cheque.ChequeNumber || 'N/A'
                        } cleared`
                    );
                }
            } else {
                // Sale-backed rows: existing behavior
                if (!cheque.CashLedgerPosted) {
                    await this.cashLedger.add(
                        'OUT',
                        amount,
                        'SUPPLIER_CHEQUE_CLEAR',
                        cheque.Purchases?.InvoiceNumber || 'N/A',
                        `Cheque cleared for supplier ${cheque.Purchases?.InvoiceNumber || 'N/A'
                        }`
                    );
                }
            }

            // Mark cleared
            const updated = await tx.supplierPayments.update({
                where: { Id: id },
                data: {
                    Status: 'Cleared',
                    ClearedAt: new Date(),
                    CashLedgerPosted: true,
                },
            });

            return {
                message: isAdvance
                    ? `Advance cleared — Rs ${amount} now available`
                    : 'Cheque cleared successfully',
                paymentId: updated.Id,
                status: updated.Status,
                isAdvance,
            };
        });
    }


}