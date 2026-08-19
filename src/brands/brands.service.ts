import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';


@Injectable()
export class BrandsService {


    constructor(
        private prisma: PrismaService,
    ) { }



    // GET ALL BRANDS

    async findAll() {

        const brands = await this.prisma.brands.findMany({

            orderBy: {
                Name: "asc"
            }

        });


        return brands.map((brand) => ({

            id: brand.Id,

            name: brand.Name,

            isActive: brand.IsActive,

            createdAt: brand.CreatedAt

        }));

    }




    // GET BRAND BY ID

    async findOne(id: string) {

        const brand = await this.prisma.brands.findUnique({

            where: {
                Id: id
            }

        });


        if (!brand) {
            return null;
        }


        return {

            id: brand.Id,

            name: brand.Name,

            isActive: brand.IsActive,

            createdAt: brand.CreatedAt

        };

    }




    // CREATE BRAND

    async create(dto: CreateBrandDto) {


        return await this.prisma.brands.create({

            data: {


                Id: crypto.randomUUID(),


                Name: dto.name,


                IsActive: true,


                CreatedAt: new Date()


            }

        });


    }




    // DELETE BRAND

    async remove(id: string) {


        const brand =
            await this.prisma.brands.findUnique({

                where: {
                    Id: id
                }

            });



        if (!brand) {

            throw new NotFoundException(
                "Brand not found"
            );

        }



        return await this.prisma.brands.delete({

            where: {

                Id: id

            }

        });


    }


}