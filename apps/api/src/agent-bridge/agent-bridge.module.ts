import { Module } from '@nestjs/common';
import { AgentBridgeService } from './agent-bridge.service';

@Module({
  providers: [AgentBridgeService],
  exports: [AgentBridgeService],
})
export class AgentBridgeModule {}