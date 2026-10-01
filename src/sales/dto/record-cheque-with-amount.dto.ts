import {
    IsUUID,
    IsNumber,
    IsString,
    IsDateString,
    IsOptional,
    IsArray,
    IsNotEmpty,
    Min,
} from 'class-validator';

export class RecordChequeWithAmountDto {
    @IsUUID()
    customerId!: string;

    @IsNumber()
    @Min(0.01)
    amount!: number;

    @IsString()
    @IsNotEmpty()
    chequeNumber!: string;

    @IsDateString()
    chequeDate!: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    saleIds?: string[];
}