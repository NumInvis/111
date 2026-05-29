import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { AgentBridgeService } from './agent-bridge/agent-bridge.service';
import type { ApiResponse } from '@variational-infinity/shared';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly agentBridgeService: AgentBridgeService,
  ) {}

  @Get()
  getProjectInfo(): ApiResponse<Record<string, string>> {
    return this.appService.getStatus();
  }

  @Get('health')
  getHealth(): ApiResponse<string> {
    return { success: true, data: 'ok' };
  }

  @Get('agent-status')
  async getAgentStatus(): Promise<ApiResponse<Record<string, unknown>>> {
    const agentHealth = await this.agentBridgeService.getAgentHealth();
    return { success: true, data: { agentService: agentHealth } };
  }
}