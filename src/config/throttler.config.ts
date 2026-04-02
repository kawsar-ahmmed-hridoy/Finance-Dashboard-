import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig = (
  configService: ConfigService,
): ThrottlerModuleOptions => ({
  throttlers: [
    {
      name: 'short',
      ttl: 1000,
      limit: 10,
    },
    {
      name: 'medium',
      ttl: configService.get<number>('THROTTLE_TTL', 60000),
      limit: configService.get<number>('THROTTLE_LIMIT', 100),
    },
  ],
});
