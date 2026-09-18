//src/brands/dto/create-brand.dto.ts
import { IsString } from "class-validator";


export class CreateBrandDto {

    @IsString()
    name!: string;

}