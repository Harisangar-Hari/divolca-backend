//src/sales/sales.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashLedgerService } from '../cash-ledger/cash-ledger.service';
import { AddSaleItemDto, CreateCheckoutDto, EditSaleDto, UpdateSaleItemDto } from './dto/checkout.dto';
import { randomUUID } from 'crypto';
import { CreateSaleReturnDto } from './dto/return-sale.dto';
import { RecordBulkCreditChequeDto, RecordCreditChequeDto } from './dto/record-credit-cheque.dto';

export enum PaymentMode {
    CASH = 'cash',
    CARD = 'card',
    CREDIT = 'credit',
}

export enum SaleStatus {
    PENDING = 0,
    PARTIALLY_RETURNED = 1,
    FULLY_RETURNED = 2,
    COMPLETED = 3,
    CANCELLED = 4,
}

@Injectable()
export class SalesService {
    constructor(
        private prisma: PrismaService,
        private cashLedger: CashLedgerService
    ) { }

    // ============================
    // CHECKOUT / CREATE SALE
    // ============================
    async checkout(dto: CreateCheckoutDto) {
        if (!dto.items || dto.items.length === 0) {
            throw new BadRequestException('Cart is empty');
        }

        return await this.prisma.$transaction(
            async (tx) => {
                let subtotal = 0;
                let totalItemDiscount = 0;
                let totalAfterItemDiscounts = 0;
                let customer: any = null;
                let customerName = dto.customerName || null;
                let customerPhone = dto.customerPhone || null;

                // ============================
                // 1. CUSTOMER HANDLING
                // ============================
                if (dto.paymentMode === PaymentMode.CREDIT) {
                    // Credit sales REQUIRE a customer
                    if (dto.customerId) {
                        customer = await tx.customers.findUnique({
                            where: { Id: dto.customerId },
                        });
                        if (!customer) {
                            throw new BadRequestException('Customer not found');
                        }
                        customerName = customer.Name;
                        customerPhone = customer.Phone;
                    } else {
                        throw new BadRequestException('Customer is required for credit sales');
                    }
                } else {
                    // Cash/Card: Customer is optional (for receipt only)
                    if (dto.customerId) {
                        customer = await tx.customers.findUnique({
                            where: { Id: dto.customerId },
                        });
                        if (customer) {
                            customerName = customer.Name;
                            customerPhone = customer.Phone;
                        }
                    } else if (dto.customerPhone) {
                        // Try to find existing customer by phone
                        customer = await tx.customers.findFirst({
                            where: { Phone: dto.customerPhone },
                        });
                        if (customer) {
                            customerName = customer.Name;
                            customerPhone = customer.Phone;
                        } else if (dto.customerName) {
                            // Create new customer only if name is provided (for receipt purpose)
                            customer = await tx.customers.create({
                                data: {
                                    Id: randomUUID(),
                                    Name: dto.customerName,
                                    Phone: dto.customerPhone || 'N/A',
                                    CreatedAt: new Date(),
                                    LoyaltyPoints: 0,
                                    TotalSpent: 0,
                                    LoyaltyTier: 'Bronze',
                                },
                            });
                            customerName = customer.Name;
                            customerPhone = customer.Phone;
                        }
                    }
                }

                // ============================
                // 2. CREATE SALE (Initial)
                // ============================
                const sale = await tx.sales.create({
                    data: {
                        Id: randomUUID(),
                        InvoiceNumber: 'INV-' + Date.now(),
                        CreatedAt: new Date(),
                        Status: SaleStatus.PENDING,
                        TotalAmount: 0,
                        SubTotal: 0,
                        InvoiceDiscount: 0,
                        PaidAmount: 0,
                        BalanceAmount: 0,
                        CustomerId: customer?.Id ?? null,
                        IsCreditSale: dto.paymentMode === PaymentMode.CREDIT,
                        paymentMode: dto.paymentMode,
                    },
                });

                // ============================
                // 3. PROCESS ITEMS
                // ============================
                for (const item of dto.items) {
                    const product = await tx.products.findUnique({
                        where: { Id: item.productId },
                    });

                    if (!product) {
                        throw new BadRequestException(`Product not found: ${item.productId}`);
                    }

                    if (product.StockQty < item.quantity) {
                        throw new BadRequestException(
                            `Not enough stock for ${product.Name}. Available: ${product.StockQty}`
                        );
                    }

                    const price = Number(product.Price);
                    const qty = item.quantity;
                    const lineSubtotal = price * qty;
                    const perUnitDiscount = item.discount ?? 0;
                    const itemDiscountTotal = perUnitDiscount * qty;
                    let lineTotal = Math.max(0, lineSubtotal - itemDiscountTotal);

                    subtotal += lineSubtotal;
                    totalItemDiscount += itemDiscountTotal;
                    totalAfterItemDiscounts += lineTotal;

                    // Reduce Stock
                    await tx.products.update({
                        where: { Id: product.Id },
                        data: { StockQty: { decrement: item.quantity } },
                    });

                    // Create Sale Item
                    await tx.saleItems.create({
                        data: {
                            Id: randomUUID(),
                            SaleId: sale.Id,
                            ProductId: product.Id,
                            Quantity: qty,
                            UnitPrice: price,
                            Discount: itemDiscountTotal,
                            Total: lineTotal,
                        },
                    });
                }

                // ============================
                // 4. APPLY INVOICE DISCOUNT
                // ============================
                const invoiceDiscount = Math.max(0, dto.invoiceDiscount ?? 0);
                let finalTotal = Math.max(0, totalAfterItemDiscounts - invoiceDiscount);

                // ============================
                // 5. PAYMENT CALCULATION
                // ============================
                const receivedAmount = Math.max(0, dto.paidAmount ?? 0);
                let paid = 0;
                let balance = finalTotal;

                if (dto.paymentMode === PaymentMode.CREDIT) {
                    // Credit sale: paidAmount is initial payment, balance remains
                    paid = Math.min(receivedAmount, finalTotal);
                    balance = finalTotal - paid;
                } else {
                    // Cash/Card: full payment expected
                    paid = Math.min(receivedAmount, finalTotal);
                    balance = finalTotal - paid;

                    // For cash, if receivedAmount > finalTotal, it's overpayment (change)
                    if (receivedAmount > finalTotal) {
                        // Still mark as fully paid
                        paid = finalTotal;
                        balance = 0;
                    }
                }

                // ============================
                // 6. UPDATE SALE
                // ============================
                await tx.sales.update({
                    where: { Id: sale.Id },
                    data: {
                        SubTotal: subtotal,
                        InvoiceDiscount: invoiceDiscount,
                        TotalAmount: finalTotal,
                        PaidAmount: paid,
                        BalanceAmount: balance,
                        IsCreditSale: balance > 0 || dto.paymentMode === PaymentMode.CREDIT,
                    },
                });

                // ============================
                // 7. RECORD PAYMENTS
                // ============================
                if (paid > 0) {
                    // Create payment record
                    await tx.salePayments.create({
                        data: {
                            Id: randomUUID(),
                            SaleId: sale.Id,
                            PaymentMode: dto.paymentMode,
                            Amount: paid,
                            PaidAt: new Date(),
                            Status: 'completed',
                            Reference: dto.paymentReference || null,
                        },
                    });

                    // Handle different payment modes
                    if (dto.paymentMode === PaymentMode.CASH) {
                        await this.cashLedger.add(
                            'IN',
                            paid,
                            'SALE',
                            sale.InvoiceNumber,
                            `Cash received for ${sale.InvoiceNumber}`
                        );
                    } else if (dto.paymentMode === PaymentMode.CREDIT) {
                        // If there's an initial payment on credit sale
                        if (customer && paid > 0) {
                            await tx.creditPayments.create({
                                data: {
                                    Id: randomUUID(),
                                    SaleId: sale.Id,
                                    Amount: paid,
                                    PaidAt: new Date(),
                                    Note: 'Initial payment on credit sale',
                                },
                            });
                        }
                    }
                    // Card payments: just record, no cash ledger
                }

                // ============================
                // 8. CUSTOMER CREDIT LEDGER
                // ============================
                if (customer && balance > 0) {
                    await tx.customerLedgerEntries.create({
                        data: {
                            Id: randomUUID(),
                            CustomerId: customer.Id,
                            SaleId: sale.Id,
                            Credit: balance,
                            Debit: 0,
                            Type: 'SALE',
                            CreatedAt: new Date(),
                        },
                    });
                }

                // ============================
                // 9. UPDATE CUSTOMER CREDIT BALANCE
                // ============================
                if (customer) {
                    // Calculate points
                    const points = Math.floor(finalTotal / 2000);

                    // Calculate credit balance update
                    let creditBalanceUpdate = 0;

                    if (dto.paymentMode === PaymentMode.CREDIT) {
                        // For credit sales: increase credit balance by the remaining balance
                        creditBalanceUpdate = balance; // Positive number to add
                    } else if (dto.paymentMode === PaymentMode.CASH || dto.paymentMode === PaymentMode.CARD) {
                        // For cash/card sales: no credit balance change
                        creditBalanceUpdate = 0;
                    }

                    // Update customer
                    await tx.customers.update({
                        where: { Id: customer.Id },
                        data: {
                            TotalSpent: { increment: finalTotal },
                            LoyaltyPoints: { increment: points },
                            // Update CreditBalance for credit sales
                            ...(creditBalanceUpdate > 0 && {
                                CreditBalance: { increment: creditBalanceUpdate }
                            }),
                            LastPurchaseDate: new Date(),
                        },
                    });
                }

                // ============================
                // 10. GET UPDATED CUSTOMER FOR RESPONSE
                // ============================
                const updatedCustomer = customer ? await tx.customers.findUnique({
                    where: { Id: customer.Id },
                    select: {
                        Id: true,
                        Name: true,
                        Phone: true,
                        CreditBalance: true,
                        CreditLimit: true,
                        LoyaltyPoints: true,
                        LoyaltyTier: true,
                        TotalSpent: true,
                    },
                }) : null;

                // ============================
                // 11. RETURN RESPONSE
                // ============================
                return {
                    message: 'Sale completed successfully',
                    InvoiceNumber: sale.InvoiceNumber,
                    TotalAmount: finalTotal,
                    PaidAmount: paid,
                    ReceivedAmount: receivedAmount,
                    BalanceAmount: balance,
                    ChangeAmount: Math.max(0, receivedAmount - finalTotal),
                    CustomerId: customer?.Id ?? null,
                    CustomerName: customerName,
                    CustomerPhone: customerPhone,
                    PaymentMode: dto.paymentMode,
                    CreditBalance: updatedCustomer?.CreditBalance ? Number(updatedCustomer.CreditBalance) : 0,
                    Customer: updatedCustomer,
                };
            },
            {
                timeout: 30000,
                maxWait: 15000,
            }
        );
    }

