import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ManualCashDto } from './dto/manual-cash.dto';

@Injectable()
export class CashDashboardService {
    constructor(
        private prisma: PrismaService,
    ) { }

    async getDaily(date: Date) {
        // Convert to UTC to handle timezones correctly
        const utcDate = new Date(
            Date.UTC(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
            ),
        );

        const start = utcDate;
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);

        // ============================================================
        // 1. GET CASH LEDGER ENTRIES (Manual cash + Physical drawer)
        // ============================================================
        const entries = await this.prisma.cashLedgerEntries.findMany({
            where: {
                Date: {
                    gte: start,
                    lt: end,
                },
            },
            orderBy: {
                Date: 'asc',
            },
        });

        const totalIn = entries
            .filter((x) => x.Type === 'IN')
            .reduce((sum, x) => sum + Number(x.Amount), 0);

        const totalOut = entries
            .filter((x) => x.Type === 'OUT')
            .reduce((sum, x) => sum + Number(x.Amount), 0);

        const cashBalance = totalIn - totalOut;

        // ============================================================
        // 2. GET SALES STATS (Separated by the new 'paymentMode' column)
        // ============================================================
        // We run these queries in a transaction to ensure data consistency.
        const [cashSalesAgg, cardSalesAgg, creditSalesAgg] =
            await this.prisma.$transaction([
                // Cash Sales
                this.prisma.sales.aggregate({
                    _sum: { PaidAmount: true },
                    where: {
                        CreatedAt: {
                            gte: start,
                            lt: end,
                        },
                        paymentMode: 'cash',
                    },
                }),
                // Card Sales
                this.prisma.sales.aggregate({
                    _sum: { PaidAmount: true },
                    where: {
                        CreatedAt: {
                            gte: start,
                            lt: end,
                        },
                        paymentMode: 'card',
                    },
                }),
                // Credit Sales
                this.prisma.sales.aggregate({
                    _sum: { PaidAmount: true },
                    where: {
                        CreatedAt: {
                            gte: start,
                            lt: end,
                        },
                        paymentMode: 'credit',
                    },
                }),
            ]);

        const cashSales = Number(cashSalesAgg._sum?.PaidAmount ?? 0);
        const cardSales = Number(cardSalesAgg._sum?.PaidAmount ?? 0);
        const creditSales = Number(creditSalesAgg._sum?.PaidAmount ?? 0);

        // ============================================================
        // 3. RETURN PERFECTLY SEPARATED DATA
        // ============================================================
        return {
            date: start,

            // Cash Ledger Stats (Physical drawer & manual entries)
            totalIn,
            totalOut,
            cashBalance,

            // Sales Stats (Broken down by payment type)
            cashSales,
            cardSales,
            creditSales,

            // Grand total of all revenue for the day
            grandTotal: cashSales + cardSales + creditSales,

            // The raw ledger entries (for the table)
            entries,
        };
    }

    async addManualCash(dto: ManualCashDto) {
        if (dto.amount <= 0) {
            throw new BadRequestException('Amount must be greater than zero');
        }

        await this.prisma.cashLedgerEntries.create({
            data: {
                Id: crypto.randomUUID(),
                Date: new Date(),
                CreatedAt: new Date(),
                Type: dto.type,
                Amount: dto.amount,
                Category: dto.category,
                Description: dto.description ?? 'Manual Cash Entry',
                ReferenceId: null,
            },
        });

        return {
            message: 'Manual cash entry added successfully',
        };
    }
}