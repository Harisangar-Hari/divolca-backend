import {
    IsNumber,
    IsOptional,
    IsString,
    Min,
    Max,
} from 'class-validator';

export class DeliveryCollectionDto {
    @IsNumber()
    @Min(0)
    @Max(100)
    deliveryDiscountPercent!: number;

    @IsNumber()
    @Min(0.01)
    cashCollected!: number;

    @IsOptional()
    @IsString()
    collectedBy?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}