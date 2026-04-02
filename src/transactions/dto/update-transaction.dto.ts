import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from '../enums/transaction.enum';

export class UpdateTransactionDto {
  @ApiPropertyOptional({ example: 6000.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount?: number;

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

  @ApiPropertyOptional({ example: '2024-09-15' })
  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}
