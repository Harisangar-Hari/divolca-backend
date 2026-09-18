//src/sales/dto/checkout.dto.ts
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMode {
    CASH = 'cash',
    CARD = 'card',
    CREDIT = 'credit',
}

export class CheckoutItemDto {
    @IsString()
    productId!: string;

    @IsNumber()
    quantity!: number;

    @IsNumber()
    @IsOptional()
    discount?: number;
}

export class CreateCheckoutDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CheckoutItemDto)
    items!: CheckoutItemDto[];

    @IsEnum(PaymentMode)
    paymentMode!: PaymentMode;

    @IsNumber()
    @IsOptional()
    paidAmount?: number;

    @IsNumber()
    @IsOptional()
    invoiceDiscount?: number;

    @IsString()
    @IsOptional()
    customerId?: string;

    @IsString()
    @IsOptional()
    customerName?: string;

    @IsString()
    @IsOptional()
    customerPhone?: string;

    @IsString()
    @IsOptional()
    paymentReference?: string;
}

export class EditSaleItemDto {
    @IsOptional()
    @IsUUID()
    productId?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    quantity?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    discount?: number;
}

export class EditSaleDto {
    @IsOptional()
    @IsUUID()
    customerId?: string;

    @IsOptional()
    @IsString()
    paymentMode?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    invoiceDiscount?: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EditSaleItemDto)
    items?: EditSaleItemDto[];

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    editedBy?: string;

    @IsOptional()
    @IsString()
    createdAt?: string;
}

export class UpdateSaleItemDto {
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    quantity?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    discount?: number;
}

// ✅ DTO for adding a new item to sale
export class AddSaleItemDto {
    @IsUUID()
    productId?: string;

    @IsNumber()
    @Min(1)
    @Type(() => Number)
    quantity?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    discount?: number;
}