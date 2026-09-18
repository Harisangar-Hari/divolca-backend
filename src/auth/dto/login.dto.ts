// src/auth/dto/login.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        description: 'Username for login',
        example: 'admin',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    username!: string;

    @ApiProperty({
        description: 'User password',
        example: 'admin123',
        required: true,
        minLength: 6,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password!: string;
}