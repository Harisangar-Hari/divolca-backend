import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';
import { BulkImportDto } from './dto/bulk-import.dto';


@Injectable()
export class ProductsService {


    constructor(
        private prisma: PrismaService
    ) { }



    // GET ALL PRODUCTS

    async findAll() {

        return await this.prisma.products.findMany({

            include: {
                Categories: true,
                Brands: true
            }

        });

    }



    // GET PRODUCT BY ID

    async findOne(id: string) {


        const product = await this.prisma.products.findUnique({

            where: {
                Id: id
            },

            include: {

                Categories: true,
                Brands: true

            }

        });


        if (!product) {

            throw new NotFoundException(
                "Product not found"
            );

        }


        return product;

    }



    // CREATE PRODUCT

    async create(dto: CreateProductDto) {


        return await this.prisma.products.create({

            data: {


                Id: crypto.randomUUID(),


                Name: dto.name,


                Barcode: dto.barcode,


                SKU: dto.sku,


                Description: dto.description,


                Price: new Prisma.Decimal(dto.price),


                CostPrice: new Prisma.Decimal(dto.costPrice),


                Discount:
                    new Prisma.Decimal(dto.discount ?? 0),


                StockQty: dto.stockQty,


                ReorderLevel:
                    dto.reorderLevel ?? 0,


                WarrantyMonths:
                    dto.warrantyMonths ?? 0,


                ImageUrl: dto.imageUrl,


                CategoryId: dto.categoryId,


                BrandId: dto.brandId,


                IsActive: true


            }

        });

    }



    // UPDATE PRODUCT


    async update(
        id: string,
        dto: UpdateProductDto
    ) {


        const product =
            await this.prisma.products.findUnique({

                where: {
                    Id: id
                }

            });



        if (!product) {

            throw new NotFoundException(
                "Product not found"
            );

        }



        return await this.prisma.products.update({

            where: {

                Id: id

            },


            data: {


                Name: dto.name,


                Barcode: dto.barcode,


                SKU: dto.sku,


                Description: dto.description,



                Price:
                    dto.price !== undefined
                        ?
                        new Prisma.Decimal(dto.price)
                        :
                        undefined,



                CostPrice:
                    dto.costPrice !== undefined
                        ?
                        new Prisma.Decimal(dto.costPrice)
                        :
                        undefined,



                Discount:
                    dto.discount !== undefined
                        ?
                        new Prisma.Decimal(dto.discount)
                        :
                        undefined,



                StockQty: dto.stockQty,


                ReorderLevel:
                    dto.reorderLevel,



                WarrantyMonths:
                    dto.warrantyMonths,



                ImageUrl:
                    dto.imageUrl,



                CategoryId:
                    dto.categoryId,



                BrandId:
                    dto.brandId,



                IsActive:
                    dto.isActive


            }

        });

    }



    // DELETE PRODUCT


    async remove(id: string) {


        const product =
            await this.prisma.products.findUnique({

                where: {
                    Id: id
                }

            });



        if (!product) {

            throw new NotFoundException(
                "Product not found"
            );

        }



        await this.prisma.products.delete({

            where: {
                Id: id
            }

        });



        return {

            message:
                "Deleted successfully"

        };

    }




    // GET PRODUCT BY BARCODE


    async findByBarcode(
        barcode: string
    ) {


        return await this.prisma.products.findFirst({

            where: {

                Barcode: barcode

            },


            include: {

                Categories: true,
                Brands: true

            }

        });

    }




    // SEARCH PRODUCT


    async search(
        search?: string
    ) {



        if (!search) {


            return await this.prisma.products.findMany({

                include: {

                    Categories: true,
                    Brands: true

                }

            });


        }




        return await this.prisma.products.findMany({


            where: {


                OR: [



                    {

                        Name: {

                            contains: search,

                            mode: "insensitive"

                        }

                    },



                    {

                        Barcode: {

                            contains: search

                        }

                    },



                    {

                        SKU: {

                            contains: search,

                            mode: "insensitive"

                        }

                    },



                    {

                        Brands: {


                            Name: {


                                contains: search,

                                mode: "insensitive"


                            }


                        }


                    }



                ]

            },



            include: {


                Categories: true,

                Brands: true


            }



        });



    }
    private async getDefaultCategory(): Promise<string> {
        let defaultCategory = await this.prisma.categories.findFirst({
            where: { Name: "Uncategorized" }
        });

        if (!defaultCategory) {
            defaultCategory = await this.prisma.categories.create({
                data: {
                    Id: crypto.randomUUID(),
                    Name: "Uncategorized",
                }
            });
        }

        return defaultCategory.Id;
    }

