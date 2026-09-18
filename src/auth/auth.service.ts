// import {
//     Injectable,
//     UnauthorizedException,
//     BadRequestException,
// } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
// import { ConfigService } from '@nestjs/config';
// import { randomUUID } from 'crypto';
// import * as bcrypt from 'bcrypt';

// import { PrismaService } from '../prisma/prisma.service';
// import { RegisterDto } from './dto/register.dto';
// import { LoginDto } from './dto/login.dto';

// @Injectable()
// export class AuthService {
//     constructor(
//         private readonly prisma: PrismaService,
//         private readonly jwtService: JwtService,
//         private readonly configService: ConfigService,
//     ) { }

//     // =========================
//     // REGISTER
//     // =========================
//     async register(dto: RegisterDto) {
//         const exists = await this.prisma.users.findFirst({
//             where: {
//                 Username: dto.username,
//             },
//         });

//         if (exists) {
//             throw new BadRequestException('Username already exists');
//         }

//         const passwordHash = await bcrypt.hash(dto.password, 10);

//         await this.prisma.users.create({
//             data: {
//                 Id: randomUUID(),
//                 Username: dto.username,
//                 PasswordHash: passwordHash,
//                 Role: dto.role ?? 'Cashier',
//                 CreatedAt: new Date(),
//             },
//         });

//         return {
//             message: 'User created successfully',
//         };
//     }

//     // =========================
//     // LOGIN
//     // =========================
//     async login(dto: LoginDto) {
//         const user = await this.prisma.users.findFirst({
//             where: {
//                 Username: dto.username,
//             },
//         });

//         if (!user) {
//             throw new UnauthorizedException('Invalid username or password');
//         }

//         const validPassword = await bcrypt.compare(
//             dto.password,
//             user.PasswordHash,
//         );

//         if (!validPassword) {
//             throw new UnauthorizedException('Invalid username or password');
//         }

//         const token = this.generateToken(user);

//         return {
//             token,
//             user: {
//                 Id: user.Id,
//                 Username: user.Username,
//                 Role: user.Role,
//             },
//         };
//     }

//     // =========================
//     // JWT TOKEN
//     // =========================
//     private generateToken(user: {
//         Id: string;
//         Username: string;
//         Role: string;
//     }): string {
//         const payload = {
//             sub: user.Id,
//             username: user.Username,
//             role: user.Role,
//         };

//         return this.jwtService.sign(payload, {
//             issuer: this.configService.getOrThrow<string>('JWT_ISSUER'),
//             audience: this.configService.getOrThrow<string>('JWT_AUDIENCE'),
//         });
//     }
// }



// src/auth/auth.service.ts
import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
    NotFoundException,
    ForbiddenException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export enum UserRole {
    ADMIN = 'admin',
    MANAGER = 'manager',
    SALES = 'sales',
    CASHIER = 'cashier',
    VIEWER = 'viewer',
}

export interface UserPermissions {
    // Dashboard
    canViewDashboard: boolean;

    // Products
    canViewProducts: boolean;
    canCreateProducts: boolean;
    canEditProducts: boolean;
    canDeleteProducts: boolean;

    // Categories
    canViewCategories: boolean;
    canCreateCategories: boolean;
    canEditCategories: boolean;
    canDeleteCategories: boolean;

    // Sales
    canViewSales: boolean;
    canCreateSales: boolean;
    canEditSales: boolean;
    canDeleteSales: boolean;

    // Customers
    canViewCustomers: boolean;
    canCreateCustomers: boolean;
    canEditCustomers: boolean;
    canDeleteCustomers: boolean;
    canManageCreditPayments: boolean;

    // Customer Cheques
    canViewCustomerCheques: boolean;
    canManageCustomerCheques: boolean;

    // Reports
    canViewReports: boolean;
    canExportReports: boolean;

    // Purchases
    canViewPurchases: boolean;
    canCreatePurchases: boolean;
    canEditPurchases: boolean;
    canDeletePurchases: boolean;

