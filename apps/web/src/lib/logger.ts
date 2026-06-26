type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: 'color: #888',
  info: 'color: #4ECDC4',
  warn: 'color: #FF8C42',
  error: 'color: #FF6B6B; font-weight: bold',
}

class Logger {
  private readonly level: LogLevel
  private readonly context: string

  constructor(context: string, level: LogLevel = 'info') {
    this.context = context
    this.level = level
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level]
  }

  private emit(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return

    const ts = new Date().toISOString().substring(11, 23)
    const prefix = `%c${ts} ${level.toUpperCase().padEnd(5)} [${this.context}]`
    const style = LEVEL_COLORS[level]

    if (data && Object.keys(data).length > 0) {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        `${prefix} ${message}`,
        style,
        data,
      )
    } else {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        `${prefix} ${message}`,
        style,
      )
    }
  }

  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`, this.level)
  }

  debug(message: string, data?: Record<string, unknown>) { this.emit('debug', message, data) }
  info(message: string, data?: Record<string, unknown>) { this.emit('info', message, data) }
  warn(message: string, data?: Record<string, unknown>) { this.emit('warn', message, data) }
  error(message: string, data?: Record<string, unknown>) { this.emit('error', message, data) }

  logApiCall(method: string, path: string, status: number, latencyMs: number) {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
    this.emit(level, `${method} ${path} → ${status} (${Math.round(latencyMs)}ms)`)
  }

  logUserAction(action: string, data?: Record<string, unknown>) {
    this.info(`User: ${action}`, data)
  }

  logGameEvent(event: string, data?: Record<string, unknown>) {
    this.info(`Game: ${event}`, data)
  }

  logLlmCall(label: string, latencyMs: number, status: string) {
    this.info(`LLM: ${label} → ${status} (${Math.round(latencyMs)}ms)`)
  }
}

const envLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) ?? 'info'
export const logger = new Logger('VI', envLevel)

export async function fetchApi<T>(
  path: string,
  init?: RequestInit,
): Promise<{ success: boolean; data?: T; error?: string }> {
  const apiLogger = logger.child('API')
  const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'
  const url = `${API_BASE}${path}`
  const method = init?.method ?? 'GET'
  const start = performance.now()

  apiLogger.debug(`${method} ${path}`)

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
    const latencyMs = performance.now() - start
    const json = await res.json() as { success: boolean; data?: T; error?: string }

    apiLogger.logApiCall(method, path, res.status, latencyMs)

    if (!res.ok || !json.success) {
      apiLogger.error(`${method} ${path} failed: ${json.error ?? res.statusText}`)
      throw new Error(json.error ?? `API ${res.status}`)
    }
    return json
  } catch (err) {
    const latencyMs = performance.now() - start
    apiLogger.error(`${method} ${path} error (${Math.round(latencyMs)}ms)`, {
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
