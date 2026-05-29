import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmModule } from '../llm/llm.module';
import { AuditModule } from '../audit/audit.module';
import { SafetyModule } from '../safety/safety.module';
import { AgentBridgeModule } from '../agent-bridge/agent-bridge.module';

@Module({
  imports: [PrismaModule, LlmModule, AuditModule, SafetyModule, AgentBridgeModule],
  providers: [GameService],
  controllers: [GameController],
  exports: [GameService],
})
export class GameModule {}