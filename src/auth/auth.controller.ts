// import {
//     Body,
//     Controller,
//     Post
// } from '@nestjs/common';

// import { ApiTags, ApiOperation } from '@nestjs/swagger';

// import { AuthService } from './auth.service';

// import { LoginDto } from './dto/login.dto';
// import { RegisterDto } from './dto/register.dto';


// @ApiTags('Auth')
// @Controller('auth')
// export class AuthController {


//     constructor(
//         private authService: AuthService
//     ) { }



//     // =========================
//     // REGISTER
//     // =========================

//     @Post('register')
//     @ApiOperation({
//         summary: 'Create new user'
//     })
//     async register(
//         @Body() dto: RegisterDto
//     ) {

//         return this.authService.register(dto);

//     }



//     // =========================
//     // LOGIN
//     // =========================

//     @Post('login')
//     @ApiOperation({
//         summary: 'Login user and get JWT token'
//     })
//     async login(
//         @Body() dto: LoginDto
//     ) {

//         return this.authService.login(dto);

//     }


// }





// src/auth/auth.controller.ts
import { Controller, Post, Body, Get, Delete, UseGuards, Param, Patch, BadRequestException, Put, Res, UnauthorizedException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Permissions } from './decorators/permissions.decorator';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { Request, Response } from 'express';

@ApiTags('Authentication')
@ApiBearerAuth('JWT-auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Public()
    @Post('login')
    @ApiOperation({
        summary: 'User login',
        description: 'Authenticate user and return access token'
    })
    @ApiResponse({
        status: 200,
        description: 'Login successful',
        schema: {
            example: {
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                user: {
                    id: 'uuid',
                    username: 'admin',
                    role: 'admin',
                    fullName: 'Admin User',
                    email: 'admin@example.com',
                    permissions: {
                        canViewDashboard: true,
                        canViewSales: true,
                        // ... more permissions
                    }
                }
            }
        }
    })
    @Public()
    @Post('login')
    @ApiOperation({ summary: 'User login' })
    @ApiBody({ type: LoginDto })
    async login(
        @Body() dto: LoginDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.authService.login(dto.username, dto.password);

        res.cookie('refreshToken', result.refreshToken, this.getRefreshCookieOptions());

        // ✅ refreshToken no longer leaves the server in the body
        return {
            accessToken: result.accessToken,
            user: result.user,
        };
    }

    @Public()
    @Post('refresh')
    @ApiOperation({ summary: 'Refresh access token' })
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const token = req.cookies?.refreshToken;

        if (!token) {
            throw new UnauthorizedException('No refresh token');
        }

        const result = await this.authService.refreshToken(token);

        // Rotate the refresh cookie
        if (result.refreshToken) {
            res.cookie('refreshToken', result.refreshToken, this.getRefreshCookieOptions());
        }

        return {
            accessToken: result.accessToken,
            user: result.user,
        };
    }

    @Post('logout')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'User logout' })
    async logout(
        @CurrentUser('sub') userId: string,
        @Res({ passthrough: true }) res: Response,
    ) {
        const options = this.getRefreshCookieOptions();
        // Clear requires matching options except maxAge
        res.clearCookie('refreshToken', {
            httpOnly: options.httpOnly,
            secure: options.secure,
            sameSite: options.sameSite,
            path: options.path,
        });

        return this.authService.logout(userId);
    }

    @Get('me')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'User profile retrieved' })
    async getCurrentUser(@CurrentUser('sub') userId: string) {
        return this.authService.getCurrentUser(userId);
    }

    // ✅ Admin only - User management
    @Roles(UserRole.ADMIN)
    @Permissions('canManageUsers')
    @ApiBearerAuth()
    @Post('users')
    @ApiOperation({ summary: 'Create a new user (Admin only)' })
    @ApiBody({ type: CreateUserDto })
    async createUser(@Body() dto: CreateUserDto) {
        // Create user
        return this.authService.createUser(dto);
    }


    @Roles(UserRole.ADMIN)
    @Permissions('canManageUsers')
    @ApiBearerAuth()
    @Get('users')
    @ApiOperation({ summary: 'Get all users (Admin only)' })
    @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
    async getAllUsers() {
        return this.authService.getAllUsers();
    }

    // =========================
    // UPDATE USER (Admin only)
    // =========================
    @Roles(UserRole.ADMIN)
    @Permissions('canManageUsers')
    @ApiBearerAuth()
    @Put('users/:id')
    @ApiOperation({ summary: 'Update a user (Admin only)' })
    async updateUser(
        @Param('id') id: string,
        @Body() dto: {
            username?: string;
            password?: string;
            role?: UserRole;
            fullName?: string;
            email?: string;
            isActive?: boolean;
        },
    ) {
        return this.authService.updateUser(id, dto);
    }

    // =========================
    // DELETE USER (Admin only)
    // =========================
    @Roles(UserRole.ADMIN)
    @Permissions('canManageUsers')
    @ApiBearerAuth()
    @Delete('users/:id')
    @ApiOperation({ summary: 'Delete a user (Admin only)' })
    async deleteUser(
        @Param('id') id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.authService.deleteUser(id, currentUserId);
    }

    // =========================
    // TOGGLE USER STATUS (Admin only)
    // =========================
    @Roles(UserRole.ADMIN)
    @Permissions('canManageUsers')
    @ApiBearerAuth()
    @Patch('users/:id/toggle-status')
    @ApiOperation({ summary: 'Toggle user active status (Admin only)' })
    async toggleUserStatus(
        @Param('id') id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.authService.toggleUserStatus(id, currentUserId);
    }

    // =========================
    // GET PERMISSIONS FOR ROLE
    // =========================
    @Roles(UserRole.ADMIN)
    @Permissions('canManageUsers')
    @ApiBearerAuth()
    @Get('permissions/:role')
    @ApiOperation({ summary: 'Get permission matrix for a role' })
    async getPermissionsForRole(
        @Param('role') role: string,
    ) {
        const validRoles = Object.values(UserRole);

        if (!validRoles.includes(role as UserRole)) {
            throw new BadRequestException(`Invalid role: ${role}`);
        }

        return this.authService.getUserPermissions(role as UserRole);
    }


    private getRefreshCookieOptions() {
        const isProd = process.env.NODE_ENV === 'production';
        return {
            httpOnly: true,
            secure: isProd,
            sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/',
        };
    }
}