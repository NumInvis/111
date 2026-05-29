import { Module } from '@nestjs/common';
import { ProviderRegistryWrapper } from './provider-registry';
import { OpenaiCompatibleProviderWrapper } from './providers/openai-compatible.provider';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { PromptRegistryService } from './prompt-registry.service';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [ProviderRegistryWrapper, OpenaiCompatibleProviderWrapper, LlmService, PromptRegistryService],
  controllers: [LlmController],
  exports: [LlmService, PromptRegistryService],
})
export class LlmModule {}