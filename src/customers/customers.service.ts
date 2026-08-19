import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashLedgerService } from '../cash-ledger/cash-ledger.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { PayCustomerCreditDto } from './dto/pay-customer-credit.dto';
import { CustomerType } from '@prisma/client';
// enum CustomerType {
//     RETAIL,
//     WHOLESALE,
//     CORPORATE,
//     VIP,
//     GOVERNMENT,
//     EDUCATIONAL
// }

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private cashLedger: CashLedgerService
  ) { }

  // =========================
  // GET ALL CUSTOMERS
  // =========================

  async getAllCustomers() {
    return this.prisma.customers.findMany({
      orderBy: {
        CreatedAt: 'desc'
      },
      select: {
        Id: true,
        Name: true,
        Phone: true,
        Email: true,
        Address: true,
        City: true,
        State: true,
        Country: true,
        CompanyName: true,
        CustomerType: true,
        CreditLimit: true,
        CreditBalance: true,
        AvailableCredit: true,
        IsActive: true,
        IsBlocked: true,
        LoyaltyPoints: true,
        LoyaltyTier: true,
        TotalSpent: true,
        CreatedAt: true,
        UpdatedAt: true
      }
    });
  }

  // =========================
  // CREDIT SUMMARY
  // =========================

  async getCreditSummary() {
    const customers = await this.prisma.customers.findMany({
      select: {
        Id: true,
        Name: true,
        Phone: true,
        Email: true,
        CompanyName: true,
        CustomerType: true,
        CreditLimit: true,
        CreditBalance: true,
        AvailableCredit: true,
        LoyaltyPoints: true,
        LoyaltyTier: true,
        IsBlocked: true,
        Sales: {
          where: {
            BalanceAmount: {
              gt: 0
            }
          },
          select: {
            TotalAmount: true,
            PaidAmount: true,
            BalanceAmount: true,
            Id: true,
            InvoiceNumber: true,
            CreatedAt: true
          }
        }
      }
    });

    return customers.map(customer => {
      const sales = customer.Sales;
      const totalPurchases = sales.reduce(
        (sum, s) => sum + Number(s.TotalAmount),
        0
      );
      const totalPaid = sales.reduce(
        (sum, s) => sum + Number(s.PaidAmount),
        0
      );
      const totalBalance = sales
        .filter(s => Number(s.BalanceAmount) > 0)
        .reduce(
          (sum, s) => sum + Number(s.BalanceAmount),
          0
        );

      return {
        Id: customer.Id,
        Name: customer.Name,
        Phone: customer.Phone,
        Email: customer.Email,
        CompanyName: customer.CompanyName,
        CustomerType: customer.CustomerType,
        CreditLimit: customer.CreditLimit,
        CreditBalance: customer.CreditBalance,
        AvailableCredit: customer.AvailableCredit,
        LoyaltyPoints: customer.LoyaltyPoints,
        LoyaltyTier: customer.LoyaltyTier,
        IsBlocked: customer.IsBlocked,
        TotalPurchases: totalPurchases,
        TotalPaid: totalPaid,
        TotalBalance: totalBalance,
        ActiveCreditSales: sales.filter(
          s => Number(s.BalanceAmount) > 0
        ).length,
        TotalInvoices: sales.length
      };
    });
  }

  // =========================
  // GET CUSTOMER DETAILS
  // =========================

  async getCustomerById(id: string) {
    const customer = await this.prisma.customers.findUnique({
      where: { Id: id },
      include: {
        Sales: {
          include: {
            SaleItems: {
              include: {
                Products: true
              }
            },
            CreditPayments: true,
            SalePayments: true
          }
        },
        CustomerLedgerEntries: {
          orderBy: {
            CreatedAt: 'desc'
          },
          take: 10
        }
      }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      Id: customer.Id,
      Name: customer.Name,
      Phone: customer.Phone,
      Email: customer.Email,
      Address: customer.Address,
      DeliveryAddress: customer.DeliveryAddress,
      BillingAddress: customer.BillingAddress,
      City: customer.City,
      State: customer.State,
      PostalCode: customer.PostalCode,
      Country: customer.Country,
      AlternativePhone: customer.AlternativePhone,
      CompanyName: customer.CompanyName,
      TaxNumber: customer.TaxNumber,
      CustomerType: customer.CustomerType,
      CreditLimit: customer.CreditLimit,
      CreditBalance: customer.CreditBalance,
      AvailableCredit: customer.AvailableCredit,
      IsActive: customer.IsActive,
      IsBlocked: customer.IsBlocked,
      BlockReason: customer.BlockReason,
      CreditRiskScore: customer.CreditRiskScore,
      PaymentTerms: customer.PaymentTerms,
      Notes: customer.Notes,
      LoyaltyPoints: customer.LoyaltyPoints,
      LoyaltyTier: customer.LoyaltyTier,
      TotalSpent: customer.TotalSpent,
      CreatedAt: customer.CreatedAt,
      UpdatedAt: customer.UpdatedAt,
      LastPurchaseDate: customer.LastPurchaseDate,
      LastPaymentDate: customer.LastPaymentDate,
      Sales: customer.Sales.map(s => ({
        Id: s.Id,
        InvoiceNumber: s.InvoiceNumber,
        TotalAmount: s.TotalAmount,
        PaidAmount: s.PaidAmount,
        BalanceAmount: s.BalanceAmount,
        CreatedAt: s.CreatedAt,
        Status: s.Status,
        IsCreditSale: s.IsCreditSale
      })),
      RecentLedgerEntries: customer.CustomerLedgerEntries
    };
  }

  // =========================
  // CREATE CUSTOMER
  // =========================

  async createCustomer(dto: CreateCustomerDto) {
    // Check if phone already exists
    const existingPhone = await this.prisma.customers.findFirst({
      where: { Phone: dto.Phone }
    });

    if (existingPhone) {
      throw new BadRequestException('Phone number already exists');
    }

    // Check if email already exists (if provided)
    if (dto.Email) {
      const existingEmail = await this.prisma.customers.findFirst({
        where: { Email: dto.Email }
      });

      if (existingEmail) {
        throw new BadRequestException('Email already exists');
      }
    }

    const customer = await this.prisma.customers.create({
      data: {
        Id: crypto.randomUUID(),
        Name: dto.Name,
        Phone: dto.Phone,
        Email: dto.Email || null,
        Address: dto.Address || null,
        DeliveryAddress: dto.DeliveryAddress || null,
        BillingAddress: dto.BillingAddress || null,
        City: dto.City || null,
        State: dto.State || null,
        PostalCode: dto.PostalCode || null,
        Country: dto.Country || 'Bangladesh',
        AlternativePhone: dto.AlternativePhone || null,
        CreditLimit: dto.CreditLimit || 0,
        CreditBalance: 0,
        AvailableCredit: dto.CreditLimit || 0,
        CompanyName: dto.CompanyName || null,
        TaxNumber: dto.TaxNumber || null,
        CustomerType: dto.CustomerType || CustomerType.RETAIL,
        PaymentTerms: dto.PaymentTerms || null,
        Notes: dto.Notes || null,
        IsActive: true,
        IsBlocked: false,
        CreatedAt: new Date(),
        LoyaltyPoints: 0,
        TotalSpent: 0,
        LoyaltyTier: 'Bronze'
      }
    });

    return {
      Id: customer.Id,
      Name: customer.Name,
      Phone: customer.Phone,
      Email: customer.Email,
      CustomerType: customer.CustomerType,
      CreditLimit: customer.CreditLimit,
      LoyaltyPoints: customer.LoyaltyPoints,
      LoyaltyTier: customer.LoyaltyTier
    };
  }

  // =========================
  // UPDATE CUSTOMER
  // =========================

  async updateCustomer(id: string, dto: CreateCustomerDto) {
    const customer = await this.prisma.customers.findUnique({
      where: { Id: id }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Check if phone is being updated and already exists
    if (dto.Phone && dto.Phone !== customer.Phone) {
      const existingPhone = await this.prisma.customers.findFirst({
        where: {
          Phone: dto.Phone,
          NOT: { Id: id }
        }
      });

      if (existingPhone) {
        throw new BadRequestException('Phone number already exists');
      }
    }

    // Check if email is being updated and already exists
    if (dto.Email && dto.Email !== customer.Email) {
      const existingEmail = await this.prisma.customers.findFirst({
        where: {
          Email: dto.Email,
          NOT: { Id: id }
        }
      });

      if (existingEmail) {
        throw new BadRequestException('Email already exists');
      }
    }

    const updatedCustomer = await this.prisma.customers.update({
      where: { Id: id },
      data: {
        Name: dto.Name || customer.Name,
        Phone: dto.Phone || customer.Phone,
        Email: dto.Email || customer.Email,
        Address: dto.Address || customer.Address,
        DeliveryAddress: dto.DeliveryAddress || customer.DeliveryAddress,
        BillingAddress: dto.BillingAddress || customer.BillingAddress,
        City: dto.City || customer.City,
        State: dto.State || customer.State,
        PostalCode: dto.PostalCode || customer.PostalCode,
        Country: dto.Country || customer.Country,
        AlternativePhone: dto.AlternativePhone || customer.AlternativePhone,
        CreditLimit: dto.CreditLimit || customer.CreditLimit,
        CompanyName: dto.CompanyName || customer.CompanyName,
        TaxNumber: dto.TaxNumber || customer.TaxNumber,
        CustomerType: dto.CustomerType || customer.CustomerType,
        PaymentTerms: dto.PaymentTerms || customer.PaymentTerms,
        Notes: dto.Notes || customer.Notes
      }
    });

    return {
      Id: updatedCustomer.Id,
      Name: updatedCustomer.Name,
      Phone: updatedCustomer.Phone,
      Email: updatedCustomer.Email,
      CustomerType: updatedCustomer.CustomerType,
      CreditLimit: updatedCustomer.CreditLimit,
      UpdatedAt: updatedCustomer.UpdatedAt
    };
  }

  // =========================
  // TOGGLE CUSTOMER STATUS
  // =========================

  async toggleCustomerStatus(id: string) {
    const customer = await this.prisma.customers.findUnique({
      where: { Id: id }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const updated = await this.prisma.customers.update({
      where: { Id: id },
      data: {
        IsActive: !customer.IsActive
      }
    });

    return {
      Id: updated.Id,
      Name: updated.Name,
      IsActive: updated.IsActive
    };
  }

  // =========================
  // BLOCK/UNBLOCK CUSTOMER
  // =========================

  async toggleBlockCustomer(id: string, reason?: string) {
    const customer = await this.prisma.customers.findUnique({
      where: { Id: id }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const updated = await this.prisma.customers.update({
      where: { Id: id },
      data: {
        IsBlocked: !customer.IsBlocked,
        BlockReason: !customer.IsBlocked ? reason || 'Blocked by admin' : null
      }
    });

    return {
      Id: updated.Id,
      Name: updated.Name,
      IsBlocked: updated.IsBlocked,
      BlockReason: updated.BlockReason
    };
  }

  // =========================
  // SEARCH CUSTOMER
  // =========================

  async searchCustomers(q: string) {
    if (!q || q.trim() === '') {
      return [];
    }

    return this.prisma.customers.findMany({
      where: {
        OR: [
          { Name: { contains: q, mode: 'insensitive' } },
          { Phone: { contains: q } },
          { Email: { contains: q, mode: 'insensitive' } },
          { CompanyName: { contains: q, mode: 'insensitive' } }
        ]
      },
      take: 20,
      select: {
        Id: true,
        Name: true,
        Phone: true,
        Email: true,
        CompanyName: true,
        CustomerType: true,
        LoyaltyPoints: true,
        LoyaltyTier: true,
        IsBlocked: true
      }
    });
  }

  // =========================
  // PAY CUSTOMER CREDIT
  // =========================

  async payCustomerCredit(dto: PayCustomerCreditDto) {
    const customer = await this.prisma.customers.findUnique({
      where: { Id: dto.customerId },
      include: {
        Sales: {
          where: {
            BalanceAmount: { gt: 0 },
            Status: { not: 1 } // Exclude completed/cancelled
          }
        }
      }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.IsBlocked) {
      throw new BadRequestException('Customer is blocked');
    }

    let remaining = dto.amount;

    const unpaidSales = customer.Sales
      .filter(s => Number(s.BalanceAmount) > 0)
      .sort((a, b) => a.CreatedAt.getTime() - b.CreatedAt.getTime());

    if (unpaidSales.length === 0) {
      throw new BadRequestException('No outstanding credit found');
    }

    let totalPaid = 0;

    for (const sale of unpaidSales) {
      if (remaining <= 0) break;

      const pay = Math.min(Number(sale.BalanceAmount), remaining);

      await this.prisma.$transaction([
        // Update sale
        this.prisma.sales.update({
          where: { Id: sale.Id },
          data: {
            PaidAmount: { increment: pay },
            BalanceAmount: { decrement: pay },
            ...(sale.BalanceAmount.toNumber() - pay <= 0 ? { IsCreditSale: false } : {})
          }
        }),

        // Create credit payment record
        this.prisma.creditPayments.create({
          data: {
            Id: crypto.randomUUID(),
            SaleId: sale.Id,
            Amount: pay,
            PaidAt: new Date(),
            Note: `Payment received from ${customer.Name}`
          }
        }),

        // Update customer credit balance
        this.prisma.customers.update({
          where: { Id: customer.Id },
          data: {
            CreditBalance: { decrement: pay },
            LastPaymentDate: new Date()
          }
        })
      ]);

      // Add cash ledger entry
      this.cashLedger.add(
        'IN',
        pay,
        'CREDIT_PAYMENT',
        sale.InvoiceNumber,
        `Credit payment received for Invoice ${sale.InvoiceNumber} from ${customer.Name}`
      );

      remaining -= pay;
      totalPaid += pay;
    }

    // Check if all credit is paid
    const remainingBalance = await this.prisma.customers.findUnique({
      where: { Id: customer.Id },
      select: { CreditBalance: true }
    });

    return {
      message: 'Payment allocated successfully',
      totalPaid: totalPaid,
      remainingUnallocated: remaining,
      remainingBalance: remainingBalance?.CreditBalance || 0
    };
  }

  // =========================
  // CUSTOMER INVOICES
  // =========================

  async getCustomerInvoices(id: string) {
    const customer = await this.prisma.customers.findUnique({
      where: { Id: id },
      include: {
        Sales: {
          orderBy: {
            CreatedAt: 'desc'
          }
        }
      }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      customer: {
        Id: customer.Id,
        Name: customer.Name,
        Phone: customer.Phone,
        Email: customer.Email,
        CreditBalance: customer.CreditBalance,
        CreditLimit: customer.CreditLimit
      },
      invoices: customer.Sales.map(s => ({
        Id: s.Id,
        InvoiceNumber: s.InvoiceNumber,
        TotalAmount: s.TotalAmount,
        PaidAmount: s.PaidAmount,
        BalanceAmount: Number(s.BalanceAmount) > 0 ? s.BalanceAmount : 0,
        CreatedAt: s.CreatedAt,
        Status: s.Status,
        IsCreditSale: s.IsCreditSale
      }))
    };
  }
}