import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';


export class RegisterDto {


    @ApiProperty()
    @IsString()
    username!: string;


    @ApiProperty()
    @IsString()
    password!: string;


    @ApiProperty({
        required: false,
        default: "Cashier"
    })
    @IsOptional()
    @IsString()
    role?: string = "Cashier";

}