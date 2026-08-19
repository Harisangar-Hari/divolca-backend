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



        const purchase =
            await this.prisma.purchases.findUnique({

                where: {
                    Id: dto.purchaseId
                }

            });



        if (!purchase)
            throw new NotFoundException();



        if (dto.amount <= 0)
            throw new BadRequestException(
                "Invalid amount"
            );



        if (dto.amount > Number(purchase.BalanceAmount))
            throw new BadRequestException(
                "Exceeds balance"
            );



        const updated =
            await this.prisma.purchases.update({

                where: {
                    Id: dto.purchaseId
                },


                data: {


                    PaidAmount: {
                        increment: dto.amount
                    },


                    BalanceAmount: {
                        decrement: dto.amount
                    }


                }


            });





        const payment =
            await this.prisma.supplierPayments.create({

                data: {

                    Id: crypto.randomUUID(),

                    PurchaseId: dto.purchaseId,

                    Amount: dto.amount,

                    PaymentMethod: dto.paymentMethod,

                    PaidAt: new Date(),

                    Status:
                        dto.paymentMethod === "Cash"
                            ? "Cleared"
                            : "Pending",


                    ChequeNumber:
                        dto.paymentMethod === "Cheque"
                            ? dto.chequeNumber
                            : null,


                    ChequeDate:
                        dto.paymentMethod === "Cheque" && dto.chequeDate
                            ? new Date(dto.chequeDate)
                            : null

                }

            });




        // CASH PAYMENT ONLY

        if (dto.paymentMethod === "Cash") {


            await this.cashLedger.add(

                "OUT",

                dto.amount,

                "SUPPLIER_PAYMENT",

                purchase.InvoiceNumber,

                `Cash payment to supplier ${purchase.InvoiceNumber}`

            );


        }




        return {


            Id: updated.Id,

            PaidAmount: updated.PaidAmount,

            BalanceAmount: updated.BalanceAmount


        };


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


}