    // ============================
    // GET ALL SALES
    // ============================
    async getAll() {
        const sales = await this.prisma.sales.findMany({
            orderBy: { CreatedAt: 'desc' },
            include: {
                Customers: true,
                SaleItems: {
                    include: { Products: true },
                },
                SalePayments: true,
            },
        });

        return sales.map((sale) => ({
            ...sale,
            itemsCount: sale.SaleItems.length,
        }));
    }

    // ============================
    // GET SALE BY ID
    // ============================
    async getById(id: string) {
        const sale = await this.prisma.sales.findUnique({
            where: { Id: id },
            include: {
                Customers: true,
                SaleItems: {
                    include: { Products: true },
                },
                CreditPayments: true,
                SalePayments: true,
            },
        });

        if (!sale) {
            throw new NotFoundException('Sale not found');
        }

        return sale;
    }

    // ============================
    // GET INVOICE
    // ============================
    async getInvoice(invoiceNumber: string) {
        const sale = await this.prisma.sales.findFirst({
            where: { InvoiceNumber: invoiceNumber },
            include: {
                Customers: true,
                SaleItems: {
                    include: { Products: true },
                },
                CreditPayments: true,
                SalePayments: true,
            },
        });

        if (!sale) {
            throw new NotFoundException('Invoice not found');
        }

        return sale;
    }

    // ============================
    // PAY CREDIT
    // ============================
    async payCredit(saleId: string, amount: number) {
        return await this.prisma.$transaction(async (tx) => {
            const sale = await tx.sales.findUnique({
                where: { Id: saleId },
                include: { Customers: true },
            });

            if (!sale) {
                throw new NotFoundException('Sale not found');
            }

            if (amount <= 0) {
                throw new BadRequestException('Invalid amount');
            }

            const balance = Number(sale.BalanceAmount);
            if (amount > balance) {
                throw new BadRequestException(
                    `Exceeds balance. Balance: ${balance}`
                );
            }

            const newBalance = balance - amount;
            const newPaid = Number(sale.PaidAmount) + amount;

            // Record credit payment
            await tx.creditPayments.create({
                data: {
                    Id: randomUUID(),
                    SaleId: sale.Id,
                    Amount: amount,
                    PaidAt: new Date(),
                    Note: 'Credit payment received',
                },
            });

            // Record in sale payments
            await tx.salePayments.create({
                data: {
                    Id: randomUUID(),
                    SaleId: sale.Id,
                    PaymentMode: PaymentMode.CASH,
                    Amount: amount,
                    PaidAt: new Date(),
                    Status: 'completed',
                    Reference: 'Credit payment',
                },
            });

            // Update sale
            await tx.sales.update({
                where: { Id: sale.Id },
                data: {
                    PaidAmount: newPaid,
                    BalanceAmount: newBalance,
                    IsCreditSale: newBalance > 0,
                },
            });

            // Update customer ledger
            if (sale.CustomerId) {
                await tx.customerLedgerEntries.create({
                    data: {
                        Id: randomUUID(),
                        CustomerId: sale.CustomerId,
                        SaleId: sale.Id,
                        Debit: amount,
                        Credit: 0,
                        Type: 'PAYMENT',
                        CreatedAt: new Date(),
                    },
                });
            }

            // Update customer credit balance
            if (sale.CustomerId) {
                await tx.customers.update({
                    where: { Id: sale.CustomerId },
                    data: {
                        CreditBalance: { decrement: amount },
                        LastPaymentDate: new Date(),
                    },
                });
            }

            // Cash ledger entry
            await this.cashLedger.add(
                'IN',
                amount,
                'CREDIT_PAYMENT',
                sale.InvoiceNumber,
                `Credit payment received for ${sale.InvoiceNumber}`
            );

            return {
                message: 'Credit payment successful',
                PaidAmount: newPaid,
                BalanceAmount: newBalance,
            };
        });
    }

    // ============================
    // RETURN ITEMS
    // ============================
    // src/sales/sales.service.ts - Fixed returnItems

