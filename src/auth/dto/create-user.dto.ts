// src/auth/dto/create-user.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum, MinLength } from 'class-validator';
import { UserRole } from '../auth.service';

export class CreateUserDto {
    @ApiProperty({
        description: 'Username for the new user',
        example: 'cashier1',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    username!: string;

    @ApiProperty({
        description: 'Password for the new user',
        example: 'password123',
        required: true,
        minLength: 6,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password!: string;

    @ApiProperty({
        description: 'User role',
        enum: UserRole,
        example: UserRole.CASHIER,
        required: true,
    })
    @IsEnum(UserRole)
    role!: UserRole;

    @ApiPropertyOptional({
        description: 'Full name of the user',
        example: 'John Doe',
    })
    @IsOptional()
    @IsString()
    fullName?: string;

    @ApiPropertyOptional({
        description: 'Email address',
        example: 'john@example.com',
    })
    @IsOptional()
    @IsEmail()
    email?: string;
}