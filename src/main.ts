import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import {
  join
} from 'path';


async function bootstrap() {

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule
  );
  app.enableCors({

    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://pos-billing-five.vercel.app',
      'https://pos-admin-delta.vercel.app'
    ],

    methods: [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'PATCH'
    ],

    credentials: true

  });


  // Same as ASP.NET Route Prefix: api/
  app.setGlobalPrefix('api');


  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('POS API')
    .setDescription('POS Backend API Documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'JWT-auth',
    )
    .build();


  const document = SwaggerModule.createDocument(
    app,
    config,
  );


  SwaggerModule.setup(
    'swagger',
    app,
    document,
  );


  // DTO Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useStaticAssets(

    join(
      __dirname,
      '..',
      'uploads'
    ),

    {
      prefix: '/uploads/'
    }

  );


  await app.listen(process.env.PORT ?? 3005);


  console.log(
    `Application is running on: ${await app.getUrl()}`
  );

  console.log(
    `Swagger: ${await app.getUrl()}/swagger`
  );
}


bootstrap();