//src/categories/dto/create-category.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';


export class UpdateCategoryDto {

    @IsString()
    @IsNotEmpty()
    name!: string;

}