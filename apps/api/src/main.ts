import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { LogBuffer } from './core/log-buffer/log-buffer';

async function bootstrap() {
  LogBuffer.init();
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const isProduction = process.env.NODE_ENV === 'production';

  // ── Security headers ────────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://my.zadarma.com', 'https://api.zadarma.com'],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        imgSrc: ["'self'", 'data:', 'https://my.zadarma.com'],
        connectSrc: ["'self'", 'https://my.zadarma.com', 'https://api.zadarma.com', 'wss://my.zadarma.com', 'wss://ws.zadarma.com', 'wss:'],
        mediaSrc: ["'self'", 'blob:', 'https://my.zadarma.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: [],
      },
    } : false,
    crossOriginEmbedderPolicy: false, // required for Socket.IO
  }));

  // ── Cookie parser (for httpOnly JWT cookies) ────────────────────────────────
  app.use(cookieParser());

  // ── Health check — registered as Express middleware before NestJS routing ───
  app.use('/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Global prefix & CORS ────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

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
