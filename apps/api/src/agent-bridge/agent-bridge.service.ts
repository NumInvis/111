import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface AgentCallOptions {
  timeoutMs?: number;
}

@Injectable()
export class AgentBridgeService {
  private readonly logger = new Logger(AgentBridgeService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('AGENT_SERVICE_URL', 'http://localhost:8000/api/agent');
  }

  private async callAgent<T>(path: string, body: Record<string, unknown>, options?: AgentCallOptions): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const timeoutMs = options?.timeoutMs ?? 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Agent Service call to ${path} failed with status ${response.status}: ${errorText}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Agent Service call to ${path} failed: ${message}`);
    }
  }

  async generateWorldCandidate(preferences: {
    theme: string;
    scale: string;
    tone: string;
    seed?: number;
    mode: string;
  }): Promise<Record<string, unknown>> {
    this.logger.log('Requesting world generation candidate from Agent Service');
    return this.callAgent<Record<string, unknown>>('/world/generate', preferences, { timeoutMs: 120000 });
  }

  async generateNpcDialogueCandidate(request: {
    sessionId: string;
    npcId: string;
    playerInput: string;
    currentLocationId?: string;
    npcContext?: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    this.logger.log(`Requesting NPC dialogue candidate for NPC ${request.npcId} from Agent Service`);
    return this.callAgent<Record<string, unknown>>('/npc/dialogue', request);
  }

  async generateEventCandidate(request: {
    sessionId: string;
    currentLocationId: string;
    playerState: Record<string, unknown>;
    discoveredClues: string[];
  }): Promise<Record<string, unknown>> {
    this.logger.log('Requesting event generation candidate from Agent Service');
    return this.callAgent<Record<string, unknown>>('/event/generate', request);
  }

  async evaluateEndingCandidate(request: {
    sessionId: string;
    discoveredEvidence: string[];
    journeySummary: string;
    playerState: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    this.logger.log('Requesting ending evaluation candidate from Agent Service');
    return this.callAgent<Record<string, unknown>>('/ending/generate', request);
  }

  async summarizeMemory(sessionId: string, npcId: string, rawContent: string): Promise<Record<string, unknown>[]> {
    this.logger.log(`Requesting memory summarization for NPC ${npcId} from Agent Service`);
    return this.callAgent<Record<string, unknown>[]>(
      `/memory/${sessionId}/summarize`,
      { npcId, rawContent },
    );
  }

  async retrieveMemories(sessionId: string, npcId: string, limit?: number): Promise<Record<string, unknown>[]> {
    const limitParam = limit ?? 20;
    this.logger.log(`Requesting memory retrieval for NPC ${npcId} from Agent Service`);
    return this.callAgent<Record<string, unknown>[]>(
      `/memory/${sessionId}/retrieve?npc_id=${encodeURIComponent(npcId)}&limit=${limitParam}`,
      {},
    );
  }

  async getAgentHealth(): Promise<{ status: string }> {
    const url = `${this.baseUrl}/`;

    try {
      const response = await fetch(url, { method: 'GET' });

      if (!response.ok) {
        return { status: 'unhealthy' };
      }

      return (await response.json()) as { status: string };
    } catch {
      return { status: 'unreachable' };
    }
  }
}