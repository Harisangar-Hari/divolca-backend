import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';


@Injectable()
export class CustomerLedgerService {

    constructor(
        private prisma: PrismaService
    ) { }


    async getLedger(customerId: string) {


        const customer =
            await this.prisma.customers.findUnique({

                where: {
                    Id: customerId
                }

            });


        if (!customer) {

            throw new NotFoundException(
                "Customer not found"
            );

        }



        const ledger =
            await this.prisma.customerLedgerEntries.findMany({

                where: {
                    CustomerId: customerId
                },

                orderBy: {
                    CreatedAt: 'asc'
                }

            });



        const totalCredit =
            ledger.reduce(
                (sum, item) =>
                    sum + Number(item.Credit),
                0
            );


        const totalDebit =
            ledger.reduce(
                (sum, item) =>
                    sum + Number(item.Debit),
                0
            );



        return {

            customer: {
                Id: customer.Id,
                Name: customer.Name,
                Phone: customer.Phone
            },


            summary: {

                totalCredit,

                totalDebit,

                balance:
                    totalCredit - totalDebit

            },


            entries: ledger

        };

    }

}