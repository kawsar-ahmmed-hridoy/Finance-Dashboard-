import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '../../common/enums/role.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryUsersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'john' })
  @IsOptional()
  @IsString()
  search?: string;
}
