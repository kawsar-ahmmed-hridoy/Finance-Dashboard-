import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { Role } from '../../common/enums/role.enum';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ select: false })
  @Exclude()
  password: string;

  @Column({ type: 'enum', enum: Role, default: Role.VIEWER })
  role: Role;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, type: 'timestamptz' })
  lastLoginAt: Date | null;

  @OneToMany(() => Transaction, (transaction) => transaction.createdBy)
  transactions: Transaction[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  @Exclude()
  refreshTokens: RefreshToken[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  @Exclude()
  deletedAt: Date | null;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 12);
    }
  }

  async comparePassword(plainText: string): Promise<boolean> {
    return bcrypt.compare(plainText, this.password);
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
