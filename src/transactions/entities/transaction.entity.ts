import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import {
  TransactionType,
  TransactionCategory,
  TransactionStatus,
} from '../enums/transaction.enum';
import { User } from '../../users/entities/user.entity';

@Entity('transactions')
@Index(['type'])
@Index(['category'])
@Index(['transactionDate'])
@Index(['createdById'])
@Index(['status'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'enum', enum: TransactionCategory })
  category: TransactionCategory;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.COMPLETED,
  })
  status: TransactionStatus;

  @Column({ type: 'date' })
  transactionDate: string;

  @Column({ nullable: true, length: 500 })
  description: string | null;

  @Column({ nullable: true, length: 100 })
  reference: string | null;

  @Column({ nullable: true, length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, (user) => user.transactions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
