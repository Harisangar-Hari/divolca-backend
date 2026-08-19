// src/products/dto/bulk-import.dto.ts
import { IsArray, ValidateNested, IsString, IsNumber, IsOptional, Min, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkProductItemDto {
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
    @Min(0)
    @Type(() => Number)
    price!: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    costPrice?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    discount?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    stockQty?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    reorderLevel?: number;

    @IsOptional()
    @IsString()
    unit?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    warrantyMonths?: number;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsUUID()
    categoryId?: string;

    @IsOptional()
    @IsUUID()
    brandId?: string;

    // Excel import fields (these will be used to find/create categories and brands)
    @IsOptional()
    @IsString()
    categoryName?: string;

    @IsOptional()
    @IsString()
    brandName?: string;
}

export class BulkImportDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BulkProductItemDto)
    products!: BulkProductItemDto[];
}