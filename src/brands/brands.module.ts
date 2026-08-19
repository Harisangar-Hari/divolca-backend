import { Module } from '@nestjs/common';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
   imports: [
      PrismaModule,
  
    ],
  controllers: [BrandsController],
  providers: [BrandsService]
})
export class BrandsModule { }
