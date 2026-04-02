import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_tokens')
@Index(['token'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  token: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: false })
  isRevoked: boolean;

  @Column({ nullable: true, length: 45 })
  ipAddress: string | null;

  @Column({ nullable: true, length: 500 })
  userAgent: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  get isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  get isValid(): boolean {
    return !this.isRevoked && !this.isExpired;
  }
}
