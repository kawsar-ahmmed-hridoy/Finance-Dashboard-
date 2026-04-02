import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import {
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from './enums/transaction.enum';

const adminUser: Partial<User> = { id: 'admin-id', role: Role.ADMIN };
const analystUser: Partial<User> = { id: 'analyst-id', role: Role.ANALYST };
const viewerUser: Partial<User> = { id: 'viewer-id', role: Role.VIEWER };

const mockTx: Partial<Transaction> = {
  id: 'tx-uuid-1',
  amount: 100,
  type: TransactionType.INCOME,
  category: TransactionCategory.SALARY,
  status: TransactionStatus.COMPLETED,
  transactionDate: '2024-09-01',
  createdById: 'analyst-id',
};

const mockQb = {
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[mockTx], 1]),
  getMany: jest.fn().mockResolvedValue([mockTx]),
};

const mockRepo = {
  create: jest.fn().mockReturnValue(mockTx),
  save: jest.fn().mockResolvedValue(mockTx),
  findOne: jest.fn().mockResolvedValue(mockTx),
  softDelete: jest.fn().mockResolvedValue(undefined),
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
};

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: getRepositoryToken(Transaction), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    jest.clearAllMocks();
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.getManyAndCount.mockResolvedValue([[mockTx], 1]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a transaction as analyst', async () => {
      mockRepo.save.mockResolvedValueOnce(mockTx);
      const dto = {
        amount: 100,
        type: TransactionType.INCOME,
        category: TransactionCategory.SALARY,
        transactionDate: '2024-09-01',
      };
      const result = await service.create(dto, analystUser as User);
      expect(mockRepo.create).toHaveBeenCalled();
      expect(result).toEqual(mockTx);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when transaction does not exist', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.findOne('bad-id', adminUser as User),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when viewer accesses another user tx', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        ...mockTx,
        createdById: 'someone-else',
      });
      await expect(
        service.findOne('tx-uuid-1', viewerUser as User),
      ).rejects.toThrow(ForbiddenException);
    });

    it('admin can access any transaction', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        ...mockTx,
        createdById: 'someone-else',
      });
      const result = await service.findOne('tx-uuid-1', adminUser as User);
      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when viewer tries to delete', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        ...mockTx,
        createdById: 'viewer-id',
      });
      await expect(
        service.remove('tx-uuid-1', viewerUser as User),
      ).rejects.toThrow(ForbiddenException);
    });

    it('analyst can delete own transaction', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        ...mockTx,
        createdById: 'analyst-id',
      });
      await expect(
        service.remove('tx-uuid-1', analystUser as User),
      ).resolves.not.toThrow();
    });
  });
});
