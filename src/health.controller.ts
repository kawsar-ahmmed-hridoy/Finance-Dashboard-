import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check endpoint' })
  async check() {
    let dbStatus = 'ok';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        api: 'ok',
      },
      version: process.env.npm_package_version ?? '1.0.0',
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}
