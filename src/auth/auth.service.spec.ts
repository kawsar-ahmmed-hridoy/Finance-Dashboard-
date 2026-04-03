import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';

const mockUser: Partial<User> = {
  id: 'user-uuid-1',
  email: 'test@test.com',
  firstName: 'Test',
  lastName: 'User',
  role: Role.VIEWER,
  isActive: true,
  comparePassword: jest.fn().mockResolvedValue(true),
};

const mockRefreshTokenRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockReturnValue({}),
  update: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  }),
};

const mockUsersService = {
  findByEmail: jest.fn().mockResolvedValue(mockUser),
  findOne: jest.fn().mockResolvedValue(mockUser),
  create: jest.fn().mockResolvedValue(mockUser),
  updateLastLogin: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(mockUser),
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const cfg: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    };
    return cfg[key];
  }),
  getOrThrow: jest.fn().mockReturnValue('test-secret'),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuditService, useValue: mockAuditService },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockAuditService.log.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('returns user when credentials are correct', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce({
        ...mockUser,
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(true),
      });
      const result = await service.validateUser('test@test.com', 'P@ssw0rd!');
      expect(result).not.toBeNull();
    });

    it('returns null when user is inactive', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce({
        ...mockUser,
        isActive: false,
      });
      const result = await service.validateUser('test@test.com', 'P@ssw0rd!');
      expect(result).toBeNull();
    });

    it('returns null when password is wrong', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce({
        ...mockUser,
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(false),
      });
      const result = await service.validateUser('test@test.com', 'wrong');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('returns user and token pair', async () => {
      mockRefreshTokenRepo.save.mockResolvedValueOnce({});
      mockRefreshTokenRepo.create.mockReturnValueOnce({});
      const result = await service.login(mockUser as User);
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });
  });
});
