import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsISO4217CurrencyCode,
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

export class CreateTransactionDto {
  @ApiProperty({ example: 5000.0, description: 'Amount (positive number)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ enum: TransactionType, example: TransactionType.INCOME })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({
    enum: TransactionCategory,
    example: TransactionCategory.SALARY,
  })
  @IsEnum(TransactionCategory)
  category: TransactionCategory;

  @ApiProperty({
    example: '2024-09-01',
    description: 'Transaction date in YYYY-MM-DD format',
  })
  @IsDateString()
  transactionDate: string;

  @ApiPropertyOptional({
    enum: TransactionStatus,
    default: TransactionStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({ example: 'September salary payment', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'REF-20240901-001', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;
}
