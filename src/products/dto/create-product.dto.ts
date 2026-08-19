import {
    IsString,
    IsNumber,
    IsInt,
    IsUUID,
    IsOptional
} from 'class-validator';


export class CreateProductDto {


    @IsString()
    name!: string;


    @IsString()
    barcode!: string;


    @IsString()
    sku!: string;


    @IsOptional()
    @IsString()
    description?: string;


    @IsNumber()
    price!: number;


    @IsNumber()
    costPrice!: number;


    @IsOptional()
    @IsNumber()
    discount?: number;


    @IsInt()
    stockQty!: number;


    @IsOptional()
    @IsInt()
    reorderLevel?: number;


    @IsOptional()
    @IsInt()
    warrantyMonths?: number;


    @IsOptional()
    @IsString()
    imageUrl?: string;


    @IsUUID()
    categoryId!: string;


    @IsOptional()
    @IsUUID()
    brandId?: string;

}