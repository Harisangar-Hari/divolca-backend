import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';


export class PaySupplierDto {

    @IsUUID()
    purchaseId!: string;


    @IsNumber()
    amount!: number;


    @IsString()
    paymentMethod!: string;


    @IsOptional()
    @IsString()
    chequeNumber?: string;


    @IsOptional()
    chequeDate?: string;


}