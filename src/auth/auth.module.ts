// import { Module } from '@nestjs/common';
// import { PassportModule } from '@nestjs/passport';
// import { JwtModule } from '@nestjs/jwt';
// import { ConfigModule, ConfigService } from '@nestjs/config';

// import { AuthController } from './auth.controller';
// import { AuthService } from './auth.service';

// import { PrismaModule } from '../prisma/prisma.module';
// import { JwtStrategy } from './strategies/jwt.strategy';

// @Module({
//   imports: [
//     PrismaModule,

//     PassportModule.register({
//       defaultStrategy: 'jwt',
//     }),

//     JwtModule.registerAsync({
//       imports: [ConfigModule],
//       inject: [ConfigService],
//       useFactory: (config: ConfigService) => ({
//         secret: config.getOrThrow<string>('JWT_SECRET'),
//         signOptions: {
//           expiresIn: '1d',
//           issuer: config.getOrThrow<string>('JWT_ISSUER'),
//           audience: config.getOrThrow<string>('JWT_AUDIENCE'),
//         },
//       }),
//     }),
//   ],

//   controllers: [AuthController],

//   providers: [AuthService, JwtStrategy],

//   exports: [AuthService, JwtModule, PassportModule],
// })
// export class AuthModule { }


// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
    imports: [
        PrismaModule,
        PassportModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'your-secret-key',
            signOptions: { expiresIn: '24h' },
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        {
            provide: 'APP_GUARD',
            useClass: AuthGuard,        // runs first — validates token
        },
        {
            provide: 'APP_GUARD',
            useClass: RolesGuard,       // ✅ runs after — enforces roles
        },
        RolesGuard,
    ],
    exports: [AuthService],
})
export class AuthModule { }