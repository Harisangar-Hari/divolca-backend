import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
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