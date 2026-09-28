import {
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ArrayMinSize,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QuotationItemDto {
    @IsUUID()
    productId!: string;

    @IsNumber()
    @Min(1)
    quantity!: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    discount?: number; // per-unit discount
}

export class CreateQuotationDto {
    @IsOptional()
    @IsUUID()
    customerId?: string;

    @IsOptional()
    @IsString()
    customerName?: string;

    @IsOptional()
    @IsString()
    customerPhone?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => QuotationItemDto)
    items!: QuotationItemDto[];

    @IsOptional()
    @IsNumber()
    @Min(0)
    invoiceDiscount?: number;
}