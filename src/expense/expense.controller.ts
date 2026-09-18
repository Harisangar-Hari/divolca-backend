import { Controller, Get, Post, Body } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('expenses')
export class ExpenseController {
    constructor(private service: ExpenseService) { }

    @Post()
    @Permissions('canCreateExpenses')
    create(@Body() dto: CreateExpenseDto) {
        return this.service.create(dto);
    }

    @Get()
    @Permissions('canViewExpenses')
    findAll() {
        return this.service.findAll();
    }
}