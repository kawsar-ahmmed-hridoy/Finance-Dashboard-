import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { PaginatedResult, paginate } from '../common/dto/pagination.dto';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateTransactionDto, user: User): Promise<Transaction> {
    const transaction = this.transactionRepo.create({
      ...dto,
      createdById: user.id,
    });
    const saved = await this.transactionRepo.save(transaction);
    await this.auditService.log({
      actorId: user.id,
      action: 'transaction.created',
      entityType: 'transaction',
      entityId: saved.id,
      details: {
        amount: saved.amount,
        type: saved.type,
        category: saved.category,
      },
    });
    return saved;
  }

  async findAll(
    query: QueryTransactionsDto,
    user: User,
  ): Promise<PaginatedResult<Transaction>> {
    const qb = this.transactionRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.createdBy', 'createdBy')
      .select([
        't',
        'createdBy.id',
        'createdBy.firstName',
        'createdBy.lastName',
        'createdBy.email',
      ]);

    if (user.role !== Role.ADMIN) {
      qb.where('t.createdById = :userId', { userId: user.id });
    } else if (query.createdById) {
      qb.where('t.createdById = :userId', { userId: query.createdById });
    }

    if (query.type) qb.andWhere('t.type = :type', { type: query.type });
    if (query.category)
      qb.andWhere('t.category = :category', { category: query.category });
    if (query.status)
      qb.andWhere('t.status = :status', { status: query.status });
    if (query.dateFrom)
      qb.andWhere('t.transactionDate >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    if (query.dateTo)
      qb.andWhere('t.transactionDate <= :dateTo', { dateTo: query.dateTo });
    if (query.amountMin)
      qb.andWhere('CAST(t.amount AS DECIMAL) >= :amountMin', {
        amountMin: query.amountMin,
      });
    if (query.amountMax)
      qb.andWhere('CAST(t.amount AS DECIMAL) <= :amountMax', {
        amountMax: query.amountMax,
      });
    if (query.search) {
      qb.andWhere(
        '(t.description ILIKE :search OR t.reference ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const allowedSortFields: Record<string, string> = {
      amount: 't.amount',
      transactionDate: 't.transactionDate',
      createdAt: 't.createdAt',
      category: 't.category',
      type: 't.type',
    };
    const sortField =
      allowedSortFields[query.sortBy ?? 'transactionDate'] ??
      't.transactionDate';
    qb.orderBy(sortField, query.sortOrder ?? 'DESC')
      .skip(query.skip)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, query);
  }

  async findOne(id: string, user: User): Promise<Transaction> {
    const transaction = await this.transactionRepo.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction "${id}" not found`);
    }

    this.assertCanAccess(transaction, user);
    return transaction;
  }

  async update(
    id: string,
    dto: UpdateTransactionDto,
    user: User,
  ): Promise<Transaction> {
    const transaction = await this.findOne(id, user);
    this.assertCanModify(transaction, user);
    const previous = {
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      status: transaction.status,
      transactionDate: transaction.transactionDate,
    };
    Object.assign(transaction, dto);
    const saved = await this.transactionRepo.save(transaction);
    await this.auditService.log({
      actorId: user.id,
      action: 'transaction.updated',
      entityType: 'transaction',
      entityId: saved.id,
      details: {
        before: previous,
        after: {
          amount: saved.amount,
          type: saved.type,
          category: saved.category,
          status: saved.status,
          transactionDate: saved.transactionDate,
        },
      },
    });
    return saved;
  }

  async remove(id: string, user: User): Promise<void> {
    const transaction = await this.findOne(id, user);
    this.assertCanModify(transaction, user);
    await this.transactionRepo.softDelete(id);
    await this.auditService.log({
      actorId: user.id,
      action: 'transaction.deleted',
      entityType: 'transaction',
      entityId: id,
    });
  }

  async bulkDelete(ids: string[], user: User): Promise<{ deleted: number }> {
    const qb = this.transactionRepo
      .createQueryBuilder('t')
      .where('t.id IN (:...ids)', { ids });

    if (user.role !== Role.ADMIN) {
      qb.andWhere('t.createdById = :userId', { userId: user.id });
    }

    const transactions = await qb.getMany();
    if (transactions.length === 0) {
      return { deleted: 0 };
    }

    await this.transactionRepo.softDelete(transactions.map((t) => t.id));
    await this.auditService.log({
      actorId: user.id,
      action: 'transaction.bulk_deleted',
      entityType: 'transaction',
      details: {
        ids: transactions.map((t) => t.id),
        deletedCount: transactions.length,
      },
    });
    return { deleted: transactions.length };
  }

  async exportCsv(query: QueryTransactionsDto, user: User): Promise<string> {
    const qb = this.transactionRepo.createQueryBuilder('t');

    if (user.role !== Role.ADMIN) {
      qb.where('t.createdById = :userId', { userId: user.id });
    } else if (query.createdById) {
      qb.where('t.createdById = :userId', { userId: query.createdById });
    }

    if (query.type) qb.andWhere('t.type = :type', { type: query.type });
    if (query.category)
      qb.andWhere('t.category = :category', { category: query.category });
    if (query.status)
      qb.andWhere('t.status = :status', { status: query.status });
    if (query.dateFrom)
      qb.andWhere('t.transactionDate >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    if (query.dateTo)
      qb.andWhere('t.transactionDate <= :dateTo', { dateTo: query.dateTo });
    if (query.amountMin)
      qb.andWhere('CAST(t.amount AS DECIMAL) >= :amountMin', {
        amountMin: query.amountMin,
      });
    if (query.amountMax)
      qb.andWhere('CAST(t.amount AS DECIMAL) <= :amountMax', {
        amountMax: query.amountMax,
      });
    if (query.search) {
      qb.andWhere(
        '(t.description ILIKE :search OR t.reference ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('t.transactionDate', 'DESC').addOrderBy('t.createdAt', 'DESC');

    const rows = await qb.getMany();

    await this.auditService.log({
      actorId: user.id,
      action: 'transaction.exported_csv',
      entityType: 'transaction',
      details: { count: rows.length },
    });

    const headers = [
      'id',
      'amount',
      'currency',
      'type',
      'category',
      'status',
      'transactionDate',
      'description',
      'reference',
      'createdById',
      'createdAt',
      'updatedAt',
    ];

    const lines = rows.map((row) =>
      [
        row.id,
        row.amount,
        row.currency,
        row.type,
        row.category,
        row.status,
        row.transactionDate,
        row.description ?? '',
        row.reference ?? '',
        row.createdById,
        row.createdAt?.toISOString?.() ?? '',
        row.updatedAt?.toISOString?.() ?? '',
      ]
        .map((value) => this.escapeCsv(value))
        .join(','),
    );

    return [headers.join(','), ...lines].join('\n');
  }

  private escapeCsv(value: unknown): string {
    const normalized =
      typeof value === 'string'
        ? value
        : value == null
          ? ''
          : JSON.stringify(value);
    const escaped = normalized.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  private assertCanAccess(transaction: Transaction, user: User): void {
    if (user.role === Role.ADMIN) return;
    if (transaction.createdById !== user.id) {
      throw new ForbiddenException(
        'You do not have access to this transaction',
      );
    }
  }

  private assertCanModify(transaction: Transaction, user: User): void {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.ANALYST && transaction.createdById === user.id)
      return;
    if (user.role === Role.VIEWER) {
      throw new ForbiddenException('Viewers cannot modify transactions');
    }
    if (transaction.createdById !== user.id) {
      throw new ForbiddenException('You can only modify your own transactions');
    }
  }
}