    async returnItems(dto: CreateSaleReturnDto) {
        return await this.prisma.$transaction(
            async (tx) => {
                const sale = await tx.sales.findFirst({
                    where: { InvoiceNumber: dto.invoiceNumber },
                    include: {
                        SaleItems: {
                            include: {
                                Products: true,
                            },
                        },
                        SaleReturns: {
                            include: {
                                SaleReturnItems: true,
                            },
                        },
                        SalePayments: true,
                        Customers: true,
                    },
                });

                if (!sale) {
                    throw new NotFoundException('Invoice not found');
                }

                if (sale.Status === SaleStatus.FULLY_RETURNED) {
                    throw new BadRequestException('Invoice is already fully returned');
                }

                // ============================================================
                // ✅ Correct invoice discount rate
                // Sale.TotalAmount = AfterItemDiscount − InvoiceDiscount
                // So AfterItemDiscount = TotalAmount + InvoiceDiscount
                // rate = InvoiceDiscount / AfterItemDiscount
                // ============================================================
                const originalInvoiceDiscount = Number(sale.InvoiceDiscount);
                const originalTotalAmount = Number(sale.TotalAmount);
                const originalAfterItemDiscount =
                    originalTotalAmount + originalInvoiceDiscount;
                const invoiceDiscountRate =
                    originalAfterItemDiscount > 0
                        ? originalInvoiceDiscount / originalAfterItemDiscount
                        : 0;

                let totalRefund = 0;

                // Create Sale Return
                const saleReturn = await tx.saleReturns.create({
                    data: {
                        Id: randomUUID(),
                        SaleId: sale.Id,
                        Reason: dto.reason,
                        ReturnedAt: new Date(),
                        ReturnAmount: 0,
                    },
                });

                // Process each return item
                for (const item of dto.items) {
                    const saleItem = sale.SaleItems.find(
                        (x) => x.ProductId === item.productId
                    );

                    if (!saleItem) {
                        throw new BadRequestException(
                            `Product ${item.productId} not found in invoice`
                        );
                    }

                    // Calculate already returned quantity for this item
                    const alreadyReturned = sale.SaleReturns.reduce(
                        (sum, ret) =>
                            sum +
                            ret.SaleReturnItems.filter(
                                (ri) => ri.ProductId === item.productId
                            ).reduce((s, ri) => s + ri.Quantity, 0),
                        0
                    );

                    const originalQuantity = saleItem.Quantity;
                    const availableQty = originalQuantity - alreadyReturned;

                    if (item.quantity > availableQty) {
                        throw new BadRequestException(
                            `Return quantity (${item.quantity}) exceeds available quantity (${availableQty}) for product ${item.productId}`
                        );
                    }

                    const unitPrice = Number(saleItem.UnitPrice);
                    const totalLineDiscount = Number(saleItem.Discount);

                    // ✅ Per-unit item discount (so partial returns prorate correctly)
                    const perUnitItemDiscount =
                        originalQuantity > 0
                            ? totalLineDiscount / originalQuantity
                            : 0;

                    // ============================================================
                    // ✅ Refund = (unitPrice − perUnitItemDiscount) × qty
                    //            × (1 − invoiceDiscountRate)
                    // Handles BOTH item-level and invoice-level discounts.
                    // ============================================================
                    const grossForThisQty = unitPrice * item.quantity;
                    const itemDiscountForThisQty =
                        perUnitItemDiscount * item.quantity;
                    const afterItemDiscount =
                        grossForThisQty - itemDiscountForThisQty;
                    const refundAmount =
                        afterItemDiscount * (1 - invoiceDiscountRate);

                    totalRefund += refundAmount;

                    // Restore stock
                    await tx.products.update({
                        where: { Id: item.productId },
                        data: { StockQty: { increment: item.quantity } },
                    });

                    // Create return item
                    await tx.saleReturnItems.create({
                        data: {
                            Id: randomUUID(),
                            SaleReturnId: saleReturn.Id,
                            ProductId: item.productId,
                            Quantity: item.quantity,
                            UnitPrice: saleItem.UnitPrice,
                            Reason: dto.reason,
                        },
                    });

                    // ============================================================
                    // ✅ UPDATE THE SALE ITEM
                    // Reduce qty, Discount, AND Total so the discount %
                    // displayed on the frontend stays correct.
                    // ============================================================
                    const remainingQty =
                        originalQuantity - item.quantity - alreadyReturned;

                    if (remainingQty <= 0) {
                        await tx.saleItems.delete({
                            where: { Id: saleItem.Id },
                        });
                    } else {
                        const newDiscount = perUnitItemDiscount * remainingQty;
                        const newTotal = unitPrice * remainingQty - newDiscount;

                        await tx.saleItems.update({
                            where: { Id: saleItem.Id },
                            data: {
                                Quantity: remainingQty,
                                Discount: newDiscount, // ✅ prorated
                                Total: newTotal,       // ✅ after discount
                            },
                        });
                    }
                }

                // Update return total
                await tx.saleReturns.update({
                    where: { Id: saleReturn.Id },
                    data: { ReturnAmount: totalRefund },
                });

                // ============================================================
                // ✅ RECOMPUTE sale totals from the REMAINING items
                // ============================================================
                const remainingItems = await tx.saleItems.findMany({
                    where: { SaleId: sale.Id },
                });

                let newSubTotal = 0;          // raw price × qty
                let newAfterItemDiscount = 0; // after item discount

                for (const it of remainingItems) {
                    const raw = Number(it.UnitPrice) * it.Quantity;
                    const disc = Number(it.Discount);
                    newSubTotal += raw;
                    newAfterItemDiscount += raw - disc;
                }

                const newInvoiceDiscount =
                    newAfterItemDiscount * invoiceDiscountRate;
                const newTotalAmount =
                    newAfterItemDiscount - newInvoiceDiscount;

                const totalReturned =
                    Number(sale.ReturnedAmount ?? 0) + totalRefund;

                // Status: fully returned if nothing remains
                let status: SaleStatus;
                if (newTotalAmount <= 0.01) {
                    status = SaleStatus.FULLY_RETURNED;
                } else {
                    status = SaleStatus.PARTIALLY_RETURNED;
                }

                // Paid / balance after refund
                const totalPaid = Number(sale.PaidAmount);
                const newPaid = Math.max(0, totalPaid - totalRefund);
                const newBalance = Math.max(0, newTotalAmount - newPaid);

                await tx.sales.update({
                    where: { Id: sale.Id },
                    data: {
                        HasReturns: true,
                        ReturnedAmount: totalReturned,
                        PaidAmount: newPaid,
                        BalanceAmount: newBalance,
                        Status: status,
                        SubTotal: newSubTotal,
                        InvoiceDiscount: newInvoiceDiscount,
                        TotalAmount: newTotalAmount,
                        ...(status === SaleStatus.FULLY_RETURNED && {
                            IsCreditSale: false,
                        }),
                    },
                });

                // ============================================================
                // Customer ledger + credit balance
                // ============================================================
                if (sale.CustomerId) {
                    await tx.customerLedgerEntries.create({
                        data: {
                            Id: randomUUID(),
                            CustomerId: sale.CustomerId,
                            SaleId: sale.Id,
                            SaleReturnId: saleReturn.Id,
                            Debit: totalRefund,
                            Credit: 0,
                            Type: 'RETURN',
                            CreatedAt: new Date(),
                        },
                    });

                    if (sale.Customers) {
                        // ✅ Recalculate from unpaid sales (self-healing)
                        const unpaid = await tx.sales.aggregate({
                            where: {
                                CustomerId: sale.CustomerId,
                                BalanceAmount: { gt: 0 },
                                Status: { not: 4 },
                            },
                            _sum: { BalanceAmount: true },
                        });

                        await tx.customers.update({
                            where: { Id: sale.CustomerId },
                            data: {
                                CreditBalance: Number(
                                    unpaid._sum.BalanceAmount || 0
                                ),
                                TotalSpent: { decrement: totalRefund },
                            },
                        });
                    }
                }

                // Cash refund
                const cashRefund = Math.min(
                    totalRefund,
                    Number(sale.PaidAmount)
                );
                if (cashRefund > 0) {
                    await this.cashLedger.add(
                        'OUT',
                        cashRefund,
                        'RETURN',
                        dto.invoiceNumber,
                        `Refund for ${dto.invoiceNumber}`
                    );
                }

                const updatedCustomer = sale.CustomerId
                    ? await tx.customers.findUnique({
                        where: { Id: sale.CustomerId },
                        select: {
                            Id: true,
                            Name: true,
                            Phone: true,
                            CreditBalance: true,
                            CreditLimit: true,
                            LoyaltyPoints: true,
                            LoyaltyTier: true,
                            TotalSpent: true,
                        },
                    })
                    : null;

                const updatedSale = await tx.sales.findUnique({
                    where: { Id: sale.Id },
                    include: {
                        SaleItems: {
                            include: {
                                Products: true,
                            },
                        },
                        Customers: true,
                        CreditPayments: true,
                        SalePayments: true,
                    },
                });

                return {
                    message: 'Return processed successfully',
                    refund: totalRefund,
                    cashRefund: cashRefund,
                    invoiceNumber: dto.invoiceNumber,
                    totalReturned: totalReturned,
                    newBalance: newBalance,
                    sale: updatedSale,
                    CustomerCreditBalance: updatedCustomer?.CreditBalance
                        ? Number(updatedCustomer.CreditBalance)
                        : 0,
                    Customer: updatedCustomer,
                };
            },
            {
                timeout: 30000,
                maxWait: 5000,
            }
        );
    }
    // ============================
    // SIMPLE RETURN (Full Invoice Return)
    // ============================
    async returnInvoice(invoiceNumber: string) {
    return await this.prisma.$transaction(async (tx) => {
        const sale = await tx.sales.findFirst({
            where: { InvoiceNumber: invoiceNumber },
            include: {
                SaleItems: true,
                Customers: true,
            },
        });

        if (!sale) {
            throw new NotFoundException('Invoice not found');
        }

        if (sale.Status === SaleStatus.FULLY_RETURNED) {
            throw new BadRequestException('Already fully returned');
        }

        const totalAmount = Number(sale.TotalAmount);

        // Restore stock
        for (const item of sale.SaleItems) {
            await tx.products.update({
                where: { Id: item.ProductId },
                data: {
                    StockQty: { increment: item.Quantity },
                },
            });
        }

        // Create return record
        const saleReturn = await tx.saleReturns.create({
            data: {
                Id: randomUUID(),
                SaleId: sale.Id,
                Reason: 'Full return',
                ReturnedAt: new Date(),
                ReturnAmount: totalAmount,
            },
        });

        // Create return items
        for (const item of sale.SaleItems) {
            await tx.saleReturnItems.create({
                data: {
                    Id: randomUUID(),
                    SaleReturnId: saleReturn.Id,
                    ProductId: item.ProductId,
                    Quantity: item.Quantity,
                    UnitPrice: item.UnitPrice,
                    Reason: 'Full return',
                },
            });
        }

        // Update sale — zeroed out
        await tx.sales.update({
            where: { Id: sale.Id },
            data: {
                Status: SaleStatus.FULLY_RETURNED,
                PaidAmount: 0,
                BalanceAmount: 0,
                IsCreditSale: false,
                HasReturns: true,
                ReturnedAmount: totalAmount,
                SubTotal: 0,
                InvoiceDiscount: 0,
                TotalAmount: 0,
            },
        });

        // Customer ledger + credit balance
        if (sale.CustomerId) {
            await tx.customerLedgerEntries.create({
                data: {
                    Id: randomUUID(),
                    CustomerId: sale.CustomerId,
                    SaleId: sale.Id,
                    SaleReturnId: saleReturn.Id,
                    Debit: totalAmount,
                    Credit: 0,
                    Type: 'RETURN',
                    CreatedAt: new Date(),
                },
            });

            if (sale.Customers) {
                // ✅ Recalculate from unpaid sales (self-healing)
                const unpaid = await tx.sales.aggregate({
                    where: {
                        CustomerId: sale.CustomerId,
                        BalanceAmount: { gt: 0 },
                        Status: { not: 4 },
                    },
                    _sum: { BalanceAmount: true },
                });

                await tx.customers.update({
                    where: { Id: sale.CustomerId },
                    data: {
                        CreditBalance: Number(
                            unpaid._sum.BalanceAmount || 0
                        ),
                        TotalSpent: { decrement: totalAmount },
                    },
                });
            }
        }

        // Cash refund — refund what the customer actually paid
        const refundAmount = Number(sale.PaidAmount);
        if (refundAmount > 0) {
            await this.cashLedger.add(
                'OUT',
                refundAmount,
                'RETURN',
                invoiceNumber,
                `Full refund for ${invoiceNumber}`
            );
        }

        const updatedCustomer = sale.CustomerId
            ? await tx.customers.findUnique({
                  where: { Id: sale.CustomerId },
                  select: {
                      Id: true,
                      Name: true,
                      Phone: true,
                      CreditBalance: true,
                      CreditLimit: true,
                      LoyaltyPoints: true,
                      LoyaltyTier: true,
                      TotalSpent: true,
                  },
              })
            : null;

        return {
            message: 'Return processed',
            invoiceNumber,
            CustomerCreditBalance: updatedCustomer?.CreditBalance
                ? Number(updatedCustomer.CreditBalance)
                : 0,
            Customer: updatedCustomer,
        };
    });
}
    // ============================
    // REPLACEMENT
    // ============================
    async replacement(dto: any) {
        return await this.prisma.$transaction(async (tx) => {
            let total = 0;
            const saleId = randomUUID();
            const items: any[] = [];

            // Validate all products first
            for (const item of dto.Items) {
                const product = await tx.products.findUnique({
                    where: { Id: item.ProductId },
                });

                if (!product) {
                    throw new BadRequestException(
                        `Product not found: ${item.ProductId}`
                    );
                }

                if (product.StockQty < item.Quantity) {
                    throw new BadRequestException(
                        `Not enough stock for ${product.Name}. Available: ${product.StockQty}`
                    );
                }

                const line = Number(product.Price) * item.Quantity;
                total += line;

                items.push({
                    Id: randomUUID(),
                    SaleId: saleId,
                    ProductId: item.ProductId,
                    Quantity: item.Quantity,
                    UnitPrice: product.Price,
                    Total: line,
                });
            }

            // Reduce stock
            for (const item of dto.Items) {
                await tx.products.update({
                    where: { Id: item.ProductId },
                    data: {
                        StockQty: { decrement: item.Quantity },
                    },
                });
            }

            // Create replacement sale
            const sale = await tx.sales.create({
                data: {
                    Id: saleId,
                    InvoiceNumber: 'REP-' + Date.now(),
                    CreatedAt: new Date(),
                    Status: SaleStatus.COMPLETED,
                    TotalAmount: total,
                    PaidAmount: total,
                    BalanceAmount: 0,
                    SubTotal: total,
                    InvoiceDiscount: 0,
                    IsCreditSale: false,
                    paymentMode: PaymentMode.CASH,
                    SaleItems: {
                        create: items,
                    },
                },
            });

            return {
                message: 'Replacement created successfully',
                InvoiceNumber: sale.InvoiceNumber,
                Id: sale.Id,
                TotalAmount: sale.TotalAmount,
            };
        });
    }



