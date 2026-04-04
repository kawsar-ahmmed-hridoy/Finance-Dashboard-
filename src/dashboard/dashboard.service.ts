import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import {
  TransactionStatus,
  TransactionType,
} from '../transactions/enums/transaction.enum';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import {
  DashboardQueryDto,
  TrendPeriod,
  TrendQueryDto,
} from './dto/dashboard-query.dto';

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactionCount: number;
  averageTransactionAmount: number;
  period: { from: string; to: string };
}

export interface CategoryBreakdown {
  category: string;
  type: string;
  total: number;
  count: number;
  percentage: number;
}

export interface TrendDataPoint {
  period: string;
  income: number;
  expenses: number;
  net: number;
  count: number;
}

export interface RecentActivity {
  id: string;
  amount: number;
  type: string;
  category: string;
  description: string | null;
  transactionDate: string;
  createdAt: Date;
  createdBy: { id: string; firstName: string; lastName: string };
}

export interface TopCategory {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface DashboardOverview {
  summary: FinancialSummary;
  categoryBreakdown: CategoryBreakdown[];
  topIncomeCategories: TopCategory[];
  topExpenseCategories: TopCategory[];
  recentActivity: RecentActivity[];
  monthlyComparison: {
    currentMonth: FinancialSummary;
    previousMonth: FinancialSummary;
    incomeChange: number;
    expenseChange: number;
    netChange: number;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  async getOverview(
    query: DashboardQueryDto,
    user: User,
  ): Promise<DashboardOverview> {
    const { dateFrom, dateTo } = this.resolveDateRange(query);

    const [summary, categoryBreakdown, recentActivity, monthlyComparison] =
      await Promise.all([
        this.getSummary({ dateFrom, dateTo }, user),
        this.getCategoryBreakdown({ dateFrom, dateTo }, user),
        this.getRecentActivity(10, user),
        this.getMonthlyComparison(user),
      ]);

    const topIncomeCategories = categoryBreakdown
      .filter((c) => c.type === (TransactionType.INCOME as string))
      .slice(0, 5)
      .map(({ category, total, count, percentage }) => ({
        category,
        total,
        count,
        percentage,
      }));

    const topExpenseCategories = categoryBreakdown
      .filter((c) => c.type === (TransactionType.EXPENSE as string))
      .slice(0, 5)
      .map(({ category, total, count, percentage }) => ({
        category,
        total,
        count,
        percentage,
      }));

    return {
      summary,
      categoryBreakdown,
      topIncomeCategories,
      topExpenseCategories,
      recentActivity,
      monthlyComparison,
    };
  }

  async getSummary(
    query: DashboardQueryDto,
    user: User,
  ): Promise<FinancialSummary> {
    const { dateFrom, dateTo } = this.resolveDateRange(query);
    const qb = this.buildBaseQuery(user)
      .andWhere('t.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('t.transactionDate BETWEEN :from AND :to', {
        from: dateFrom,
        to: dateTo,
      });

    const rows = await qb
      .select('t.type', 'type')
      .addSelect('SUM(CAST(t.amount AS DECIMAL))', 'total')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.type')
      .getRawMany<{ type: string; total: string; count: string }>();

    let totalIncome = 0;
    let totalExpenses = 0;
    let transactionCount = 0;
    let totalAmount = 0;

    for (const row of rows) {
      const amount = parseFloat(row.total);
      const count = parseInt(row.count, 10);
      if (row.type === (TransactionType.INCOME as string)) {
        totalIncome = amount;
      } else if (row.type === (TransactionType.EXPENSE as string)) {
        totalExpenses = amount;
      }
      transactionCount += count;
      totalAmount += amount;
    }

    return {
      totalIncome: this.round(totalIncome),
      totalExpenses: this.round(totalExpenses),
      netBalance: this.round(totalIncome - totalExpenses),
      transactionCount,
      averageTransactionAmount:
        transactionCount > 0 ? this.round(totalAmount / transactionCount) : 0,
      period: { from: dateFrom, to: dateTo },
    };
  }

  async getCategoryBreakdown(
    query: DashboardQueryDto,
    user: User,
  ): Promise<CategoryBreakdown[]> {
    const { dateFrom, dateTo } = this.resolveDateRange(query);

    const rows = await this.buildBaseQuery(user)
      .andWhere('t.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('t.transactionDate BETWEEN :from AND :to', {
        from: dateFrom,
        to: dateTo,
      })
      .select('t.category', 'category')
      .addSelect('t.type', 'type')
      .addSelect('SUM(CAST(t.amount AS DECIMAL))', 'total')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.category, t.type')
      .orderBy('total', 'DESC')
      .getRawMany<{
        category: string;
        type: string;
        total: string;
        count: string;
      }>();

    const typeTotals: Record<string, number> = {};
    for (const row of rows) {
      typeTotals[row.type] =
        (typeTotals[row.type] ?? 0) + parseFloat(row.total);
    }

    return rows.map((row) => ({
      category: row.category,
      type: row.type,
      total: this.round(parseFloat(row.total)),
      count: parseInt(row.count, 10),
      percentage:
        typeTotals[row.type] > 0
          ? this.round((parseFloat(row.total) / typeTotals[row.type]) * 100)
          : 0,
    }));
  }

