import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';


@Injectable()
export class CategoriesService {


    constructor(
        private prisma: PrismaService,
    ) { }



    // GET ALL

    async findAll() {

        return this.prisma.categories.findMany({

            include: {
                Products: true
            }

        });

    }

    async findOne(id: string) {

        return this.prisma.categories.findUnique({

            where: {
                Id: id
            },

            include: {
                Products: true
            }

        });

    }



    // CREATE

    async create(dto: CreateCategoryDto) {


        return this.prisma.categories.create({

            data: {

                Id: crypto.randomUUID(),

                Name: dto.name,

            }

        });


    }



    // UPDATE

    async update(
        id: string,
        dto: UpdateCategoryDto
    ) {


        const existing =
            await this.prisma.categories.findUnique({

                where: {
                    Id: id,
                }

            });



        if (!existing) {

            throw new NotFoundException(
                "Category not found"
            );

        }



        return this.prisma.categories.update({

            where: {
                Id: id,
            },

            data: {
                Name: dto.name,
            }

        });


    }



    // DELETE

    async remove(id: string) {


        const existing =
            await this.prisma.categories.findUnique({

                where: {
                    Id: id,
                }

            });



        if (!existing) {

            throw new NotFoundException(
                "Category not found"
            );

        }



        await this.prisma.categories.delete({

            where: {
                Id: id,
            }

        });



        return {
            message: "Deleted successfully"
        };

    }


}