    async cancelSale(saleId: string, reason?: string) {
        return await this.prisma.$transaction(async (tx) => {
            // 1. Find the sale
            const sale = await tx.sales.findUnique({
                where: { Id: saleId },
                include: {
                    SaleItems: {
                        include: {
                            Products: true,
                        },
                    },
                    Customers: true,
                    SalePayments: true,
                    CreditPayments: true,
                },
            });

            if (!sale) {
                throw new NotFoundException('Sale not found');
            }

            // 2. Check if already cancelled
            if (sale.Status === 4) { // 4 = CANCELLED
                throw new BadRequestException('Sale is already cancelled');
            }

            // 3. Check if already returned
            if (sale.Status === 2) { // 2 = FULLY_RETURNED
                throw new BadRequestException('Cannot cancel a returned sale');
            }

            // 4. Restore stock quantities
            for (const item of sale.SaleItems) {
                await tx.products.update({
                    where: { Id: item.ProductId },
                    data: {
                        StockQty: { increment: item.Quantity },
                    },
                });
            }

            // 5. Reverse customer credit balance (if credit sale)
            if (sale.CustomerId && sale.IsCreditSale) {
                const currentBalance = Number(sale.Customers?.CreditBalance || 0);
                const balanceAmount = Number(sale.BalanceAmount || 0);

                // Only reverse if there's a balance
                if (balanceAmount > 0) {
                    await tx.customers.update({
                        where: { Id: sale.CustomerId },
                        data: {
                            CreditBalance: { decrement: balanceAmount },
                            TotalSpent: { decrement: Number(sale.TotalAmount || 0) },
                            LoyaltyPoints: { decrement: Math.floor(Number(sale.TotalAmount || 0) / 2000) },
                        },
                    });
                } else {
                    // If fully paid, just reverse total spent and loyalty
                    await tx.customers.update({
                        where: { Id: sale.CustomerId },
                        data: {
                            TotalSpent: { decrement: Number(sale.TotalAmount || 0) },
                            LoyaltyPoints: { decrement: Math.floor(Number(sale.TotalAmount || 0) / 2000) },
                        },
                    });
                }
            }

            // 6. Reverse customer ledger entries
            if (sale.CustomerId) {
                // Create reverse ledger entry
                await tx.customerLedgerEntries.create({
                    data: {
                        Id: randomUUID(),
                        CustomerId: sale.CustomerId,
                        SaleId: sale.Id,
                        Debit: 0,
                        Credit: Number(sale.TotalAmount || 0),
                        Type: 'CANCELLATION',
                        CreatedAt: new Date(),
                    },
                });

                // Also reverse any existing ledger entries for this sale
                const existingLedgerEntries = await tx.customerLedgerEntries.findMany({
                    where: { SaleId: sale.Id },
                });

                for (const entry of existingLedgerEntries) {
                    await tx.customerLedgerEntries.create({
                        data: {
                            Id: randomUUID(),
                            CustomerId: sale.CustomerId,
                            SaleId: sale.Id,
                            Debit: entry.Credit || 0,
                            Credit: entry.Debit || 0,
                            Type: 'CANCELLATION_REVERSAL',
                            CreatedAt: new Date(),
                        },
                    });
                }
            }

            // 7. Reverse cash ledger (if cash or card payment)
            const paidAmount = Number(sale.PaidAmount || 0);
            if (paidAmount > 0 && (sale.paymentMode === 'cash' || sale.paymentMode === 'card')) {
                await this.cashLedger.add(
                    'OUT',
                    paidAmount,
                    'CANCELLATION',
                    sale.InvoiceNumber,
                    `Cancellation refund for ${sale.InvoiceNumber}${reason ? ` (${reason})` : ''}`
                );
            }

            // 8. Reverse credit payments (if any)
            if (sale.CreditPayments && sale.CreditPayments.length > 0) {
                for (const payment of sale.CreditPayments) {
                    // Create reverse entry in credit payments
                    await tx.creditPayments.create({
                        data: {
                            Id: randomUUID(),
                            SaleId: sale.Id,
                            Amount: -Number(payment.Amount || 0),
                            PaidAt: new Date(),
                            Note: `Cancellation reversal${reason ? `: ${reason}` : ''}`,
                        },
                    });

                    // Reverse customer credit balance for the payment
                    if (sale.CustomerId) {
                        await tx.customers.update({
                            where: { Id: sale.CustomerId },
                            data: {
                                CreditBalance: { increment: Number(payment.Amount || 0) },
                            },
                        });
                    }
                }
            }

            // 9. Reverse sale payments
            if (sale.SalePayments && sale.SalePayments.length > 0) {
                for (const payment of sale.SalePayments) {
                    await tx.salePayments.create({
                        data: {
                            Id: randomUUID(),
                            SaleId: sale.Id,
                            PaymentMode: payment.PaymentMode,
                            Amount: -Number(payment.Amount || 0),
                            PaidAt: new Date(),
                            Status: 'cancelled',
                            Reference: `Cancellation of ${payment.Reference || payment.Id}`,
                        },
                    });
                }
            }

            // 10. Update sale status to CANCELLED
            const updatedSale = await tx.sales.update({
                where: { Id: sale.Id },
                data: {
                    Status: 4, // 4 = CANCELLED
                    BalanceAmount: 0,
                    PaidAmount: 0,
                    IsCreditSale: false,
                },
            });

            return {
                message: `Sale ${sale.InvoiceNumber} cancelled successfully${reason ? ` (${reason})` : ''}`,
                sale: updatedSale,
            };
        }, {
            timeout: 30000,
            maxWait: 15000,
        });
    }

    // ============================
    // ✅ CANCEL SALE BY INVOICE NUMBER (NEW)
    // ============================
    async cancelSaleByInvoice(invoiceNumber: string, reason?: string) {
        const sale = await this.prisma.sales.findFirst({
            where: { InvoiceNumber: invoiceNumber },
        });

        if (!sale) {
            throw new NotFoundException(`Sale with invoice ${invoiceNumber} not found`);
        }

        return this.cancelSale(sale.Id, reason);
    }

    // src/sales/sales.service.ts - Add edit sale functionality

