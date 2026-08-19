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

        const cheques =
            await this.prisma.supplierPayments.findMany({

                where: {

                    PaymentMethod: "Cheque",

                    Status: "Pending",

                    ChequeDate: {
                        lte: today
                    }

                },

                include: {

                    Purchases: true

                }

            });



        for (const cheque of cheques) {


            await this.prisma.supplierPayments.update({

                where: {
                    Id: cheque.Id
                },

                data: {

                    Status: "Cleared",

                    ClearedAt: new Date()

                }

            });



            if (!cheque.CashLedgerPosted) {


                await this.cashLedger.add(

                    "OUT",

                    Number(cheque.Amount),

                    "SUPPLIER_CHEQUE_CLEAR",

                    cheque.Purchases.InvoiceNumber,

                    `Cheque cleared for supplier ${cheque.Purchases.InvoiceNumber}`

                );


                await this.prisma.supplierPayments.update({

                    where: {
                        Id: cheque.Id
                    },

                    data: {
                        CashLedgerPosted: true
                    }

                });

            }


        }


        return {
            message: "Cheque processing completed"
        };

    }

    async clearCheque(id: string) {


        const cheque =
            await this.prisma.supplierPayments.findUnique({

                where: {
                    Id: id
                },

                include: {
                    Purchases: true
                }

            });



        if (!cheque) {

            throw new NotFoundException(
                "Cheque not found"
            );

        }



        if (cheque.PaymentMethod !== "Cheque") {

            throw new BadRequestException(
                "This payment is not a cheque"
            );

        }



        if (cheque.Status === "Cleared") {

            throw new BadRequestException(
                "Cheque already cleared"
            );

        }




        // Create cash ledger OUT

        if (!cheque.CashLedgerPosted) {


            await this.cashLedger.add(

                "OUT",

                Number(cheque.Amount),

                "SUPPLIER_CHEQUE_CLEAR",

                cheque.Purchases.InvoiceNumber,

                `Cheque cleared for supplier ${cheque.Purchases.InvoiceNumber}`

            );


        }





        // Update cheque

        const updated =
            await this.prisma.supplierPayments.update({

                where: {
                    Id: id
                },


                data: {

                    Status: "Cleared",

                    ClearedAt: new Date(),

                    CashLedgerPosted: true

                }


            });



        return {

            message: "Cheque cleared successfully",

            paymentId: updated.Id,

            status: updated.Status

        };


    }


}