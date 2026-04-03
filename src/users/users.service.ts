import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { PaginatedResult, paginate } from '../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const user = this.usersRepo.create({
      ...dto,
      email: dto.email.toLowerCase(),
    });
    const saved = await this.usersRepo.save(user);
    await this.auditService.log({
      action: 'user.created',
      entityType: 'user',
      entityId: saved.id,
      details: { role: saved.role, isActive: saved.isActive },
    });
    return saved;
  }

  async findAll(query: QueryUsersDto): Promise<PaginatedResult<User>> {
    const qb = this.usersRepo.createQueryBuilder('user');

    if (query.search) {
      qb.where(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.role !== undefined)
      qb.andWhere('user.role = :role', { role: query.role });
    if (query.isActive !== undefined)
      qb.andWhere('user.isActive = :isActive', { isActive: query.isActive });

    qb.orderBy('user.createdAt', 'DESC').skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, query);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID "${id}" not found`);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    const previous = { role: user.role, isActive: user.isActive };
    Object.assign(user, dto);
    const saved = await this.usersRepo.save(user);
    await this.auditService.log({
      action: 'user.updated',
      entityType: 'user',
      entityId: saved.id,
      details: {
        before: previous,
        after: { role: saved.role, isActive: saved.isActive },
      },
    });
    return saved;
  }

  async remove(id: string, requesterId: string): Promise<void> {
    if (id === requesterId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const user = await this.findOne(id);
    await this.usersRepo.softDelete(user.id);
    await this.auditService.log({
      actorId: requesterId,
      action: 'user.deleted',
      entityType: 'user',
      entityId: user.id,
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepo.update(id, { lastLoginAt: new Date() });
  }

  async getStats(): Promise<Record<string, number>> {
    const result = await this.usersRepo
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany<{ role: string; count: string }>();

    const stats: Record<string, number> = { total: 0 };
    for (const row of result) {
      stats[row.role] = Number(row.count);
      stats.total += Number(row.count);
    }
    return stats;
  }
}
