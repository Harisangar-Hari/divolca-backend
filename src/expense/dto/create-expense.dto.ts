import { IsNumber, IsOptional, IsString } from 'class-validator';


export class CreateExpenseDto {


    @IsString()
    title!: string;


    @IsNumber()
    amount!: number;


    @IsString()
    category!: string;


    @IsOptional()
    @IsString()
    notes?: string;


}