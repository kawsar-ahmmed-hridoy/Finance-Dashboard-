import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto, TrendQueryDto } from './dto/dashboard-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Full dashboard overview — summary, categories, recent activity, monthly comparison',
    description: 'Admins see system-wide data; others see only their own.',
  })
  getOverview(@Query() query: DashboardQueryDto, @CurrentUser() user: User) {
    return this.dashboardService.getOverview(query, user);
  }

  @Get('summary')
  @ApiOperation({
    summary:
      'Financial summary — income, expenses, net balance for a date range',
  })
  getSummary(@Query() query: DashboardQueryDto, @CurrentUser() user: User) {
    return this.dashboardService.getSummary(query, user);
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Category-wise breakdown of income and expenses',
  })
  getCategoryBreakdown(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.dashboardService.getCategoryBreakdown(query, user);
  }

  @Get('trends')
  @ApiOperation({
    summary:
      'Income vs expense trends over time (weekly / monthly / quarterly / yearly)',
  })
  getTrends(@Query() query: TrendQueryDto, @CurrentUser() user: User) {
    return this.dashboardService.getTrends(query, user);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Most recent 10 transactions' })
  getRecentActivity(@CurrentUser() user: User) {
    return this.dashboardService.getRecentActivity(10, user);
  }

  @Get('monthly-comparison')
  @ApiOperation({
    summary: 'Compare current month vs previous month with % change',
  })
  getMonthlyComparison(@CurrentUser() user: User) {
    return this.dashboardService.getMonthlyComparison(user);
  }

  @Get('net-worth-history')
  @Roles(Role.ANALYST, Role.ADMIN)
  @ApiOperation({
    summary: 'Net worth history over past N months [Analyst, Admin]',
  })
  getNetWorthHistory(
    @Query('months') months: number = 12,
    @CurrentUser() user: User,
  ) {
    return this.dashboardService.getNetWorthHistory(months, user);
  }
}
