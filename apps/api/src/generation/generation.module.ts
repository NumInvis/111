import { Module } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { GenerationController } from './generation.controller';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SafetyModule } from '../safety/safety.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [LlmModule, PrismaModule, SafetyModule, AuditModule],
  providers: [GenerationService],
  controllers: [GenerationController],
})
export class GenerationModule {}