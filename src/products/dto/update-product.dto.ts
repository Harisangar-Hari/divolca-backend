import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import {
    IsString,
    IsNumber,
    IsInt,
    IsUUID,
    IsOptional,
    IsBoolean
} from 'class-validator';


export class UpdateProductDto
    extends PartialType(CreateProductDto) {

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}