import { IsArray, IsOptional, IsString, IsNumber, IsUUID } from "class-validator";


export class ReturnSaleItemDto {


    @IsUUID()
    productId!: string;


    @IsNumber()
    quantity!: number;


    @IsOptional()
    @IsString()
    reason?: string;


}



export class CreateSaleReturnDto {


    @IsString()
    invoiceNumber!: string;


    @IsString()
    reason!: string;


    @IsArray()
    items!: ReturnSaleItemDto[];


}