    async editSaleAfterCheckout(saleId: string, dto: EditSaleDto) {
        return await this.prisma.$transaction(async (tx) => {
            const sale = await tx.sales.findUnique({
                where: { Id: saleId },
                include: {
                    SaleItems: {
                        include: { Products: true },
                    },
                    Customers: true,
                    SalePayments: true,
                    CreditPayments: true,
                },
            });

            if (!sale) {
                throw new NotFoundException('Sale not found');
            }

            if (sale.Status === 2 || sale.Status === 4) {
                throw new BadRequestException('Cannot edit returned or cancelled invoice');
            }

            const changes: any[] = [];

            // ✅ PROCESS ITEM UPDATES (if any)
            if (dto.items && dto.items.length > 0) {
                const existingItems = sale.SaleItems;
                const dtoProductIds = dto.items
                    .map(item => item.productId)
                    .filter((id): id is string => !!id);

                // Find items to remove
                const itemsToRemove = existingItems.filter(
                    item => !dtoProductIds.includes(item.ProductId)
                );

                for (const item of itemsToRemove) {
                    await tx.products.update({
                        where: { Id: item.ProductId },
                        data: { StockQty: { increment: item.Quantity } },
                    });
                    await tx.saleItems.delete({ where: { Id: item.Id } });
                    changes.push({
                        action: 'REMOVE_ITEM',
                        productId: item.ProductId,
                        productName: item.Products?.Name || 'Unknown',
                        quantity: item.Quantity,
                    });
                }

                // Process new or updated items
                for (const dtoItem of dto.items) {
                    if (!dtoItem.productId) continue;

                    const existingItem = existingItems.find(
                        item => item.ProductId === dtoItem.productId
                    );

                    if (existingItem) {
                        // UPDATE EXISTING ITEM
                        const oldQty = existingItem.Quantity;
                        const newQty = dtoItem.quantity || existingItem.Quantity;
                        const qtyDiff = oldQty - newQty;

                        // Update stock
                        if (qtyDiff > 0) {
                            await tx.products.update({
                                where: { Id: existingItem.ProductId },
                                data: { StockQty: { increment: qtyDiff } },
                            });
                        } else if (qtyDiff < 0) {
                            const product = await tx.products.findUnique({
                                where: { Id: existingItem.ProductId },
                            });
                            if (product && product.StockQty < Math.abs(qtyDiff)) {
                                throw new BadRequestException('Not enough stock available');
                            }
                            await tx.products.update({
                                where: { Id: existingItem.ProductId },
                                data: { StockQty: { decrement: Math.abs(qtyDiff) } },
                            });
                        }

                        // ✅ Calculate new item total with PER-UNIT discount
                        const perUnitDiscount = Number(dtoItem.discount ?? 0);
                        const unitPrice = Number(existingItem.UnitPrice);
                        const totalDiscount = perUnitDiscount * newQty;
                        const newTotal = (unitPrice * newQty) - totalDiscount;

                        await tx.saleItems.update({
                            where: { Id: existingItem.Id },
                            data: {
                                Quantity: newQty,
                                Discount: totalDiscount, // ✅ Store total discount
                                Total: newTotal,
                            },
                        });

                        changes.push({
                            action: 'UPDATE_ITEM',
                            productId: existingItem.ProductId,
                            productName: existingItem.Products?.Name || 'Unknown',
                            oldQuantity: oldQty,
                            newQuantity: newQty,
                            perUnitDiscount: perUnitDiscount,
                        });
                    } else {
                        // ADD NEW ITEM
                        const product = await tx.products.findUnique({
                            where: { Id: dtoItem.productId },
                        });

                        if (!product) {
                            throw new BadRequestException('Product not found');
                        }

                        const qty = dtoItem.quantity || 1;
                        if (product.StockQty < qty) {
                            throw new BadRequestException('Not enough stock available');
                        }

                        await tx.products.update({
                            where: { Id: dtoItem.productId },
                            data: { StockQty: { decrement: qty } },
                        });

                        const perUnitDiscount = Number(dtoItem.discount ?? 0);
                        const unitPrice = Number(product.Price);
                        const totalDiscount = perUnitDiscount * qty;
                        const newTotal = (unitPrice * qty) - totalDiscount;

                        await tx.saleItems.create({
                            data: {
                                Id: randomUUID(),
                                SaleId: sale.Id,
                                ProductId: dtoItem.productId,
                                Quantity: qty,
                                UnitPrice: unitPrice,
                                Discount: totalDiscount,
                                Total: newTotal,
                            },
                        });

                        changes.push({
                            action: 'ADD_ITEM',
                            productId: dtoItem.productId,
                            productName: product.Name,
                            quantity: qty,
                            perUnitDiscount: perUnitDiscount,
                        });
                    }
                }
            }

            // ✅ UPDATE INVOICE DISCOUNT (Separate from item discounts)
            let invoiceDiscount = Number(sale.InvoiceDiscount);
            if (dto.invoiceDiscount !== undefined) {
                invoiceDiscount = dto.invoiceDiscount;

                await tx.sales.update({
                    where: { Id: sale.Id },
                    data: { InvoiceDiscount: invoiceDiscount },
                });

                changes.push({
                    action: 'UPDATE_INVOICE_DISCOUNT',
                    oldDiscount: sale.InvoiceDiscount,
                    newDiscount: invoiceDiscount,
                });
            }

            // ✅ UPDATE PAYMENT MODE
            if (dto.paymentMode) {
                await tx.sales.update({
                    where: { Id: sale.Id },
                    data: { paymentMode: dto.paymentMode },
                });

                changes.push({
                    action: 'UPDATE_PAYMENT_MODE',
                    oldPaymentMode: sale.paymentMode,
                    newPaymentMode: dto.paymentMode,
                });
            }

            // ✅ RECALCULATE TOTALS
            const updatedItems = await tx.saleItems.findMany({
                where: { SaleId: sale.Id },
            });

            // Subtotal = sum of all item totals (after item discounts)
            const subtotal = updatedItems.reduce(
                (sum, item) => sum + Number(item.Total),
                0
            );

            // ✅ Total = subtotal - invoice discount
            const totalAmount = Math.max(0, subtotal - invoiceDiscount);
            const paidAmount = Number(sale.PaidAmount);
            const balance = Math.max(0, totalAmount - paidAmount);

            // ✅ UPDATE SALE
            const updatedSale = await tx.sales.update({
                where: { Id: sale.Id },
                data: {
                    SubTotal: subtotal,
                    CreatedAt: dto.createdAt ? new Date(dto.createdAt) : sale.CreatedAt,
                    TotalAmount: totalAmount,
                    BalanceAmount: balance,
                    IsCreditSale: balance > 0,
                },
                include: {
                    Customers: true,
                    SaleItems: {
                        include: {
                            Products: true,
                        },
                    },
                    SalePayments: true,
                    CreditPayments: true,
                },
            });

            // ✅ UPDATE CUSTOMER CREDIT BALANCE
            if (updatedSale.CustomerId) {
                await this.recalculateCustomerBalance(tx, updatedSale.CustomerId);
            }

            console.log('📝 Invoice Edit Summary:', {
                invoiceNumber: sale.InvoiceNumber,
                changes,
                totals: {
                    oldTotal: sale.TotalAmount,
                    newTotal: totalAmount,
                    oldBalance: sale.BalanceAmount,
                    newBalance: balance,
                    oldSubtotal: sale.SubTotal,
                    newSubtotal: subtotal,
                    invoiceDiscount: invoiceDiscount,
                },
            });

            return {
                message: 'Sale updated successfully',
                sale: updatedSale,
                changes,
                summary: {
                    oldTotal: sale.TotalAmount,
                    newTotal: totalAmount,
                    oldBalance: sale.BalanceAmount,
                    newBalance: balance,
                    oldSubtotal: sale.SubTotal,
                    newSubtotal: subtotal,
                    invoiceDiscount: invoiceDiscount,
                    itemsAdded: changes.filter(c => c.action === 'ADD_ITEM').length,
                    itemsRemoved: changes.filter(c => c.action === 'REMOVE_ITEM').length,
                    itemsUpdated: changes.filter(c => c.action === 'UPDATE_ITEM').length,
                },
            };
        }, {
            timeout: 30000,
            maxWait: 15000,
        });
    }





    async updateSaleItem(saleId: string, itemId: string, dto: UpdateSaleItemDto) {
        console.log('🔍 updateSaleItem called with:', { saleId, itemId, dto });

        return await this.prisma.$transaction(async (tx) => {
            // 1. Check if sale exists and is editable
            const sale = await tx.sales.findUnique({
                where: { Id: saleId },
                include: { SaleItems: true },
            });

            if (!sale) {
                throw new NotFoundException('Sale not found');
            }

            if (sale.Status === 2 || sale.Status === 4) {
                throw new BadRequestException('Cannot edit returned or cancelled invoice');
            }

            // 2. Find the sale item
            let saleItem = await tx.saleItems.findUnique({
                where: { Id: itemId },
                include: { Products: true },
            });

            if (!saleItem) {
                // Try finding by ProductId as fallback
                saleItem = await tx.saleItems.findFirst({
                    where: {
                        SaleId: saleId,
                        ProductId: itemId,
                    },
                    include: { Products: true },
                });

                if (!saleItem) {
                    throw new NotFoundException(`Sale item not found with Id: ${itemId}`);
                }
            }

            console.log('✅ Found sale item:', {
                Id: saleItem.Id,
                Quantity: saleItem.Quantity,
                UnitPrice: saleItem.UnitPrice,
                CurrentDiscount: saleItem.Discount,
            });

            // 3. Calculate stock adjustment
            const oldQuantity = Number(saleItem.Quantity);
            const newQuantity = Number(dto.quantity);
            const quantityDiff = oldQuantity - newQuantity;

            // 4. Update stock
            if (quantityDiff > 0) {
                await tx.products.update({
                    where: { Id: saleItem.ProductId },
                    data: { StockQty: { increment: quantityDiff } },
                });
            } else if (quantityDiff < 0) {
                const product = await tx.products.findUnique({
                    where: { Id: saleItem.ProductId },
                });
                if (product && product.StockQty < Math.abs(quantityDiff)) {
                    throw new BadRequestException(
                        `Not enough stock available for ${product.Name}. Available: ${product.StockQty}`
                    );
                }
                await tx.products.update({
                    where: { Id: saleItem.ProductId },
                    data: { StockQty: { decrement: Math.abs(quantityDiff) } },
                });
            }

            // 5. ✅ FIX: Calculate discount correctly
            // The discount from frontend is the PER-UNIT discount amount
            // So total discount = perUnitDiscount * quantity
            const unitPrice = Number(saleItem.UnitPrice);
            const perUnitDiscount = Number(dto.discount ?? 0);
            const totalDiscount = perUnitDiscount * newQuantity;

            // Calculate new total
            const newTotal = (unitPrice * newQuantity) - totalDiscount;

            console.log('📊 Discount calculation:', {
                unitPrice,
                perUnitDiscount,
                newQuantity,
                totalDiscount,
                newTotal,
            });

            // 6. Update sale item
            const updatedItem = await tx.saleItems.update({
                where: { Id: itemId },
                data: {
                    Quantity: newQuantity,
                    Discount: totalDiscount, // ✅ Store TOTAL discount, not per-unit
                    Total: newTotal,
                },
                include: {
                    Products: true,
                },
            });

            console.log('✅ Updated item:', {
                Id: updatedItem.Id,
                Quantity: updatedItem.Quantity,
                Discount: updatedItem.Discount,
                Total: updatedItem.Total,
            });

            // 7. Recalculate sale totals
            await this.recalculateSaleTotals(tx, saleId);

            // 8. Calculate discount percentage correctly for response
            const perUnitDiscountValue = Number(updatedItem.Discount) / Number(updatedItem.Quantity);
            const unitPriceValue = Number(updatedItem.UnitPrice);
            const discountPercent = unitPriceValue > 0
                ? Math.round((perUnitDiscountValue / unitPriceValue) * 100)
                : 0;

            return {
                message: 'Sale item updated successfully',
                item: {
                    Id: updatedItem.Id,
                    SaleId: updatedItem.SaleId,
                    ProductId: updatedItem.ProductId,
                    Quantity: updatedItem.Quantity,
                    UnitPrice: updatedItem.UnitPrice,
                    Total: updatedItem.Total,
                    Discount: updatedItem.Discount,
                    DiscountPercent: discountPercent,
                    PerUnitDiscount: perUnitDiscountValue,
                    ProductName: updatedItem.Products?.Name || 'Unknown Product',
                    Products: updatedItem.Products,
                },
            };
        }, {
            timeout: 30000,
            maxWait: 15000,
        });
    }

