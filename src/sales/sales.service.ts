import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashLedgerService } from '../cash-ledger/cash-ledger.service';
import { CreateCheckoutDto } from './dto/checkout.dto';
import { randomUUID } from 'crypto';
import { CreateSaleReturnDto } from './dto/return-sale.dto';

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
                timeout: 15000,
                maxWait: 5000,
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
    async returnItems(dto: CreateSaleReturnDto) {
        return await this.prisma.$transaction(
            async (tx) => {
                const sale = await tx.sales.findFirst({
                    where: { InvoiceNumber: dto.invoiceNumber },
                    include: {
                        SaleItems: true,
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

                    // Calculate already returned quantity
                    const alreadyReturned = sale.SaleReturns.reduce(
                        (sum, ret) =>
                            sum +
                            ret.SaleReturnItems.filter(
                                (ri) => ri.ProductId === item.productId
                            ).reduce((s, ri) => s + ri.Quantity, 0),
                        0
                    );

                    const availableQty = saleItem.Quantity - alreadyReturned;

                    if (item.quantity > availableQty) {
                        throw new BadRequestException(
                            `Return quantity (${item.quantity}) exceeds available quantity (${availableQty}) for product`
                        );
                    }

                    const refund = Number(saleItem.UnitPrice) * item.quantity;
                    totalRefund += refund;

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
                }

                // Update return total
                await tx.saleReturns.update({
                    where: { Id: saleReturn.Id },
                    data: { ReturnAmount: totalRefund },
                });

                // Update sale
                const totalReturned = Number(sale.ReturnedAmount ?? 0) + totalRefund;
                const newPaid = Math.max(0, Number(sale.PaidAmount) - totalRefund);
                const newBalance = Math.max(0, Number(sale.TotalAmount) - totalReturned);

                let status = SaleStatus.PENDING;
                if (totalReturned >= Number(sale.TotalAmount)) {
                    status = SaleStatus.FULLY_RETURNED;
                } else if (totalReturned > 0) {
                    status = SaleStatus.PARTIALLY_RETURNED;
                }

                await tx.sales.update({
                    where: { Id: sale.Id },
                    data: {
                        HasReturns: true,
                        ReturnedAmount: totalReturned,
                        PaidAmount: newPaid,
                        BalanceAmount: newBalance,
                        Status: status,
                    },
                });

                // Customer ledger and credit balance update
                if (sale.CustomerId) {
                    // Create customer ledger entry for the return
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

                    // UPDATE CUSTOMER'S CREDIT BALANCE (DECREASE IT)
                    // Only if the customer exists and the sale was a credit sale or had balance
                    if (sale.Customers && sale.IsCreditSale) {
                        const currentBalance = Number(sale.Customers.CreditBalance) || 0;
                        const refundAmount = Math.min(totalRefund, currentBalance);

                        if (refundAmount > 0) {
                            await tx.customers.update({
                                where: { Id: sale.CustomerId },
                                data: {
                                    CreditBalance: { decrement: refundAmount },
                                    TotalSpent: { decrement: totalRefund },
                                },
                            });
                        }
                    }
                }

                // Cash refund
                const cashRefund = Math.min(totalRefund, Number(sale.PaidAmount));
                if (cashRefund > 0) {
                    await this.cashLedger.add(
                        'OUT',
                        cashRefund,
                        'RETURN',
                        dto.invoiceNumber,
                        `Refund for ${dto.invoiceNumber}`
                    );
                }

                // Get updated customer data
                const updatedCustomer = sale.CustomerId ? await tx.customers.findUnique({
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
                }) : null;

                return {
                    message: 'Return processed successfully',
                    refund: totalRefund,
                    cashRefund: cashRefund,
                    invoiceNumber: dto.invoiceNumber,
                    CustomerCreditBalance: updatedCustomer?.CreditBalance ? Number(updatedCustomer.CreditBalance) : 0,
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

            // Update sale
            await tx.sales.update({
                where: { Id: sale.Id },
                data: {
                    Status: SaleStatus.FULLY_RETURNED,
                    PaidAmount: 0,
                    BalanceAmount: 0,
                    IsCreditSale: false,
                    HasReturns: true,
                    ReturnedAmount: totalAmount,
                },
            });

            // Customer ledger and credit balance update
            if (sale.CustomerId) {
                // Create customer ledger entry for the return
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

                // UPDATE CUSTOMER'S CREDIT BALANCE (DECREASE IT)
                if (sale.Customers) {
                    const currentBalance = Number(sale.Customers.CreditBalance) || 0;
                    const refundAmount = Math.min(totalAmount, currentBalance);

                    if (refundAmount > 0) {
                        await tx.customers.update({
                            where: { Id: sale.CustomerId },
                            data: {
                                CreditBalance: { decrement: refundAmount },
                                TotalSpent: { decrement: totalAmount },
                            },
                        });
                    }
                }
            }

            // Cash refund
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

            // Get updated customer data
            const updatedCustomer = sale.CustomerId ? await tx.customers.findUnique({
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
            }) : null;

            return {
                message: 'Return processed',
                invoiceNumber,
                CustomerCreditBalance: updatedCustomer?.CreditBalance ? Number(updatedCustomer.CreditBalance) : 0,
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
}