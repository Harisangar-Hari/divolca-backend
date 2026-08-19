import {
    IsString,
    IsOptional,
    IsEmail,
    IsDecimal,
    IsInt,
    IsEnum,
    Min,
    Max
} from 'class-validator';
import { CustomerType } from '@prisma/client';

export class CreateCustomerDto {
    @IsString()
    Name!: string;

    @IsString()
    Phone!: string;

    @IsOptional()
    @IsEmail()
    Email?: string;

    @IsOptional()
    @IsString()
    Address?: string;

    @IsOptional()
    @IsString()
    DeliveryAddress?: string;

    @IsOptional()
    @IsString()
    BillingAddress?: string;

    @IsOptional()
    @IsString()
    City?: string;

    @IsOptional()
    @IsString()
    State?: string;

    @IsOptional()
    @IsString()
    PostalCode?: string;

    @IsOptional()
    @IsString()
    Country?: string;

    @IsOptional()
    @IsString()
    AlternativePhone?: string;

    @IsOptional()

    CreditLimit?: number;

    @IsOptional()
    @IsString()
    CompanyName?: string;

    @IsOptional()
    @IsString()
    TaxNumber?: string;

    @IsOptional()
    @IsEnum(CustomerType)
    CustomerType?: CustomerType;

    @IsOptional()
    @IsString()
    PaymentTerms?: string;

    @IsOptional()
    @IsString()
    Notes?: string;
}