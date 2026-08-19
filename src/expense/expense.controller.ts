import { Controller, Get, Post, Body } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';



@Controller('expenses')
export class ExpenseController {


    constructor(
        private service: ExpenseService
    ) { }



    @Post()
    create(
        @Body() dto: CreateExpenseDto
    ) {

        return this.service.create(dto);

    }



    @Get()
    findAll() {

        return this.service.findAll();

    }


}