import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { UsersModule } from './users/users.module';
import { TransactionsModule } from './transactions/transactions.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { typeOrmConfig } from './config/typeorm.config';
import { throttlerConfig } from './config/throttler.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: typeOrmConfig,
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: throttlerConfig,
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    TransactionsModule,
    DashboardModule,
  ],
  providers: [
    // Apply JWT auth globally
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Apply roles guard globally
    { provide: APP_GUARD, useClass: RolesGuard },
    // Apply rate limiting globally
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  controllers: [HealthController],
})
export class AppModule {}
