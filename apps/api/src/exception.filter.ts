import { Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { AppLogger } from './logger.service';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  constructor(private readonly logger: AppLogger) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const traceId = (request as unknown as Record<string, unknown>)['traceId'] as string ?? 'unknown';

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(`Exception: ${message}`, {
      component: 'Exception',
      traceId,
      extra: {
        status,
        path: request.path,
        method: request.method,
        stack: stack?.split('\n').slice(0, 5).join('\n'),
      },
    });

    response.status(status).json({
      success: false,
      error: message,
      traceId,
      timestamp: new Date().toISOString(),
    });
  }
}