    // =========================
    // INTERNAL HELPER: Update Sale Item (for fallback)
    // =========================
    private async updateSaleItemInternal(
        tx: any,
        saleId: string,
        itemId: string,
        dto: UpdateSaleItemDto
    ) {
        // Find the sale item
        const saleItem = await tx.saleItems.findUnique({
            where: { Id: itemId },
            include: { Products: true },
        });

        if (!saleItem) {
            throw new NotFoundException(`Sale item not found with Id: ${itemId}`);
        }

        // Calculate stock adjustment
        const oldQuantity = Number(saleItem.Quantity);
        const newQuantity = Number(dto.quantity);
        const quantityDiff = oldQuantity - newQuantity;

        // Update stock
        if (quantityDiff > 0) {
            await tx.products.update({
                where: { Id: saleItem.ProductId },
                data: { StockQty: { increment: quantityDiff } },
            });
        } else if (quantityDiff < 0) {
            const product = await tx.products.findUnique({
                where: { Id: saleItem.ProductId },
            });
            if (product && product.StockQty < Math.abs(quantityDiff)) {
                throw new BadRequestException('Not enough stock available');
            }
            await tx.products.update({
                where: { Id: saleItem.ProductId },
                data: { StockQty: { decrement: Math.abs(quantityDiff) } },
            });
        }

        // Calculate new total
        const newDiscount = Number(dto.discount ?? saleItem.Discount);
        const unitPrice = Number(saleItem.UnitPrice);
        const newTotal = (unitPrice * newQuantity) - newDiscount;

        // Update sale item
        const updatedItem = await tx.saleItems.update({
            where: { Id: itemId },
            data: {
                Quantity: newQuantity,
                Discount: newDiscount,
                Total: newTotal,
            },
            include: {
                Products: true,
            },
        });

        // Recalculate sale totals
        await this.recalculateSaleTotals(tx, saleId);

        // Calculate discount percentage correctly
        const perUnitDiscount = Number(updatedItem.Discount);
        const unitPriceValue = Number(updatedItem.UnitPrice);
        const discountPercent = unitPriceValue > 0
            ? Math.round((perUnitDiscount / unitPriceValue) * 100)
            : 0;

        return {
            message: 'Sale item updated successfully',
            item: {
                Id: updatedItem.Id,
                SaleId: updatedItem.SaleId,
                ProductId: updatedItem.ProductId,
                Quantity: updatedItem.Quantity,
                UnitPrice: updatedItem.UnitPrice,
                Total: updatedItem.Total,
                Discount: updatedItem.Discount,
                DiscountPercent: discountPercent,
                ProductName: updatedItem.Products?.Name || 'Unknown Product',
                Products: updatedItem.Products,
            },
        };
    }

    // =========================
    // HELPER: Recalculate Sale Totals
    // =========================
    private async recalculateSaleTotals(tx: any, saleId: string) {
        // Get all sale items
        const items = await tx.saleItems.findMany({
            where: { SaleId: saleId },
        });

        // Calculate subtotal
        const subtotal = items.reduce((sum, item) => sum + Number(item.Total), 0);

        // Get sale
        const sale = await tx.sales.findUnique({
            where: { Id: saleId },
        });

        // Calculate total with discount
        const invoiceDiscount = Number(sale?.InvoiceDiscount || 0);
        const totalAmount = Math.max(0, subtotal - invoiceDiscount);

        // Calculate balance
        const paidAmount = Number(sale?.PaidAmount || 0);
        const balance = Math.max(0, totalAmount - paidAmount);

        // Update sale
        await tx.sales.update({
            where: { Id: saleId },
            data: {
                SubTotal: subtotal,
                TotalAmount: totalAmount,
                BalanceAmount: balance,
                IsCreditSale: balance > 0,
            },
        });

        // Update customer credit balance if credit sale
        if (sale?.CustomerId && sale?.IsCreditSale) {
            const allSales = await tx.sales.findMany({
                where: {
                    CustomerId: sale.CustomerId,
                    BalanceAmount: { gt: 0 },
                },
            });
            const totalOutstanding = allSales.reduce(
                (sum, s) => sum + Number(s.BalanceAmount),
                0
            );
            await tx.customers.update({
                where: { Id: sale.CustomerId },
                data: {
                    CreditBalance: totalOutstanding,
                },
            });
        }
    }

    // =========================
    // ADD ITEM TO SALE
    // =========================
    async addSaleItem(saleId: string, dto: AddSaleItemDto) {
        return await this.prisma.$transaction(async (tx) => {
            // 1. Check if sale exists and is editable
            const sale = await tx.sales.findUnique({
                where: { Id: saleId },
                include: { SaleItems: true },
            });

            if (!sale) {
                throw new NotFoundException('Sale not found');
            }

            if (sale.Status === 2 || sale.Status === 4) {
                throw new BadRequestException('Cannot add items to returned or cancelled invoice');
            }

            // ✅ FIX: Ensure productId exists
            if (!dto.productId) {
                throw new BadRequestException('Product ID is required');
            }

            // 2. Get product
            const product = await tx.products.findUnique({
                where: { Id: dto.productId },
            });

            if (!product) {
                throw new BadRequestException('Product not found');
            }

            // ✅ FIX: Ensure quantity is a number
            const quantity = Number(dto.quantity || 0);
            if (quantity <= 0) {
                throw new BadRequestException('Quantity must be greater than 0');
            }

            if (product.StockQty < quantity) {
                throw new BadRequestException('Not enough stock available');
            }

            // 3. Reduce stock
            await tx.products.update({
                where: { Id: dto.productId },
                data: { StockQty: { decrement: quantity } },
            });

            // 4. Create sale item - ✅ FIX: All values are now guaranteed to be defined
            const discount = Number(dto.discount ?? 0);
            const unitPrice = Number(product.Price);
            const total = (unitPrice * quantity) - discount;

            const newItem = await tx.saleItems.create({
                data: {
                    Id: randomUUID(),
                    SaleId: saleId,
                    ProductId: dto.productId, // ✅ Now guaranteed to be a string
                    Quantity: quantity,
                    UnitPrice: unitPrice,
                    Discount: discount,
                    Total: total,
                },
                include: {
                    Products: true,
                },
            });

            // 5. Recalculate sale totals
            await this.recalculateSaleTotals(tx, saleId);

            return {
                message: 'Item added to sale successfully',
                item: newItem,
            };
        }, {
            timeout: 30000,
            maxWait: 15000,
        });
    }

    // =========================
    // REMOVE ITEM FROM SALE
    // =========================
    async removeSaleItem(saleId: string, itemId: string) {
        return await this.prisma.$transaction(async (tx) => {
            // 1. Check if sale exists and is editable
            const sale = await tx.sales.findUnique({
                where: { Id: saleId },
                include: { SaleItems: true },
            });

            if (!sale) {
                throw new NotFoundException('Sale not found');
            }

            if (sale.Status === 2 || sale.Status === 4) {
                throw new BadRequestException('Cannot remove items from returned or cancelled invoice');
            }

            // 2. Find sale item
            const saleItem = await tx.saleItems.findUnique({
                where: { Id: itemId },
            });

            if (!saleItem) {
                throw new NotFoundException('Sale item not found');
            }

            // 3. Restore stock
            await tx.products.update({
                where: { Id: saleItem.ProductId },
                data: { StockQty: { increment: saleItem.Quantity } },
            });

            // 4. Delete sale item
            await tx.saleItems.delete({
                where: { Id: itemId },
            });

            // 5. Recalculate sale totals
            await this.recalculateSaleTotals(tx, saleId);

            return {
                message: 'Item removed from sale successfully',
            };
        }, {
            timeout: 30000,
            maxWait: 15000,
        });
    }

    private async recalculateCustomerBalance(tx: any, customerId: string): Promise<number> {
        // 1. Get all sales for this customer with outstanding balance
        const sales = await tx.sales.findMany({
            where: {
                CustomerId: customerId,
                BalanceAmount: { gt: 0 },
                Status: { not: 4 }, // Exclude cancelled sales
            },
            select: {
                BalanceAmount: true,
            },
        });

        // 2. Calculate total outstanding balance
        const totalBalance = sales.reduce(
            (sum, sale) => sum + Number(sale.BalanceAmount),
            0
        );

        // 3. Update customer's credit balance
        await tx.customers.update({
            where: { Id: customerId },
            data: {
                CreditBalance: totalBalance,
            },
        });

        console.log(`🔄 Recalculated balance for customer ${customerId}: ${totalBalance}`);

        return totalBalance;
    }