    // Suppliers
    canViewSuppliers: boolean;
    canCreateSuppliers: boolean;
    canEditSuppliers: boolean;
    canDeleteSuppliers: boolean;

    // Supplier Cheques
    canViewSupplierCheques: boolean;
    canManageSupplierCheques: boolean;

    // Expenses
    canViewExpenses: boolean;
    canCreateExpenses: boolean;
    canEditExpenses: boolean;
    canDeleteExpenses: boolean;

    // Cash
    canViewCashDashboard: boolean;

    // System
    canManageUsers: boolean;
    canManageSettings: boolean;
}
@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    // =========================
    // LOGIN
    // =========================
    async login(username: string, password: string) {
        // Find user by username
        const user = await this.prisma.users.findFirst({
            where: { Username: username },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.IsActive) {
            throw new UnauthorizedException('User account is disabled');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Update last login
        await this.prisma.users.update({
            where: { Id: user.Id },
            data: { LastLogin: new Date() },
        });

        // Get user permissions
        const permissions = this.getPermissions(user.Role as UserRole);

        // Generate tokens
        const payload = {
            sub: user.Id,
            username: user.Username,
            role: user.Role,
            fullName: user.FullName,
            permissions: permissions,
        };

        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.Id,
                username: user.Username,
                role: user.Role,
                fullName: user.FullName,
                email: user.Email,
                permissions,
            },
        };
    }

    // =========================
    // REFRESH TOKEN
    // =========================
    async refreshToken(refreshToken: string) {
        try {
            const payload = this.jwtService.verify(refreshToken);

            const user = await this.prisma.users.findUnique({
                where: { Id: payload.sub },
            });

            if (!user || !user.IsActive) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            const permissions = this.getPermissions(user.Role as UserRole);

            const newPayload = {
                sub: user.Id,
                username: user.Username,
                role: user.Role,
                fullName: user.FullName,
                permissions,
            };

            const accessToken = this.jwtService.sign(newPayload);
            const newRefreshToken = this.jwtService.sign(newPayload, {
                expiresIn: '7d',
            });

            return {
                accessToken,
                refreshToken: newRefreshToken,   // ✅ rotated
                user: {
                    id: user.Id,
                    username: user.Username,
                    role: user.Role,
                    fullName: user.FullName,
                    email: user.Email,
                    permissions,
                },
            };
        } catch (error) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    // =========================
    // LOGOUT
    // =========================
    async logout(userId: string) {
        // Optional: Track logout time or invalidate tokens
        return { message: 'Logged out successfully ' };
    }

    // =========================
    // GET CURRENT USER
    // =========================
    async getCurrentUser(userId: string) {
        const user = await this.prisma.users.findUnique({
            where: { Id: userId },
            select: {
                Id: true,
                Username: true,
                Role: true,
                FullName: true,
                Email: true,
                IsActive: true,
                CreatedAt: true,
                LastLogin: true,
            },
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const permissions = this.getPermissions(user.Role as UserRole);

        return {
            id: user.Id,
            username: user.Username,
            role: user.Role,
            fullName: user.FullName,
            email: user.Email,
            isActive: user.IsActive,
            createdAt: user.CreatedAt,
            lastLogin: user.LastLogin,
            permissions,
        };
    }

    // =========================
    // GET ALL USERS (Admin only)
    // =========================
    async getAllUsers() {
        const users = await this.prisma.users.findMany({
            select: {
                Id: true,
                Username: true,
                Role: true,
                FullName: true,
                Email: true,
                IsActive: true,
                CreatedAt: true,
                LastLogin: true,
            },
            orderBy: {
                CreatedAt: 'desc',
            },
        });

        return users.map(user => ({
            id: user.Id,
            username: user.Username,
            role: user.Role,
            fullName: user.FullName,
            email: user.Email,
            isActive: user.IsActive,
            createdAt: user.CreatedAt,
            lastLogin: user.LastLogin,
        }));
    }

    // =========================
    // CREATE USER (Admin only)
    // =========================
    async createUser(dto: {
        username: string;
        password: string;
        role: UserRole;
        fullName?: string;
        email?: string;
    }) {
        // Check if username already exists
        const existingUsername = await this.prisma.users.findFirst({
            where: { Username: dto.username },
        });

        if (existingUsername) {
            throw new BadRequestException('Username already exists');
        }

        // Check if email already exists (if provided)
        if (dto.email) {
            const existingEmail = await this.prisma.users.findFirst({
                where: { Email: dto.email },
            });

            if (existingEmail) {
                throw new BadRequestException('Email already exists');
            }
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(dto.password, salt);

        // Create user
        const user = await this.prisma.users.create({
            data: {
                Id: randomUUID(),
                Username: dto.username,
                PasswordHash: passwordHash,
                Role: dto.role,
                FullName: dto.fullName || null,
                Email: dto.email || null,
                IsActive: true,
                CreatedAt: new Date(),
                UpdatedAt: new Date(),
            },
        });

        return {
            id: user.Id,
            username: user.Username,
            role: user.Role,
            fullName: user.FullName,
            email: user.Email,
            isActive: user.IsActive,
            createdAt: user.CreatedAt,
        };
    }

    // =========================
    // UPDATE USER (Admin only)
    // =========================
    async updateUser(userId: string, dto: {
        username?: string;
        password?: string;
        role?: UserRole;
        fullName?: string;
        email?: string;
        isActive?: boolean;
    }) {
        // Check if user exists
        const user = await this.prisma.users.findUnique({
            where: { Id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Check if username is being changed and already exists
        if (dto.username && dto.username !== user.Username) {
            const existingUsername = await this.prisma.users.findFirst({
                where: {
                    Username: dto.username,
                    NOT: { Id: userId },
                },
            });

            if (existingUsername) {
                throw new BadRequestException('Username already exists');
            }
        }

        // Check if email is being changed and already exists
        if (dto.email && dto.email !== user.Email) {
            const existingEmail = await this.prisma.users.findFirst({
                where: {
                    Email: dto.email,
                    NOT: { Id: userId },
                },
            });

            if (existingEmail) {
                throw new BadRequestException('Email already exists');
            }
        }

        // Prepare update data
        const updateData: any = {};

        if (dto.username) updateData.Username = dto.username;
        if (dto.role) updateData.Role = dto.role;
        if (dto.fullName !== undefined) updateData.FullName = dto.fullName;
        if (dto.email !== undefined) updateData.Email = dto.email;
        if (dto.isActive !== undefined) updateData.IsActive = dto.isActive;

        // Hash password if provided
        if (dto.password) {
            const salt = await bcrypt.genSalt(10);
            updateData.PasswordHash = await bcrypt.hash(dto.password, salt);
        }

        const updatedUser = await this.prisma.users.update({
            where: { Id: userId },
            data: updateData,
        });

        return {
            id: updatedUser.Id,
            username: updatedUser.Username,
            role: updatedUser.Role,
            fullName: updatedUser.FullName,
            email: updatedUser.Email,
            isActive: updatedUser.IsActive,
        };
    }

    // =========================
    // DELETE USER (Admin only)
    // =========================
    async deleteUser(userId: string, currentUserId: string) {
        // Prevent self-deletion
        if (userId === currentUserId) {
            throw new BadRequestException('Cannot delete your own account');
        }

        // Check if user exists
        const user = await this.prisma.users.findUnique({
            where: { Id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // ✅ NEW: Prevent deleting admin users
        if (user.Role === UserRole.ADMIN) {
            throw new ForbiddenException('Admin users cannot be deleted');
        }

        await this.prisma.users.delete({
            where: { Id: userId },
        });

        return {
            message: `User ${user.Username} deleted successfully`,
        };
    }

    // =========================
    // TOGGLE USER STATUS (Admin only)
    // =========================
    async toggleUserStatus(userId: string, currentUserId: string) {
        // Prevent self-deactivation
        if (userId === currentUserId) {
            throw new BadRequestException('Cannot deactivate your own account');
        }

        const user = await this.prisma.users.findUnique({
            where: { Id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const updatedUser = await this.prisma.users.update({
            where: { Id: userId },
            data: {
                IsActive: !user.IsActive,
            },
        });

        return {
            id: updatedUser.Id,
            username: updatedUser.Username,
            isActive: updatedUser.IsActive,
        };
    }

    // =========================
    // CHANGE PASSWORD (Self)
    // =========================
    async changePassword(userId: string, currentPassword: string, newPassword: string) {
        const user = await this.prisma.users.findUnique({
            where: { Id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.PasswordHash);
        if (!isPasswordValid) {
            throw new BadRequestException('Current password is incorrect');
        }

        // Validate new password
        if (newPassword.length < 6) {
            throw new BadRequestException('New password must be at least 6 characters');
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await this.prisma.users.update({
            where: { Id: userId },
            data: { PasswordHash: passwordHash },
        });

        return {
            message: 'Password changed successfully',
        };
    }

    // =========================
    // GET USER PERMISSIONS
    // =========================
    getUserPermissions(role: UserRole): UserPermissions {
        return this.getPermissions(role);
    }

    // =========================
    // PRIVATE: GET PERMISSIONS BY ROLE
    // =========================
    private getPermissions(role: UserRole): UserPermissions {
        // =========================
        // ADMIN — full access
        // =========================
        if (role === UserRole.ADMIN) {
            return {
                canViewDashboard: true,

                canViewProducts: true,
                canCreateProducts: true,
                canEditProducts: true,
                canDeleteProducts: true,

                canViewCategories: true,
                canCreateCategories: true,
                canEditCategories: true,
                canDeleteCategories: true,

                canViewSales: true,
                canCreateSales: true,
                canEditSales: true,
                canDeleteSales: true,

                canViewCustomers: true,
                canCreateCustomers: true,
                canEditCustomers: true,
                canDeleteCustomers: true,
                canManageCreditPayments: true,

                canViewCustomerCheques: true,
                canManageCustomerCheques: true,

                canViewReports: true,
                canExportReports: true,

                canViewPurchases: true,
                canCreatePurchases: true,
                canEditPurchases: true,
                canDeletePurchases: true,

                canViewSuppliers: true,
                canCreateSuppliers: true,
                canEditSuppliers: true,
                canDeleteSuppliers: true,

                canViewSupplierCheques: true,
                canManageSupplierCheques: true,

                canViewExpenses: true,
                canCreateExpenses: true,
                canEditExpenses: true,
                canDeleteExpenses: true,

                canViewCashDashboard: true,

                canManageUsers: true,
                canManageSettings: true,
            };
        }

        // =========================
        // MANAGER — full ops except deletes + user mgmt
        // =========================
        if (role === UserRole.MANAGER) {
            return {
                canViewDashboard: true,

                canViewProducts: true,
                canCreateProducts: true,
                canEditProducts: true,
                canDeleteProducts: false,

                canViewCategories: true,
                canCreateCategories: true,
                canEditCategories: true,
                canDeleteCategories: false,

                canViewSales: true,
                canCreateSales: true,
                canEditSales: true,
                canDeleteSales: false,

                canViewCustomers: true,
                canCreateCustomers: true,
                canEditCustomers: true,
                canDeleteCustomers: false,
                canManageCreditPayments: true,

                canViewCustomerCheques: true,
                canManageCustomerCheques: true,

                canViewReports: true,
                canExportReports: true,

                canViewPurchases: true,
                canCreatePurchases: true,
                canEditPurchases: true,
                canDeletePurchases: false,

                canViewSuppliers: true,
                canCreateSuppliers: true,
                canEditSuppliers: true,
                canDeleteSuppliers: false,

                canViewSupplierCheques: true,
                canManageSupplierCheques: true,

                canViewExpenses: true,
                canCreateExpenses: true,
                canEditExpenses: true,
                canDeleteExpenses: false,

                canViewCashDashboard: true,

                canManageUsers: false,
                canManageSettings: false,
            };
        }

        // =========================
        // SALES — POS-focused rep
        // =========================
        if (role === UserRole.SALES) {
            return {
                canViewDashboard: true,

                canViewProducts: true,
                canCreateProducts: false,
                canEditProducts: false,
                canDeleteProducts: false,

                canViewCategories: true,
                canCreateCategories: false,
                canEditCategories: false,
                canDeleteCategories: false,

                canViewSales: true,
                canCreateSales: true,
                canEditSales: false,
                canDeleteSales: false,

                canViewCustomers: true,
                canCreateCustomers: true,
                canEditCustomers: false,
                canDeleteCustomers: false,
                canManageCreditPayments: true,

                canViewCustomerCheques: true,
                canManageCustomerCheques: false,

                canViewReports: true,
                canExportReports: true,

                canViewPurchases: false,
                canCreatePurchases: false,
                canEditPurchases: false,
                canDeletePurchases: false,

                canViewSuppliers: false,
                canCreateSuppliers: false,
                canEditSuppliers: false,
                canDeleteSuppliers: false,

                canViewSupplierCheques: false,
                canManageSupplierCheques: false,

                canViewExpenses: false,
                canCreateExpenses: false,
                canEditExpenses: false,
                canDeleteExpenses: false,

                canViewCashDashboard: false,

                canManageUsers: false,
                canManageSettings: false,
            };
        }

        // =========================
        // CASHIER — POS operator
        // =========================
        if (role === UserRole.CASHIER) {
            return {
                canViewDashboard: true,

                canViewProducts: true,
                canCreateProducts: false,
                canEditProducts: false,
                canDeleteProducts: false,

                canViewCategories: true,
                canCreateCategories: false,
                canEditCategories: false,
                canDeleteCategories: false,

                canViewSales: true,
                canCreateSales: true,
                canEditSales: false,
                canDeleteSales: false,

                canViewCustomers: true,
                canCreateCustomers: true,
                canEditCustomers: false,
                canDeleteCustomers: false,
                canManageCreditPayments: true,

                canViewCustomerCheques: true,
                canManageCustomerCheques: false,

                canViewReports: false,
                canExportReports: false,

                canViewPurchases: false,
                canCreatePurchases: false,
                canEditPurchases: false,
                canDeletePurchases: false,

                canViewSuppliers: false,
                canCreateSuppliers: false,
                canEditSuppliers: false,
                canDeleteSuppliers: false,

                canViewSupplierCheques: false,
                canManageSupplierCheques: false,

                canViewExpenses: false,
                canCreateExpenses: false,
                canEditExpenses: false,
                canDeleteExpenses: false,

                canViewCashDashboard: false,

                canManageUsers: false,
                canManageSettings: false,
            };
        }

        // =========================
        // VIEWER — read-only
        // =========================
        return {
            canViewDashboard: true,

            canViewProducts: true,
            canCreateProducts: false,
            canEditProducts: false,
            canDeleteProducts: false,

            canViewCategories: true,
            canCreateCategories: false,
            canEditCategories: false,
            canDeleteCategories: false,

            canViewSales: true,
            canCreateSales: false,
            canEditSales: false,
            canDeleteSales: false,

            canViewCustomers: true,
            canCreateCustomers: false,
            canEditCustomers: false,
            canDeleteCustomers: false,
            canManageCreditPayments: false,

            canViewCustomerCheques: true,
            canManageCustomerCheques: false,

            canViewReports: true,
            canExportReports: false,

            canViewPurchases: true,
            canCreatePurchases: false,
            canEditPurchases: false,
            canDeletePurchases: false,

            canViewSuppliers: true,
            canCreateSuppliers: false,
            canEditSuppliers: false,
            canDeleteSuppliers: false,

            canViewSupplierCheques: true,
            canManageSupplierCheques: false,

            canViewExpenses: true,
            canCreateExpenses: false,
            canEditExpenses: false,
            canDeleteExpenses: false,

            canViewCashDashboard: true,

            canManageUsers: false,
            canManageSettings: false,
        };
    }
}