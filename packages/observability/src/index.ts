export function createTraceId(): string {
  return crypto.randomUUID();
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export interface AuditContext {
  sessionId: string;
  traceId: string;
  agentType: string;
  createdAt: string;
}

export function createAuditContext(
  sessionId: string,
  traceId: string,
  agentType: string,
): AuditContext {
  return {
    sessionId,
    traceId,
    agentType,
    createdAt: new Date().toISOString(),
  };
}