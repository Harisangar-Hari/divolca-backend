import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';


@Injectable()
export class DashboardService {


    constructor(
        private prisma: PrismaService
    ) { }



    // =====================
    // STATS
    // =====================

    async getStats() {


        const today = new Date();

        today.setUTCHours(
            0,
            0,
            0,
            0
        );



        const totalProducts =
            await this.prisma.products.count();



        const totalCategories =
            await this.prisma.categories.count();



        const completedSales =
            await this.prisma.sales.findMany({

                where: {
                    Status: 0
                }

            });



        const todayCompletedSales =
            completedSales.filter(
                sale =>
                    sale.CreatedAt >= today
            );



        const todaySales =
            todayCompletedSales.reduce(
                (sum, sale) =>
                    sum + Number(sale.TotalAmount),
                0
            );



        const totalRevenue =
            completedSales.reduce(
                (sum, sale) =>
                    sum + Number(sale.TotalAmount),
                0
            );



        const todayOrders =
            todayCompletedSales.length;



        const avgOrderValue =
            todayOrders > 0
                ?
                todaySales / todayOrders
                :
                0;



        // StockQty <= ReorderLevel
        const products =
            await this.prisma.products.findMany({

                select: {
                    StockQty: true,
                    ReorderLevel: true
                }

            });



        const lowStockItems =
            products.filter(
                p =>
                    p.StockQty <= p.ReorderLevel
            ).length;



        const outOfStockItems =
            await this.prisma.products.count({

                where: {
                    StockQty: 0
                }

            });



        return {

            totalProducts,

            totalCategories,

            todaySales,

            lowStockItems,

            totalRevenue,

            todayOrders,

            avgOrderValue,

            outOfStockItems

        };

    }



    // =====================
    // SALES TREND
    // =====================


    async getSalesTrend() {


        const sales =
            await this.prisma.sales.findMany({

                where: {
                    CreatedAt: {
                        gte:
                            new Date(
                                Date.now()
                                -
                                7 *
                                24 *
                                60 *
                                60 *
                                1000
                            )
                    }
                }

            });



        const result: {
            day: string;
            sales: number;
        }[] = [];



        for (let i = 6; i >= 0; i--) {


            const date =
                new Date();



            date.setUTCDate(
                date.getUTCDate() - i
            );



            date.setUTCHours(
                0,
                0,
                0,
                0
            );



            const total =
                sales
                    .filter(
                        sale =>
                            sale.CreatedAt.toDateString()
                            ===
                            date.toDateString()
                    )
                    .reduce(
                        (sum, sale) =>
                            sum + Number(sale.TotalAmount),
                        0
                    );



            result.push({

                day:
                    date.toLocaleDateString(
                        'en-US',
                        {
                            weekday: 'short'
                        }
                    ),

                sales: total

            });


        }



        return result;

    }



    // =====================
    // TOP PRODUCTS
    // =====================


    async getTopProducts() {


        const items =
            await this.prisma.saleItems.findMany({

                include: {
                    Products: true
                }

            });



        const map =
            new Map<
                string,
                {
                    name: string;
                    quantity: number;
                    revenue: number;
                }
            >();



        for (const item of items) {


            const name =
                item.Products.Name;



            if (!map.has(name)) {


                map.set(
                    name,
                    {
                        name,
                        quantity: 0,
                        revenue: 0
                    }
                );

            }



            const product =
                map.get(name)!;



            product.quantity += item.Quantity;

            product.revenue += Number(item.Total);

        }



        return Array.from(
            map.values()
        )
            .sort(
                (a, b) =>
                    b.quantity - a.quantity
            )
            .slice(0, 5);


    }



    // =====================
    // LOW STOCK PRODUCTS
    // =====================


    async getLowStockProducts() {


        const products =
            await this.prisma.products.findMany({

                select: {

                    Id: true,

                    Name: true,

                    StockQty: true,

                    ReorderLevel: true

                },

                orderBy: {
                    StockQty: 'asc'
                }

            });



        return products.filter(
            p =>
                p.StockQty <= p.ReorderLevel
        );


    }


}