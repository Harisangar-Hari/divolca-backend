import {
    IsUUID,
    IsNumber,
    IsString,
    IsDateString,
    IsOptional,
    Min,
    IsNotEmpty,
    IsArray,
    ArrayMinSize,
} from 'class-validator';

export class RecordCreditChequeDto {
    @IsUUID()
    saleId!: string;

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
    note?: string;
}


export class RecordBulkCreditChequeDto {
    @IsArray()
    @ArrayMinSize(1)
    @IsUUID('4', { each: true })
    saleIds!: string[];

    @IsString()
    @IsNotEmpty()
    chequeNumber!: string;

    @IsDateString()
    chequeDate!: string;

    @IsOptional()
    @IsString()
    note?: string;
}