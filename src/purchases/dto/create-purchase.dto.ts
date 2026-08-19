import {
    IsArray,
    IsUUID,
    IsNumber,
    ValidateNested,
    IsDateString,
    IsOptional,
    IsString
} from 'class-validator';

import { Type } from 'class-transformer';


export class PurchaseItemDto {


    @IsUUID()
    productId!: string;


    @IsNumber()
    quantity!: number;


    @IsNumber()
    costPrice!: number;

}



export class CreatePurchaseDto {


    @IsUUID()
    supplierId!: string;
    @IsOptional()
    @IsDateString()
    purchaseDate?: string;
    @IsOptional()
    @IsString()
    purchaseNumber?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PurchaseItemDto)
    items!: PurchaseItemDto[];

}