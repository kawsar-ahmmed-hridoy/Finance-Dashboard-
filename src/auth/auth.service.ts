import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { RegisterDto, ChangePasswordDto } from './dto/auth.dto';
import { Role } from '../common/enums/role.enum';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuditService } from '../audit/audit.service';

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
  private static readonly DUMMY_BCRYPT_HASH =
    '$2b$10$KYVbZ5JFVfqu0oV98LnF5eTk4QTe2e4PQG7QNYfhumEpGdi/867AO';

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user || !user.isActive) {
      await bcrypt.compare(password, AuthService.DUMMY_BCRYPT_HASH);
      return null;
    }
    const isMatch = await user.comparePassword(password);
    return isMatch ? user : null;
  }

  async login(
    user: User,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<AuthResponse> {
    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.generateTokenPair(user, meta);
    await this.auditService.log({
      actorId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      details: { ip: meta?.ip ?? null },
    });
    return { user: this.sanitizeUser(user), tokens };
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const user = await this.usersService.create({
      ...dto,
      role: Role.VIEWER,
    });
    const tokens = await this.generateTokenPair(user);
    await this.auditService.log({
      actorId: user.id,
      action: 'auth.register',
      entityType: 'user',
      entityId: user.id,
    });
    return { user: this.sanitizeUser(user), tokens };
  }

  async refreshTokens(
    rawToken: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawToken);
    const storedToken = await this.refreshTokenRepo.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!storedToken || !storedToken.isValid) {
      if (storedToken?.userId) {
        await this.revokeAllUserTokens(storedToken.userId);
      }
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    await this.refreshTokenRepo.update(storedToken.id, { isRevoked: true });

    const tokens = await this.generateTokenPair(storedToken.user, meta);
    await this.auditService.log({
      actorId: storedToken.userId,
      action: 'auth.token_refreshed',
      entityType: 'user',
      entityId: storedToken.userId,
      details: { ip: meta?.ip ?? null },
    });
    return tokens;
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.refreshTokenRepo.update(
        { tokenHash, userId },
        { isRevoked: true },
      );
    }
    await this.auditService.log({
      actorId: userId,
      action: 'auth.logout',
      entityType: 'user',
      entityId: userId,
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllUserTokens(userId);
    await this.auditService.log({
      actorId: userId,
      action: 'auth.logout_all',
      entityType: 'user',
      entityId: userId,
    });
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
    await this.revokeAllUserTokens(userId);
    await this.auditService.log({
      actorId: userId,
      action: 'auth.password_changed',
      entityType: 'user',
      entityId: userId,
    });
  }

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

    const jwtSecret = this.getRequiredConfig('JWT_SECRET');
    const signOptions: JwtSignOptions = {
      secret: jwtSecret,
      expiresIn: this.parseSeconds(jwtExpiresIn),
    };
    const [accessToken, rawRefreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, signOptions),
      Promise.resolve(randomUUID()),
    ]);
    const refreshTokenHash = this.hashToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.parseDays(refreshExpiresIn));

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        tokenHash: refreshTokenHash,
        userId: user.id,
        expiresAt,
        ipAddress: meta?.ip?.substring(0, 45) ?? null,
        userAgent: meta?.userAgent?.substring(0, 500) ?? null,
      }),
    );

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
    const normalized = duration.trim().toLowerCase();
    const dayMatch = normalized.match(/^(\d+)d$/);
    if (dayMatch) return parseInt(dayMatch[1], 10);

    const seconds = this.parseSeconds(duration);
    return Math.max(1, Math.floor(seconds / 86400));
  }

  private parseSeconds(duration: string): number {
    const normalized = duration.trim().toLowerCase();
    const match = normalized.match(/^(\d+)([smhd])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      if (unit === 's') return value;
      if (unit === 'm') return value * 60;
      if (unit === 'h') return value * 3600;
      if (unit === 'd') return value * 86400;
    }

    const asNumber = Number(normalized);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return Math.floor(asNumber);
    }

    return 900;
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value || value.trim().length === 0) {
      throw new Error(`Missing required configuration: ${key}`);
    }
    return value;
  }
}
