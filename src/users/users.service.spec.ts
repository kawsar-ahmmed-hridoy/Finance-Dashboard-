import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { AuditService } from '../audit/audit.service';

const mockUser: Partial<User> = {
  id: 'uuid-1',
  email: 'test@test.com',
  firstName: 'Test',
  lastName: 'User',
  role: Role.VIEWER,
  isActive: true,
};

const mockQb = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[mockUser], 1]),
  getRawMany: jest.fn().mockResolvedValue([{ role: 'viewer', count: '1' }]),
};

const mockRepo = {
  findOne: jest.fn(),
  create: jest.fn().mockReturnValue(mockUser),
  save: jest.fn().mockResolvedValue(mockUser),
  softDelete: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockAuditService.log.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a new user', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      const result = await service.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'P@ssw0rd!',
      });
      expect(mockRepo.create).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('throws ConflictException when email already exists', async () => {
      mockRepo.findOne.mockResolvedValueOnce(mockUser);
      await expect(
        service.create({
          firstName: 'John',
          lastName: 'Doe',
          email: 'test@test.com',
          password: 'P@ssw0rd!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when user not found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns user when found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(mockUser);
      const result = await service.findOne('uuid-1');
      expect(result).toEqual(mockUser);
    });
  });

  describe('remove', () => {
    it('throws BadRequestException when user tries to delete themselves', async () => {
      mockRepo.findOne.mockResolvedValueOnce(mockUser);
      await expect(service.remove('uuid-1', 'uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
