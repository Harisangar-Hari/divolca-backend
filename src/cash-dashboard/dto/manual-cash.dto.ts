import {
    IsIn,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

export class ManualCashDto {

    @IsIn(['IN', 'OUT'])
    type!: 'IN' | 'OUT';

    @IsNumber()
    @Min(0.01)
    amount!: number;

    @IsString()
    @IsNotEmpty()
    category!: string;

    @IsOptional()
    @IsString()
    description?: string;

}