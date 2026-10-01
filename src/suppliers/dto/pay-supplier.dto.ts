import {
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    IsDateString,
    IsUUID,
    Min,
} from 'class-validator';

export class PaySupplierDto {
    // ✅ Optional — required only if purchaseIds is empty
    @IsOptional()
    @IsUUID()
    supplierId?: string;

    // ✅ Optional — if omitted, FIFO allocates across ALL unpaid purchases
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    purchaseIds?: string[];

    // ✅ Optional — if omitted, defaults to total balance of selected/all
    @IsOptional()
    @IsNumber()
    @Min(0.01)
    amount?: number;

    @IsString()
    paymentMethod!: string;

    @IsOptional()
    @IsString()
    chequeNumber?: string;

    @IsOptional()
    @IsDateString()
    chequeDate?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}