  async getTrends(query: TrendQueryDto, user: User): Promise<TrendDataPoint[]> {
    const period = query.period ?? TrendPeriod.MONTHLY;
    const numPeriods = Math.min(Number(query.periods ?? 12), 24);

    let truncFn: string;
    let intervalUnit: string;

    switch (period) {
      case TrendPeriod.WEEKLY:
        truncFn = 'week';
        intervalUnit = 'weeks';
        break;
      case TrendPeriod.QUARTERLY:
        truncFn = 'quarter';
        intervalUnit = 'months';
        break;
      case TrendPeriod.YEARLY:
        truncFn = 'year';
        intervalUnit = 'years';
        break;
      default:
        truncFn = 'month';
        intervalUnit = 'months';
    }

    const multiplier =
      period === TrendPeriod.QUARTERLY ? numPeriods * 3 : numPeriods;

    const qb = this.buildBaseQuery(user)
      .andWhere('t.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere(
        `t.transactionDate >= DATE_TRUNC('${truncFn}', NOW() - INTERVAL '${multiplier} ${intervalUnit}')`,
      )
      .select(
        `DATE_TRUNC('${truncFn}', t.transactionDate::timestamp)`,
        'period',
      )
      .addSelect('t.type', 'type')
      .addSelect('SUM(CAST(t.amount AS DECIMAL))', 'total')
      .addSelect('COUNT(*)', 'count')
      .groupBy(`DATE_TRUNC('${truncFn}', t.transactionDate::timestamp), t.type`)
      .orderBy('period', 'ASC');

    if (query.userId && user.role === Role.ADMIN) {
      qb.andWhere('t.createdById = :filterUserId', {
        filterUserId: query.userId,
      });
    }

    const rows = await qb.getRawMany<{
      period: Date;
      type: string;
      total: string;
      count: string;
    }>();

    const periodMap = new Map<string, TrendDataPoint>();
    for (const row of rows) {
      const key = row.period.toISOString().split('T')[0];
      if (!periodMap.has(key)) {
        periodMap.set(key, {
          period: key,
          income: 0,
          expenses: 0,
          net: 0,
          count: 0,
        });
      }
      const entry = periodMap.get(key)!;
      const amount = parseFloat(row.total);
      const count = parseInt(row.count, 10);
      if (row.type === (TransactionType.INCOME as string)) {
        entry.income = this.round(amount);
      } else if (row.type === (TransactionType.EXPENSE as string)) {
        entry.expenses = this.round(amount);
      }
      entry.count += count;
      entry.net = this.round(entry.income - entry.expenses);
    }

    return Array.from(periodMap.values());
  }

  async getRecentActivity(limit = 10, user: User): Promise<RecentActivity[]> {
    const qb = this.buildBaseQuery(user)
      .leftJoinAndSelect('t.createdBy', 'createdBy')
      .orderBy('t.createdAt', 'DESC')
      .take(Math.min(limit, 50));

    const transactions = await qb.getMany();
    return transactions.map((t) => ({
      id: t.id,
      amount: parseFloat(t.amount as unknown as string),
      type: t.type,
      category: t.category,
      description: t.description,
      transactionDate: t.transactionDate,
      createdAt: t.createdAt,
      createdBy: {
        id: t.createdBy.id,
        firstName: t.createdBy.firstName,
        lastName: t.createdBy.lastName,
      },
    }));
  }

  async getMonthlyComparison(
    user: User,
  ): Promise<DashboardOverview['monthlyComparison']> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const thisMonthEnd = now.toISOString().split('T')[0];

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStart = prevMonthDate.toISOString().split('T')[0];
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      .toISOString()
      .split('T')[0];

    const [currentMonth, previousMonth] = await Promise.all([
      this.getSummary({ dateFrom: thisMonthStart, dateTo: thisMonthEnd }, user),
      this.getSummary({ dateFrom: prevMonthStart, dateTo: prevMonthEnd }, user),
    ]);

    const pctChange = (curr: number, prev: number): number => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return this.round(((curr - prev) / prev) * 100);
    };

    return {
      currentMonth,
      previousMonth,
      incomeChange: pctChange(
        currentMonth.totalIncome,
        previousMonth.totalIncome,
      ),
      expenseChange: pctChange(
        currentMonth.totalExpenses,
        previousMonth.totalExpenses,
      ),
      netChange: pctChange(currentMonth.netBalance, previousMonth.netBalance),
    };
  }

  async getNetWorthHistory(
    months: number,
    user: User,
  ): Promise<TrendDataPoint[]> {
    return this.getTrends(
      { period: TrendPeriod.MONTHLY, periods: months },
      user,
    );
  }

  private buildBaseQuery(user: User) {
    const qb = this.transactionRepo.createQueryBuilder('t');
    if (user.role !== Role.ADMIN) {
      qb.where('t.createdById = :userId', { userId: user.id });
    }
    return qb;
  }

  private resolveDateRange(query: DashboardQueryDto): {
    dateFrom: string;
    dateTo: string;
  } {
    const now = new Date();
    const dateFrom =
      query.dateFrom ??
      new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const dateTo = query.dateTo ?? now.toISOString().split('T')[0];
    return { dateFrom, dateTo };
  }

  private round(value: number, decimals = 2): number {
    return Math.round(value * 10 ** decimals) / 10 ** decimals;
  }
}
