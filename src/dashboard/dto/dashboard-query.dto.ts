import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum TrendPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export class DashboardQueryDto {
  @ApiPropertyOptional({
    example: '2024-01-01',
    description:
      'Start of date range for summary (defaults to start of current year)',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: '2024-12-31',
    description: 'End of date range for summary (defaults to today)',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class TrendQueryDto {
  @ApiPropertyOptional({ enum: TrendPeriod, default: TrendPeriod.MONTHLY })
  @IsOptional()
  @IsEnum(TrendPeriod)
  period?: TrendPeriod = TrendPeriod.MONTHLY;

  @ApiPropertyOptional({
    example: '12',
    description: 'Number of periods to return (max 24)',
  })
  @IsOptional()
  periods?: number = 12;

  @ApiPropertyOptional({ description: 'Filter by user ID (Admin only)' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
