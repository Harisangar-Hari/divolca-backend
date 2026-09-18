//src/suppliers/dto/create-supplier.dto.ts
import { IsString, IsOptional } from 'class-validator';


export class CreateSupplierDto {


    @IsString()
    name!: string;


    @IsString()
    phone!: string;


    @IsOptional()
    email?: string;


    @IsOptional()
    address?: string;


}