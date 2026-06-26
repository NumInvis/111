import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { AppLogger, RequestLoggingMiddleware } from './logger.module';
import { AllExceptionsFilter } from './exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(AppLogger);
  app.useLogger(logger);

  app.enableCors({
    origin: ['http://localhost:16543', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  });

  app.setGlobalPrefix('api');
  app.use(new RequestLoggingMiddleware(logger).use.bind(new RequestLoggingMiddleware(logger)));
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`变分无限 API 启动于 :${port}`, { component: 'Bootstrap' });
}
bootstrap();