    async recordCreditCheque(dto: RecordCreditChequeDto) {
        return await this.prisma.$transaction(
            async (tx) => {
                const sale = await tx.sales.findUnique({
                    where: { Id: dto.saleId },
                    include: { Customers: true },
                });

                if (!sale) {
                    throw new NotFoundException('Sale not found');
                }

                if (dto.amount <= 0) {
                    throw new BadRequestException('Invalid amount');
                }

                const balance = Number(sale.BalanceAmount);
                if (dto.amount > balance) {
                    throw new BadRequestException(
                        `Exceeds balance. Balance: ${balance}`
                    );
                }

                if (!dto.chequeNumber || !dto.chequeDate) {
                    throw new BadRequestException(
                        'Cheque number and date are required'
                    );
                }

                // 1. Create pending cheque payment row
                const payment = await tx.creditPayments.create({
                    data: {
                        Id: randomUUID(),
                        SaleId: sale.Id,
                        Amount: dto.amount,
                        PaidAt: new Date(),
                        Note: dto.note || 'Cheque payment received',
                        PaymentMethod: 'cheque',
                        Reference: dto.chequeNumber,
                        ChequeDate: new Date(dto.chequeDate),
                        Status: 'pending',
                        ClearedAt: null,
                    },
                });

                // 2. Reduce sale balance / increase paid
                const newPaid = Number(sale.PaidAmount) + dto.amount;
                const newBalance = Math.max(0, balance - dto.amount);

                await tx.sales.update({
                    where: { Id: sale.Id },
                    data: {
                        PaidAmount: newPaid,
                        BalanceAmount: newBalance,
                        IsCreditSale: newBalance > 0,
                    },
                });

                // 3. Customer ledger entry (pending)
                if (sale.CustomerId) {
                    await tx.customerLedgerEntries.create({
                        data: {
                            Id: randomUUID(),
                            CustomerId: sale.CustomerId,
                            SaleId: sale.Id,
                            Debit: dto.amount,
                            Credit: 0,
                            Type: 'CHEQUE_PENDING',
                            CreatedAt: new Date(),
                        },
                    });
                }

                // ⚠️ NO cash ledger entry yet
                // ⚠️ NO salePayments row yet

                return {
                    message: 'Cheque recorded — awaiting clearance',
                    PaymentId: payment.Id,
                    SaleId: sale.Id,
                    InvoiceNumber: sale.InvoiceNumber,
                    Amount: dto.amount,
                    ChequeNumber: dto.chequeNumber,
                    ChequeDate: dto.chequeDate,
                    Status: 'pending',
                    NewPaidAmount: newPaid,
                    NewBalanceAmount: newBalance,
                };
            },
            { timeout: 30000, maxWait: 15000 }
        );
    }

    // ============================================================
    // ✅ GET INCOMING CHEQUES (with optional status filter)
    // ============================================================
    async getIncomingCheques(status?: string) {
        const where: any = { PaymentMethod: 'cheque' };
        if (status) where.Status = status;

        const cheques = await this.prisma.creditPayments.findMany({
            where,
            include: {
                Sales: {
                    include: {
                        Customers: true,
                    },
                },
            },
            orderBy: { PaidAt: 'desc' },
        });

        return cheques.map((c) => ({
            Id: c.Id,
            SaleId: c.SaleId,
            InvoiceNumber: c.Sales?.InvoiceNumber || null,
            CustomerId: c.Sales?.CustomerId || null,
            CustomerName: c.Sales?.Customers?.Name || 'Walk-in Customer',
            CustomerPhone: c.Sales?.Customers?.Phone || null,
            Amount: Number(c.Amount),
            PaymentMethod: c.PaymentMethod,
            Reference: c.Reference,
            ChequeDate: c.ChequeDate,
            Status: c.Status,
            ClearedAt: c.ClearedAt,
            PaidAt: c.PaidAt,
            Note: c.Note,
        }));
    }

    // ============================================================
    // ✅ CLEAR A PENDING CHEQUE
    // ============================================================
    async clearCreditCheque(paymentId: string) {
        return await this.prisma.$transaction(
            async (tx) => {
                const payment = await tx.creditPayments.findUnique({
                    where: { Id: paymentId },
                    include: { Sales: true },
                });

                if (!payment) {
                    throw new NotFoundException('Cheque payment not found');
                }

                if (payment.PaymentMethod !== 'cheque') {
                    throw new BadRequestException('This payment is not a cheque');
                }

                if (payment.Status === 'cleared') {
                    throw new BadRequestException('Cheque already cleared');
                }

                if (payment.Status === 'bounced') {
                    throw new BadRequestException(
                        'Cheque was bounced — cannot clear'
                    );
                }

                const amount = Number(payment.Amount);

                // 1. Mark cleared
                const updated = await tx.creditPayments.update({
                    where: { Id: paymentId },
                    data: {
                        Status: 'cleared',
                        ClearedAt: new Date(),
                    },
                });

                // 2. Post to cash ledger
                await this.cashLedger.add(
                    'IN',
                    amount,
                    'CREDIT_CHEQUE_CLEARED',
                    payment.Sales.InvoiceNumber,
                    `Cheque cleared for ${payment.Sales.InvoiceNumber}${payment.Reference ? ` (Cheque #${payment.Reference})` : ''
                    }`
                );

                // 3. Record in sale payments now that it's cleared
                await tx.salePayments.create({
                    data: {
                        Id: randomUUID(),
                        SaleId: payment.SaleId,
                        PaymentMode: 'cheque',
                        Amount: amount,
                        PaidAt: new Date(),
                        Status: 'completed',
                        Reference: payment.Reference || null,
                    },
                });

                return {
                    Id: updated.Id,
                    Status: updated.Status,
                    ClearedAt: updated.ClearedAt,
                    message: `Cheque cleared — Rs ${amount} posted to cash ledger`,
                };
            },
            { timeout: 30000, maxWait: 15000 }
        );
    }

    // ============================================================
    // ✅ BOUNCE A PENDING CHEQUE
    // ============================================================
    async bounceCreditCheque(paymentId: string, reason?: string) {
        return await this.prisma.$transaction(
            async (tx) => {
                const payment = await tx.creditPayments.findUnique({
                    where: { Id: paymentId },
                    include: { Sales: true },
                });

                if (!payment) {
                    throw new NotFoundException('Cheque payment not found');
                }

                if (payment.PaymentMethod !== 'cheque') {
                    throw new BadRequestException('This payment is not a cheque');
                }

                if (payment.Status === 'cleared') {
                    throw new BadRequestException('Cannot bounce a cleared cheque');
                }

                if (payment.Status === 'bounced') {
                    throw new BadRequestException(
                        'Cheque already marked as bounced'
                    );
                }

                const amount = Number(payment.Amount);
                const sale = payment.Sales;

                // 1. Reverse sale paid / balance
                const newPaid = Math.max(0, Number(sale.PaidAmount) - amount);
                const newBalance = Number(sale.BalanceAmount) + amount;

                await tx.sales.update({
                    where: { Id: sale.Id },
                    data: {
                        PaidAmount: newPaid,
                        BalanceAmount: newBalance,
                        IsCreditSale: true,
                    },
                });

                // 2. Mark payment bounced
                const combinedNote = reason
                    ? `${payment.Note || ''} | BOUNCED: ${reason}`.trim()
                    : `${payment.Note || ''} | BOUNCED`.trim();

                await tx.creditPayments.update({
                    where: { Id: paymentId },
                    data: {
                        Status: 'bounced',
                        ClearedAt: null,
                        Note: combinedNote,
                    },
                });

                // 3. Reverse customer ledger
                if (sale.CustomerId) {
                    await tx.customerLedgerEntries.create({
                        data: {
                            Id: randomUUID(),
                            CustomerId: sale.CustomerId,
                            SaleId: sale.Id,
                            Debit: 0,
                            Credit: amount,
                            Type: 'CHEQUE_BOUNCED',
                            CreatedAt: new Date(),
                        },
                    });
                }

                return {
                    Id: paymentId,
                    Status: 'bounced',
                    NewPaidAmount: newPaid,
                    NewBalanceAmount: newBalance,
                    message: `Cheque bounced — Rs ${amount} re-added to outstanding`,
                };
            },
            { timeout: 30000, maxWait: 15000 }
        );
    }


    async recordBulkCreditCheque(dto: RecordBulkCreditChequeDto) {
        return await this.prisma.$transaction(
            async (tx) => {
                // 1. Fetch all selected sales, verify they belong to the same customer
                const sales = await tx.sales.findMany({
                    where: { Id: { in: dto.saleIds } },
                    include: { Customers: true },
                });

                if (sales.length !== dto.saleIds.length) {
                    throw new NotFoundException('One or more sales not found');
                }

                const customerIds = new Set(
                    sales.map((s) => s.CustomerId).filter((id) => !!id)
                );

                if (customerIds.size === 0) {
                    throw new BadRequestException(
                        'Selected invoices must belong to a customer'
                    );
                }

                if (customerIds.size > 1) {
                    throw new BadRequestException(
                        'All selected invoices must belong to the same customer'
                    );
                }

                // 2. Verify every sale has an outstanding balance
                const emptyBalances = sales.filter(
                    (s) => Number(s.BalanceAmount) <= 0
                );
                if (emptyBalances.length > 0) {
                    throw new BadRequestException(
                        `Some invoices have no outstanding balance: ${emptyBalances
                            .map((s) => s.InvoiceNumber)
                            .join(', ')}`
                    );
                }

                // 3. Compute total = sum of balances
                const totalAmount = sales.reduce(
                    (sum, s) => sum + Number(s.BalanceAmount),
                    0
                );

                if (!dto.chequeNumber || !dto.chequeDate) {
                    throw new BadRequestException(
                        'Cheque number and date are required'
                    );
                }

                const chequeDate = new Date(dto.chequeDate);
                const customerId = sales[0].CustomerId!;

                // 4. Create one CreditPayments row per sale + reduce balance
                const createdPayments: any[] = [];

                for (const sale of sales) {
                    const amount = Number(sale.BalanceAmount);
                    const newPaid = Number(sale.PaidAmount) + amount;
                    const newBalance = 0; // fully settled per Option X

                    const payment = await tx.creditPayments.create({
                        data: {
                            Id: randomUUID(),
                            SaleId: sale.Id,
                            Amount: amount,
                            PaidAt: new Date(),
                            Note:
                                dto.note ||
                                `Cheque payment — ${sales.length} invoice(s)`,
                            PaymentMethod: 'cheque',
                            Reference: dto.chequeNumber,
                            ChequeDate: chequeDate,
                            Status: 'pending',
                            ClearedAt: null,
                        },
                    });

                    await tx.sales.update({
                        where: { Id: sale.Id },
                        data: {
                            PaidAmount: newPaid,
                            BalanceAmount: newBalance,
                            IsCreditSale: false,
                        },
                    });

                    await tx.customerLedgerEntries.create({
                        data: {
                            Id: randomUUID(),
                            CustomerId: customerId,
                            SaleId: sale.Id,
                            Debit: amount,
                            Credit: 0,
                            Type: 'CHEQUE_PENDING',
                            CreatedAt: new Date(),
                        },
                    });

                    createdPayments.push({
                        PaymentId: payment.Id,
                        SaleId: sale.Id,
                        InvoiceNumber: sale.InvoiceNumber,
                        Amount: amount,
                    });
                }

                return {
                    message: `Cheque recorded against ${sales.length} invoice(s) — awaiting clearance`,
                    ChequeNumber: dto.chequeNumber,
                    ChequeDate: dto.chequeDate,
                    TotalAmount: totalAmount,
                    InvoiceCount: sales.length,
                    Payments: createdPayments,
                    Status: 'pending',
                };
            },
            { timeout: 30000, maxWait: 15000 }
        );
    }

    // ============================================================
    // ✅ CLEAR ALL PENDING CHEQUE ROWS SHARING A REFERENCE
    // ============================================================
    async clearCreditChequesByReference(reference: string) {
        return await this.prisma.$transaction(
            async (tx) => {
                const rows = await tx.creditPayments.findMany({
                    where: {
                        PaymentMethod: 'cheque',
                        Reference: reference,
                    },
                    include: { Sales: true },
                });

                if (rows.length === 0) {
                    throw new NotFoundException(
                        `No cheque payments found with reference ${reference}`
                    );
                }

                const alreadyCleared = rows.filter((r) => r.Status === 'cleared');
                if (alreadyCleared.length === rows.length) {
                    throw new BadRequestException('Cheque already cleared');
                }

                const bounced = rows.filter((r) => r.Status === 'bounced');
                if (bounced.length > 0) {
                    throw new BadRequestException(
                        'Cheque was bounced — cannot clear'
                    );
                }

                let totalCleared = 0;
                let clearedCount = 0;

                for (const row of rows) {
                    if (row.Status !== 'pending') continue;

                    const amount = Number(row.Amount);
                    totalCleared += amount;
                    clearedCount++;

                    await tx.creditPayments.update({
                        where: { Id: row.Id },
                        data: {
                            Status: 'cleared',
                            ClearedAt: new Date(),
                        },
                    });

                    await this.cashLedger.add(
                        'IN',
                        amount,
                        'CREDIT_CHEQUE_CLEARED',
                        row.Sales.InvoiceNumber,
                        `Cheque cleared for ${row.Sales.InvoiceNumber} (Cheque #${reference})`
                    );

                    await tx.salePayments.create({
                        data: {
                            Id: randomUUID(),
                            SaleId: row.SaleId,
                            PaymentMode: 'cheque',
                            Amount: amount,
                            PaidAt: new Date(),
                            Status: 'completed',
                            Reference: reference,
                        },
                    });
                }

                return {
                    ChequeNumber: reference,
                    InvoicesCleared: clearedCount,
                    TotalCleared: totalCleared,
                    message: `Cheque cleared — Rs ${totalCleared} posted across ${clearedCount} invoice(s)`,
                };
            },
            { timeout: 30000, maxWait: 15000 }
        );
    }

