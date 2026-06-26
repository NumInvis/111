import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppLogger } from './logger.service';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLogger) {}

  use(req: Request, res: Response, next: NextFunction) {
    const traceId = randomUUID();
    const start = performance.now();
    const { method, path: urlPath, body } = req;

    (req as unknown as Record<string, unknown>)['traceId'] = traceId;

    if (urlPath === '/api/health' || urlPath === '/api' || urlPath === '/') {
      return next();
    }

    res.on('finish', () => {
      const latencyMs = performance.now() - start;
      this.logger.logRequest(method, urlPath, res.statusCode, latencyMs, traceId, body);
    });

    next();
  }
}
