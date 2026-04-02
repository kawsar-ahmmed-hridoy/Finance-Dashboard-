import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Transactions')
@ApiBearerAuth('access-token')
@Controller({ path: 'transactions', version: '1' })
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @Roles(Role.ANALYST, Role.ADMIN)
  @ApiOperation({
    summary: 'Create a new transaction [Analyst, Admin]',
    description: 'Viewers cannot create transactions.',
  })
  @ApiResponse({ status: 201, description: 'Transaction created' })
  create(@Body() dto: CreateTransactionDto, @CurrentUser() user: User) {
    return this.transactionsService.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'List transactions with filters & pagination',
    description: 'Admins see all; Analysts & Viewers see only their own.',
  })
  findAll(@Query() query: QueryTransactionsDto, @CurrentUser() user: User) {
    return this.transactionsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.transactionsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.ANALYST, Role.ADMIN)
  @ApiOperation({
    summary: 'Update a transaction [Analyst (own), Admin (any)]',
  })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
    @CurrentUser() user: User,
  ) {
    return this.transactionsService.update(id, dto, user);
  }

  @Delete('bulk')
  @Roles(Role.ANALYST, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk soft-delete transactions [Analyst (own), Admin (any)]',
  })
  @ApiBody({
    schema: {
      properties: { ids: { type: 'array', items: { type: 'string' } } },
    },
  })
  bulkDelete(@Body('ids') ids: string[], @CurrentUser() user: User) {
    return this.transactionsService.bulkDelete(ids, user);
  }

  @Delete(':id')
  @Roles(Role.ANALYST, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a transaction [Analyst (own), Admin (any)]',
  })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.transactionsService.remove(id, user);
  }
}
