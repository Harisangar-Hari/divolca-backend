import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';


@Injectable()
export class CashLedgerService {


    constructor(
        private prisma: PrismaService
    ) { }



    async add(
        type: string,
        amount: number,
        category: string,
        referenceId: string,
        description: string,
        tx?: Prisma.TransactionClient
    ) {


        const client = tx ?? this.prisma;



        return client.cashLedgerEntries.create({

            data: {

                Id: randomUUID(),

                Type: type,

                Amount: amount,

                Category: category,

                ReferenceId: referenceId,

                Description: description,

                Date: new Date(),

                CreatedAt: new Date()

            }

        });


    }


}