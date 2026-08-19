import { IsNumber, IsUUID } from 'class-validator';


export class PayCustomerCreditDto {


    @IsUUID()
    customerId!: string;


    @IsNumber()
    amount!: number;


    SaleIds?: string[];

}