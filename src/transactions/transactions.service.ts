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

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  async create(dto: CreateTransactionDto, user: User): Promise<Transaction> {
    const transaction = this.transactionRepo.create({
      ...dto,
      createdById: user.id,
    });
    return this.transactionRepo.save(transaction);
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

    // Non-admins only see their own records
    if (user.role !== Role.ADMIN) {
      qb.where('t.createdById = :userId', { userId: user.id });
    } else if (query.createdById) {
      qb.where('t.createdById = :userId', { userId: query.createdById });
    }

    // Filters
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

    // Sorting & Pagination
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
    Object.assign(transaction, dto);
    return this.transactionRepo.save(transaction);
  }

  async remove(id: string, user: User): Promise<void> {
    const transaction = await this.findOne(id, user);
    this.assertCanModify(transaction, user);
    await this.transactionRepo.softDelete(id);
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
    return { deleted: transactions.length };
  }

  // ─── Access control helpers ───────────────────────────────────────────────

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
