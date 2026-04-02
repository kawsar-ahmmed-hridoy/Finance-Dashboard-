import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { RegisterDto, ChangePasswordDto } from './dto/auth.dto';
import { Role } from '../common/enums/role.enum';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: Omit<User, 'password' | 'refreshTokens'>;
  tokens: TokenPair;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) return null;
    const isMatch = await user.comparePassword(password);
    return isMatch ? user : null;
  }

  async login(
    user: User,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<AuthResponse> {
    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.generateTokenPair(user, meta);
    return { user: this.sanitizeUser(user), tokens };
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const user = await this.usersService.create({
      ...dto,
      role: Role.VIEWER,
    });
    const tokens = await this.generateTokenPair(user);
    return { user: this.sanitizeUser(user), tokens };
  }

  async refreshTokens(
    rawToken: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const storedToken = await this.refreshTokenRepo.findOne({
      where: { token: rawToken },
      relations: ['user'],
    });

    if (!storedToken || !storedToken.isValid) {
      // Potential token reuse — revoke all tokens for safety
      if (storedToken?.userId) {
        await this.revokeAllUserTokens(storedToken.userId);
      }
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    // Rotate: revoke used token
    await this.refreshTokenRepo.update(storedToken.id, { isRevoked: true });

    return this.generateTokenPair(storedToken.user, meta);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.refreshTokenRepo.update(
        { token: refreshToken, userId },
        { isRevoked: true },
      );
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllUserTokens(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findOne(userId);
    const isMatch = await user.comparePassword(dto.currentPassword);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }
    user.password = dto.newPassword;
    await this.usersService.update(userId, { ...user });
    // Invalidate all sessions after password change
    await this.revokeAllUserTokens(userId);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async generateTokenPair(
    user: User,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const jwtExpiresIn = this.configService.get<string>(
      'JWT_EXPIRES_IN',
      '15m',
    );
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'default-secret';
    const [accessToken, rawRefreshToken] = await Promise.all([
      this.jwtService.signAsync({ ...payload } as any, {
        secret: jwtSecret,
        expiresIn: jwtExpiresIn,
      } as any),
      Promise.resolve(uuidv4()),
    ]);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.parseDays(refreshExpiresIn));

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        token: rawRefreshToken,
        userId: user.id,
        expiresAt,
        ipAddress: meta?.ip?.substring(0, 45) ?? null,
        userAgent: meta?.userAgent?.substring(0, 500) ?? null,
      }),
    );

    // Clean up expired tokens for this user (async, non-blocking)
    this.cleanupExpiredTokens(user.id).catch(() => {});

    const expiresInSeconds = this.parseSeconds(jwtExpiresIn);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: expiresInSeconds,
    };
  }

  private async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepo.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );
  }

  private async cleanupExpiredTokens(userId: string): Promise<void> {
    await this.refreshTokenRepo
      .createQueryBuilder()
      .delete()
      .where('userId = :userId AND expiresAt < NOW()', { userId })
      .execute();
  }

  private sanitizeUser(user: User): Omit<User, 'password' | 'refreshTokens'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshTokens, ...safe } = user as User & {
      password: string;
      refreshTokens: RefreshToken[];
    };
    return safe as Omit<User, 'password' | 'refreshTokens'>;
  }

  private parseDays(duration: string): number {
    const match = duration.match(/^(\d+)d$/);
    return match ? parseInt(match[1], 10) : 7;
  }

  private parseSeconds(duration: string): number {
    if (duration.endsWith('m')) return parseInt(duration) * 60;
    if (duration.endsWith('h')) return parseInt(duration) * 3600;
    if (duration.endsWith('d')) return parseInt(duration) * 86400;
    return 900; // 15 minutes default
  }
}
