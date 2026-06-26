import { Global, Module } from '@nestjs/common';
import { AppLogger } from './logger.service';
import { RequestLoggingMiddleware } from './logger.middleware';

@Global()
@Module({
  providers: [AppLogger],
  exports: [AppLogger],
})
export class LoggerModule {}

export { AppLogger, RequestLoggingMiddleware };
