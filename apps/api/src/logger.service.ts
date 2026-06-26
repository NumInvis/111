import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LogContext {
  component?: string;
  sessionId?: string;
  traceId?: string;
  userId?: string;
  durationMs?: number;
  extra?: Record<string, unknown>;
}

const LEVEL_PRIORITY: Record<string, number> = {
  verbose: 0,
  debug: 1,
  log: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

@Injectable()
export class AppLogger implements LoggerService {
  private readonly level: number;
  private readonly format: 'json' | 'pretty';
  private readonly maxBodyLen: number;

  constructor(private readonly config: ConfigService) {
    const lvl = this.config.get<string>('LOG_LEVEL', 'log');
    this.level = LEVEL_PRIORITY[lvl] ?? 2;
    this.format = this.config.get<string>('LOG_FORMAT', 'pretty') as 'json' | 'pretty';
    this.maxBodyLen = this.config.get<number>('LOG_REQUEST_BODY_MAX_LEN', 2000);
  }

  private shouldLog(level: string): boolean {
    return (LEVEL_PRIORITY[level] ?? 2) >= this.level;
  }

  private emit(level: string, message: string, ctx?: LogContext) {
    if (!this.shouldLog(level)) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.sanitizeContext(ctx),
    };

    if (this.format === 'json') {
      process.stdout.write(JSON.stringify(entry) + '\n');
    } else {
      const ts = entry.timestamp.substring(11, 23);
      const comp = ctx?.component ? `[${ctx.component}]` : '';
      const trace = ctx?.traceId ? ` ${ctx.traceId.substring(0, 8)}` : '';
      const dur = ctx?.durationMs ? ` ${ctx.durationMs}ms` : '';
      const extras = ctx?.extra ? ` ${JSON.stringify(this.redact(ctx.extra))}` : '';
      const color = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : level === 'debug' ? '\x1b[90m' : '';
      const reset = color ? '\x1b[0m' : '';
      process.stdout.write(`${color}${ts} ${level.toUpperCase().padEnd(5)}${reset} ${comp}${trace}${dur} ${message}${extras}\n`);
    }
  }

  private sanitizeContext(ctx?: LogContext): Record<string, unknown> | undefined {
    if (!ctx) return undefined;
    const result: Record<string, unknown> = {};
    if (ctx.component) result.component = ctx.component;
    if (ctx.sessionId) result.sessionId = ctx.sessionId;
    if (ctx.traceId) result.traceId = ctx.traceId;
    if (ctx.userId) result.userId = ctx.userId;
    if (ctx.durationMs !== undefined) result.durationMs = ctx.durationMs;
    if (ctx.extra) result.extra = this.redact(ctx.extra);
    return result;
  }

  private redact(obj: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};
    const sensitiveKeys = ['password', 'token', 'apiKey', 'api_key', 'secret', 'authorization', 'cookie'];
    for (const [k, v] of Object.entries(obj)) {
      if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
        redacted[k] = '[REDACTED]';
      } else if (typeof v === 'string' && v.length > this.maxBodyLen) {
        redacted[k] = v.substring(0, this.maxBodyLen) + '...[truncated]';
      } else {
        redacted[k] = v;
      }
    }
    return redacted;
  }

  log(message: string, ctx?: LogContext) { this.emit('log', message, ctx); }
  error(message: string, ctx?: LogContext) { this.emit('error', message, ctx); }
  warn(message: string, ctx?: LogContext) { this.emit('warn', message, ctx); }
  debug(message: string, ctx?: LogContext) { this.emit('debug', message, ctx); }
  verbose(message: string, ctx?: LogContext) { this.emit('verbose', message, ctx); }
  fatal(message: string, ctx?: LogContext) { this.emit('fatal', message, ctx); }

  logRequest(method: string, path: string, status: number, latencyMs: number, traceId: string, body?: unknown) {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'log';
    const bodyStr = body ? ` body=${JSON.stringify(this.redact(body as Record<string, unknown>)).substring(0, 200)}` : '';
    this.emit(level, `${method} ${path} ${status}`, {
      component: 'HTTP',
      traceId,
      durationMs: Math.round(latencyMs),
      extra: { method, path, status, body: bodyStr },
    });
  }

  logLlmCall(opts: { sessionId: string; traceId: string; model: string; promptLen: number; responseLen: number; latencyMs: number; status: string }) {
    this.log('LLM call', {
      component: 'LLM',
      sessionId: opts.sessionId,
      traceId: opts.traceId,
      durationMs: Math.round(opts.latencyMs),
      extra: {
        model: opts.model,
        promptChars: opts.promptLen,
        responseChars: opts.responseLen,
        status: opts.status,
      },
    });
  }

  logGameEvent(sessionId: string, event: string, details?: Record<string, unknown>) {
    this.log(`Game: ${event}`, {
      component: 'Game',
      sessionId,
      extra: details,
    });
  }
}