    // ============================================================
    // ✅ BOUNCE ALL PENDING CHEQUE ROWS SHARING A REFERENCE
    // ============================================================
    async bounceCreditChequesByReference(reference: string, reason?: string) {
        return await this.prisma.$transaction(
            async (tx) => {
                const rows = await tx.creditPayments.findMany({
                    where: {
                        PaymentMethod: 'cheque',
                        Reference: reference,
                    },
                    include: { Sales: true },
                });

                if (rows.length === 0) {
                    throw new NotFoundException(
                        `No cheque payments found with reference ${reference}`
                    );
                }

                const cleared = rows.filter((r) => r.Status === 'cleared');
                if (cleared.length > 0) {
                    throw new BadRequestException(
                        'Cannot bounce a cleared cheque'
                    );
                }

                const alreadyBounced = rows.filter((r) => r.Status === 'bounced');
                if (alreadyBounced.length === rows.length) {
                    throw new BadRequestException(
                        'Cheque already marked as bounced'
                    );
                }

                let totalReversed = 0;
                let bouncedCount = 0;

                for (const row of rows) {
                    if (row.Status !== 'pending') continue;

                    const amount = Number(row.Amount);
                    const sale = row.Sales;
                    totalReversed += amount;
                    bouncedCount++;

                    // Reverse sale
                    const newPaid = Math.max(
                        0,
                        Number(sale.PaidAmount) - amount
                    );
                    const newBalance = Number(sale.BalanceAmount) + amount;

                    await tx.sales.update({
                        where: { Id: sale.Id },
                        data: {
                            PaidAmount: newPaid,
                            BalanceAmount: newBalance,
                            IsCreditSale: true,
                        },
                    });

                    const combinedNote = reason
                        ? `${row.Note || ''} | BOUNCED: ${reason}`.trim()
                        : `${row.Note || ''} | BOUNCED`.trim();

                    await tx.creditPayments.update({
                        where: { Id: row.Id },
                        data: {
                            Status: 'bounced',
                            ClearedAt: null,
                            Note: combinedNote,
                        },
                    });

                    if (sale.CustomerId) {
                        await tx.customerLedgerEntries.create({
                            data: {
                                Id: randomUUID(),
                                CustomerId: sale.CustomerId,
                                SaleId: sale.Id,
                                Debit: 0,
                                Credit: amount,
                                Type: 'CHEQUE_BOUNCED',
                                CreatedAt: new Date(),
                            },
                        });
                    }
                }

                return {
                    ChequeNumber: reference,
                    InvoicesReversed: bouncedCount,
                    TotalReversed: totalReversed,
                    message: `Cheque bounced — Rs ${totalReversed} re-added to outstanding across ${bouncedCount} invoice(s)`,
                };
            },
            { timeout: 30000, maxWait: 15000 }
        );
    }


    async getAllReturns(filters?: {
    startDate?: Date;
    endDate?: Date;
    customerId?: string;
    productId?: string;
}) {
    const where: any = {};

    if (filters?.startDate || filters?.endDate) {
        where.ReturnedAt = {};
        if (filters.startDate) where.ReturnedAt.gte = filters.startDate;
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setUTCDate(end.getUTCDate() + 1);
            where.ReturnedAt.lt = end;
        }
    }

    if (filters?.customerId) {
        where.Sales = { CustomerId: filters.customerId };
    }

    const returns = await this.prisma.saleReturns.findMany({
        where,
        include: {
            Sales: {
                include: {
                    Customers: true,
                },
            },
            SaleReturnItems: {
                include: {
                    Products: true,
                },
            },
        },
        orderBy: {
            ReturnedAt: 'desc',
        },
    });

    return returns.map((r) => ({
        Id: r.Id,
        ReturnedAt: r.ReturnedAt,
        Reason: r.Reason,
        ReturnAmount: Number(r.ReturnAmount),
        RefundAmount: Number(r.RefundAmount || 0),
        RefundMethod: r.RefundMethod,

        SaleId: r.SaleId,
        InvoiceNumber: r.Sales?.InvoiceNumber || null,
        SaleDate: r.Sales?.CreatedAt || null,

        CustomerId: r.Sales?.CustomerId || null,
        CustomerName: r.Sales?.Customers?.Name || 'Walk-in Customer',
        CustomerPhone: r.Sales?.Customers?.Phone || null,

        Items: r.SaleReturnItems.map((ri) => ({
            ProductId: ri.ProductId,
            ProductName: ri.Products?.Name || 'Unknown',
            ProductBarcode: ri.Products?.Barcode || null,
            Quantity: ri.Quantity,
            UnitPrice: Number(ri.UnitPrice),
            Reason: ri.Reason,
            LineTotal: Number(ri.UnitPrice) * ri.Quantity,
        })),
    }));
}


}