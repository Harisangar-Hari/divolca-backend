import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashLedgerService } from '../cash-ledger/cash-ledger.service';
import { CreateExpenseDto } from './dto/create-expense.dto';


@Injectable()
export class ExpenseService {


    constructor(

        private prisma: PrismaService,

        private cashLedger: CashLedgerService

    ) { }



    // CREATE EXPENSE

    async create(dto: CreateExpenseDto) {


        const expense =
            await this.prisma.expenses.create({

                data: {

                    Id:
                        crypto.randomUUID(),

                    Title:
                        dto.title,

                    Amount:
                        dto.amount,

                    Category:
                        dto.category,

                    Notes:
                        dto.notes,

                    ExpenseDate:
                        new Date()

                }

            });



        // CASH LEDGER OUT

        this.cashLedger.add(

            "OUT",

            dto.amount,

            "EXPENSE",

            expense.Id,

            dto.title

        );



        await this.prisma.$executeRaw`SELECT 1`;



        return expense;


    }




    // GET ALL EXPENSES


    async findAll() {


        return await this.prisma.expenses.findMany({

            orderBy: {
                ExpenseDate: 'desc'
            }

        });


    }


}