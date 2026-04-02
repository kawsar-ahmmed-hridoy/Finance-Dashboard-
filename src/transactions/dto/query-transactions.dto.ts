import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from '../enums/transaction.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';

export type SortOrder = 'ASC' | 'DESC';
export type SortField =
  | 'amount'
  | 'transactionDate'
  | 'createdAt'
  | 'category'
  | 'type';

export class QueryTransactionsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ enum: TransactionCategory })
  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({
    example: '2024-01-01',
    description: 'Start date (inclusive)',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: '2024-12-31',
    description: 'End date (inclusive)',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ example: 100.0, description: 'Minimum amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amountMin?: number;

  @ApiPropertyOptional({ example: 10000.0, description: 'Maximum amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amountMax?: number;

  @ApiPropertyOptional({
    example: 'salary',
    description: 'Search in description or reference',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'Filter by creator user ID (Admin only)',
  })
  @IsOptional()
  @IsUUID()
  createdById?: string;

  @ApiPropertyOptional({
    example: 'transactionDate',
    enum: ['amount', 'transactionDate', 'createdAt', 'category', 'type'],
    default: 'transactionDate',
  })
  @IsOptional()
  @IsString()
  sortBy?: SortField = 'transactionDate';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: SortOrder = 'DESC';
}
