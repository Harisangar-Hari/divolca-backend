import {
    Body,
    Controller,
    Post
} from '@nestjs/common';

import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { AuthService } from './auth.service';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';


@ApiTags('Auth')
@Controller('auth')
export class AuthController {


    constructor(
        private authService: AuthService
    ) { }



    // =========================
    // REGISTER
    // =========================

    @Post('register')
    @ApiOperation({
        summary: 'Create new user'
    })
    async register(
        @Body() dto: RegisterDto
    ) {

        return this.authService.register(dto);

    }



    // =========================
    // LOGIN
    // =========================

    @Post('login')
    @ApiOperation({
        summary: 'Login user and get JWT token'
    })
    async login(
        @Body() dto: LoginDto
    ) {

        return this.authService.login(dto);

    }


}