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
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { User } from './entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new user [Admin]' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all users with filters & pagination [Admin]' })
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  getMe(@CurrentUser() user: User) {
    return user;
  }

  @Get('stats')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get user statistics by role [Admin]' })
  getStats() {
    return this.usersService.getStats();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get a user by ID [Admin]' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (name only)' })
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateUserDto) {
    // Non-admins can only update their own name
    const { firstName, lastName } = dto;
    return this.usersService.update(user.id, { firstName, lastName });
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a user [Admin]' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a user [Admin]' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') requesterId: string,
  ) {
    return this.usersService.remove(id, requesterId);
  }
}
