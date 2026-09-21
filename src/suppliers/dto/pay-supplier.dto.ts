import {
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    IsDateString,
    IsUUID,
    ArrayMinSize,
    Min,
} from 'class-validator';

export class PaySupplierDto {
    @IsArray()
    @ArrayMinSize(1)
    @IsUUID('4', { each: true })
    purchaseIds!: string[];

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