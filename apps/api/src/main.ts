import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  // ── Security headers ────────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: isProduction,
    crossOriginEmbedderPolicy: false, // required for Socket.IO
  }));

  // ── Cookie parser (for httpOnly JWT cookies) ────────────────────────────────
  app.use(cookieParser());

  // ── Global prefix & CORS ────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1', { exclude: ['/health'] });

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  // ── Pipes & filters ─────────────────────────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.useGlobalFilters(new AllExceptionsFilter());

  // ── WebSocket ───────────────────────────────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // ── Health check (outside /api/v1 prefix) ───────────────────────────────────
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Swagger (development only) ───────────────────────────────────────────────
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('VLA System API')
      .setDescription('VLA Virtual Office & Academy Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('vla_token')
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
    logger.log('Swagger docs: http://localhost:' + (process.env.API_PORT || 3001) + '/api/docs');
  }

  // ── Graceful shutdown ────────────────────────────────────────────────────────
  app.enableShutdownHooks();

  const port = process.env.API_PORT || 3001;
  await app.listen(port);
  logger.log(`VLA API running on port ${port} [${process.env.NODE_ENV}]`);
}

bootstrap();
