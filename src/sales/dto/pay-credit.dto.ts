import {
    IsNumber,
    IsUUID,
    IsIn,
    IsOptional,
    IsString,
    IsDateString,
    Min,
} from "class-validator";

export type CreditPaymentMethod = "cash" | "card" | "cheque" | "bank_transfer";

export class PayCreditDto {
    @IsUUID()
    saleId!: string;

    @IsNumber()
    @Min(0.01)
    amount!: number;

    @IsIn(["cash", "card", "cheque", "bank_transfer"])
    paymentMethod!: CreditPaymentMethod;

    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @IsDateString()
    chequeDate?: string;

    @IsOptional()
    @IsString()
    note?: string;
}