/**
 * Seed script — run with:
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/seed.ts
 *
 * Creates default admin, analyst, and viewer accounts plus sample transactions.
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { Role } from '../../common/enums/role.enum';
import {
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from '../../transactions/enums/transaction.enum';

dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'finance_db',
  entities: [User, Transaction, RefreshToken],
  synchronize: true,
});

async function seed() {
  await dataSource.initialize();
  console.log('✅ Database connected');

  const userRepo = dataSource.getRepository(User);
  const txRepo = dataSource.getRepository(Transaction);

  // ── Seed Users ────────────────────────────────────────────────────────────
  const usersData = [
    {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@finance.com',
      password: 'Admin@12345',
      role: Role.ADMIN,
    },
    {
      firstName: 'Alice',
      lastName: 'Analyst',
      email: 'analyst@finance.com',
      password: 'Analyst@12345',
      role: Role.ANALYST,
    },
    {
      firstName: 'Victor',
      lastName: 'Viewer',
      email: 'viewer@finance.com',
      password: 'Viewer@12345',
      role: Role.VIEWER,
    },
  ];

  const savedUsers: User[] = [];
  for (const u of usersData) {
    const existing = await userRepo.findOne({ where: { email: u.email } });
    if (existing) {
      console.log(`⚠️  User ${u.email} already exists, skipping`);
      savedUsers.push(existing);
      continue;
    }
    const user = userRepo.create({
      ...u,
      password: await bcrypt.hash(u.password, 12),
    });
    // Bypass the BeforeInsert hook since we already hashed
    const saved = await userRepo.save(user);
    savedUsers.push(saved);
    console.log(`👤 Created user: ${u.email} (${u.role})`);
  }

  // ── Seed Transactions ─────────────────────────────────────────────────────
  const admin = savedUsers.find((u) => u.role === Role.ADMIN)!;
  const analyst = savedUsers.find((u) => u.role === Role.ANALYST)!;

  const existingTxCount = await txRepo.count();
  if (existingTxCount > 0) {
    console.log('⚠️  Transactions already exist, skipping transaction seed');
  } else {
    const sampleTransactions = generateSampleTransactions(admin.id, analyst.id);
    await txRepo.save(sampleTransactions.map((t) => txRepo.create(t)));
    console.log(`💸 Created ${sampleTransactions.length} sample transactions`);
  }

  await dataSource.destroy();
  console.log('\n🌱 Seed complete!\n');
  console.log('Default credentials:');
  console.log('  Admin    → admin@finance.com   / Admin@12345');
  console.log('  Analyst  → analyst@finance.com / Analyst@12345');
  console.log('  Viewer   → viewer@finance.com  / Viewer@12345');
}

function generateSampleTransactions(adminId: string, analystId: string) {
  const now = new Date();
  const txns = [];

  const incomeCategories = [
    TransactionCategory.SALARY,
    TransactionCategory.FREELANCE,
    TransactionCategory.INVESTMENT,
    TransactionCategory.DIVIDEND,
  ];

  const expenseCategories = [
    TransactionCategory.HOUSING,
    TransactionCategory.FOOD,
    TransactionCategory.TRANSPORT,
    TransactionCategory.UTILITIES,
    TransactionCategory.HEALTHCARE,
    TransactionCategory.ENTERTAINMENT,
    TransactionCategory.SHOPPING,
  ];

  // Generate 6 months of data
  for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
    const month = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const monthStr = month.toISOString().slice(0, 7);

    // Income entries
    txns.push({
      amount: 5000 + Math.random() * 1000,
      type: TransactionType.INCOME,
      category: TransactionCategory.SALARY,
      status: TransactionStatus.COMPLETED,
      transactionDate: `${monthStr}-01`,
      description: 'Monthly salary',
      currency: 'USD',
      createdById: adminId,
    });

    txns.push({
      amount: 800 + Math.random() * 400,
      type: TransactionType.INCOME,
      category: TransactionCategory.FREELANCE,
      status: TransactionStatus.COMPLETED,
      transactionDate: `${monthStr}-15`,
      description: 'Freelance project payment',
      currency: 'USD',
      createdById: analystId,
    });

    // Expense entries
    for (let i = 0; i < 5; i++) {
      const cat = expenseCategories[i % expenseCategories.length];
      const day = String(Math.min(28, i * 5 + 3)).padStart(2, '0');
      txns.push({
        amount: 50 + Math.random() * 500,
        type: TransactionType.EXPENSE,
        category: cat,
        status: TransactionStatus.COMPLETED,
        transactionDate: `${monthStr}-${day}`,
        description: `${cat.replace('_', ' ')} expense`,
        currency: 'USD',
        createdById: i % 2 === 0 ? adminId : analystId,
      });
    }
  }

  return txns;
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
