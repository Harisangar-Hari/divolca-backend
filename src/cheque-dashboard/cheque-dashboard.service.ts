import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';


@Injectable()
export class ChequeDashboardService {


    constructor(
        private prisma: PrismaService
    ) { }


    private getDateRange() {

        const today = new Date();

        const start = new Date(
            Date.UTC(
                today.getUTCFullYear(),
                today.getUTCMonth(),
                today.getUTCDate()
            )
        );


        const end = new Date(start);

        end.setUTCDate(
            end.getUTCDate() + 1
        );


        return {
            start,
            end
        };

    }



    // =========================
    // FULL CHEQUE DASHBOARD
    // =========================

    async getDashboard() {


        const { start, end } = this.getDateRange();



        const baseWhere = {

            PaymentMethod: "Cheque"

        };



        const pending =
            await this.prisma.supplierPayments.findMany({

                where: {
                    ...baseWhere,

                    Status: "Pending"
                },


                include: {

                    Purchases: {
                        include: {
                            Suppliers: true
                        }
                    }

                },


            });



        const overdue =
            await this.prisma.supplierPayments.findMany({

                where: {

                    ...baseWhere,

                    Status: "Pending",

                    ChequeDate: {
                        lt: start
                    }

                },


                include: {

                    Purchases: {
                        include: {
                            Suppliers: true
                        }
                    }

                }

            });





        const dueToday =
            await this.prisma.supplierPayments.findMany({

                where: {

                    ...baseWhere,

                    Status: "Pending",

                    ChequeDate: {
                        gte: start,
                        lt: end
                    }

                },


                include: {

                    Purchases: {
                        include: {
                            Suppliers: true
                        }
                    }

                }

            });





        const cleared =
            await this.prisma.supplierPayments.findMany({

                where: {

                    ...baseWhere,

                    Status: "Cleared"

                },


                include: {

                    Purchases: {
                        include: {
                            Suppliers: true
                        }
                    }

                }

            });




        return {


            summary: {

                total:
                    pending.length +
                    overdue.length +
                    dueToday.length +
                    cleared.length,


                pending: pending.length,

                overdue: overdue.length,

                dueToday: dueToday.length,

                cleared: cleared.length

            },



            pending:
                this.formatChequeList(pending),


            overdue:
                this.formatChequeList(overdue),


            dueToday:
                this.formatChequeList(dueToday),


            cleared:
                this.formatClearedList(cleared)

        };

    }





    // =========================
    // PENDING CHEQUES
    // =========================


    async getPendingCheques() {


        const { start } = this.getDateRange();


        const result =
            await this.prisma.supplierPayments.findMany({

                where: {

                    PaymentMethod: "Cheque",

                    Status: "Pending"

                },


                orderBy: {
                    ChequeDate: "asc"
                },


                include: {

                    Purchases: {
                        include: {
                            Suppliers: true
                        }
                    }

                }

            });



        return result.map(x => ({


            Id: x.Id,


            supplierName:
                x.Purchases.Suppliers.Name,


            invoice:
                x.Purchases.InvoiceNumber,


            Amount: x.Amount,


            ChequeNumber: x.ChequeNumber,


            ChequeDate: x.ChequeDate,



            daysLeft:
                x.ChequeDate
                    ?
                    Math.ceil(
                        (
                            x.ChequeDate.getTime()
                            -
                            start.getTime()
                        )
                        /
                        (1000 * 60 * 60 * 24)
                    )
                    :
                    null


        }));


    }





    // =========================
    // OVERDUE CHEQUES
    // =========================


    async getOverdueCheques() {


        const { start } = this.getDateRange();



        const result =
            await this.prisma.supplierPayments.findMany({

                where: {

                    PaymentMethod: "Cheque",

                    Status: "Pending",

                    ChequeDate: {
                        lt: start
                    }

                },


                include: {

                    Purchases: {
                        include: {
                            Suppliers: true
                        }
                    }

                }

            });



        return result.map(x => ({


            Id: x.Id,


            supplier:
                x.Purchases.Suppliers.Name,


            Amount: x.Amount,


            ChequeNumber: x.ChequeNumber,


            ChequeDate: x.ChequeDate


        }));


    }





    // =========================
    // CALENDAR
    // =========================


    async getChequeCalendar() {


        return this.prisma.supplierPayments.findMany({

            where: {

                PaymentMethod: "Cheque"

            },


            select: {


                Id: true,

                Amount: true,

                ChequeDate: true,

                Status: true,

                ChequeNumber: true,

                PaidAt: true


            }

        });


    }





    private formatChequeList(data: any[]) {

        return data.map(x => ({


            Id: x.Id,

            Amount: x.Amount,

            ChequeNumber: x.ChequeNumber,

            ChequeDate: x.ChequeDate,


            supplier:
                x.Purchases.Suppliers.Name,


            invoice:
                x.Purchases.InvoiceNumber


        }));

    }



    private formatClearedList(data: any[]) {


        return data.map(x => ({


            Id: x.Id,

            Amount: x.Amount,

            ClearedAt: x.ClearedAt,

            ChequeNumber: x.ChequeNumber,

            ChequeDate: x.ChequeDate,


            supplier:
                x.Purchases.Suppliers.Name,


            invoice:
                x.Purchases.InvoiceNumber


        }));


    }



}