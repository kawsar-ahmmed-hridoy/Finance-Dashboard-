import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import type { Application } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: isProduction
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const appName = configService.get<string>('APP_NAME', 'Finance API');
  const isDevelopment =
    (configService.get<string>('NODE_ENV') ?? 'development') === 'development';
  const swaggerEnabled =
    isDevelopment && configService.get<string>('SWAGGER_ENABLED') === 'true';
  const corsOrigins = (configService.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  const expressApp = app
    .getHttpAdapter()
    .getInstance() as unknown as Application;
  expressApp.set(
    'trust proxy',
    configService.get<string>('TRUST_PROXY', 'false') === 'true',
  );

  expressApp.set('query parser', 'simple');
  expressApp.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
      hsts: isProduction,
    }),
  );
  app.use(compression());
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: false, limit: '100kb' }));

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: corsOrigins.length > 0,
    maxAge: 86400,
    optionsSuccessStatus: 204,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(appName)
      .setDescription(
        'Finance Dashboard Backend API — Role-based access control, financial records, analytics.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('Auth', 'Authentication & token management')
      .addTag('Users', 'User management (Admin only)')
      .addTag('Transactions', 'Financial records management')
      .addTag('Dashboard', 'Summary analytics & insights')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      deepScanRoutes: true,
    });
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);
  console.log(`\n${appName} is running on: http://localhost:${port}/api`);
  if (swaggerEnabled) {
    console.log(`Swagger docs at: http://localhost:${port}/api/docs\n`);
  }
}

void bootstrap();