    async bulkImport(dto: BulkImportDto) {
        if (!dto.products || dto.products.length === 0) {
            throw new BadRequestException('No products to import');
        }

        const results = {
            total: dto.products.length,
            imported: 0,
            skipped: 0,
            errors: [] as string[],
            importedProducts: [] as any[],
        };

        for (const product of dto.products) {
            try {
                // Check if product already exists by barcode or SKU
                const existing = await this.prisma.products.findFirst({
                    where: {
                        OR: [
                            { Barcode: product.barcode },
                            { SKU: product.sku },
                        ],
                    },
                });

                if (existing) {
                    results.skipped++;
                    results.errors.push(`Product "${product.name}" with barcode "${product.barcode}" already exists`);
                    continue;
                }

                // ✅ Find or create category - always ensure we have a category ID
                let categoryId: string; // Changed from `null` to `string`
                if (product.categoryName) {
                    categoryId = await this.findOrCreateCategory(product.categoryName);
                } else if (product.categoryId) {
                    categoryId = product.categoryId;
                } else {
                    // ✅ Use default category if no category provided
                    categoryId = await this.getDefaultCategory();
                }

                // Find or create brand - this can be null
                let brandId: string | null = null;
                if (product.brandName) {
                    brandId = await this.findOrCreateBrand(product.brandName);
                } else if (product.brandId) {
                    brandId = product.brandId;
                }

                // Create the product
                const created = await this.prisma.products.create({
                    data: {
                        Id: crypto.randomUUID(),
                        Name: product.name,
                        Barcode: product.barcode,
                        SKU: product.sku,
                        Description: product.description || '',
                        Price: new Prisma.Decimal(product.price),
                        CostPrice: new Prisma.Decimal(product.costPrice || 0),
                        Discount: new Prisma.Decimal(product.discount || 0),
                        StockQty: product.stockQty || 0,
                        ReorderLevel: product.reorderLevel || 5,
                        Unit: product.unit || 'pcs',
                        WarrantyMonths: product.warrantyMonths || 0,
                        ImageUrl: product.imageUrl || null,
                        CategoryId: categoryId, // ✅ Always a string (never null)
                        BrandId: brandId, // ✅ Can be string or null
                        IsActive: true,

                    },
                    include: {
                        Categories: true,
                        Brands: true
                    }
                });

                results.imported++;
                results.importedProducts.push(created);
            } catch (error: any) {
                results.errors.push(`Failed to import product "${product.name}": ${error.message}`);
                results.skipped++;
            }
        }

        return {
            message: `Import completed: ${results.imported} imported, ${results.skipped} skipped`,
            results,
        };
    }
    private async findOrCreateCategory(name: string): Promise<string> {
        const existing = await this.prisma.categories.findFirst({
            where: {
                Name: {
                    equals: name,
                    mode: 'insensitive'
                }
            }
        });

        if (existing) {
            return existing.Id;
        }

        const created = await this.prisma.categories.create({
            data: {
                Id: crypto.randomUUID(),
                Name: name,
            }
        });

        return created.Id;
    }

    // ============================
    // HELPER: Find or create brand
    // ============================
    private async findOrCreateBrand(name: string): Promise<string> {
        const existing = await this.prisma.brands.findFirst({
            where: {
                Name: {
                    equals: name,
                    mode: 'insensitive'
                }
            }
        });

        if (existing) {
            return existing.Id;
        }

        // ✅ FIXED: Use brands.create instead of categories.create
        const created = await this.prisma.brands.create({
            data: {
                Id: crypto.randomUUID(),
                Name: name,
                IsActive: true,
                CreatedAt: new Date(),
            }
        });

        return created.Id;
    }


}