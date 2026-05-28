import { Module } from '@nestjs/common';
import { ProviderRegistryWrapper } from './provider-registry';
import { OpenaiCompatibleProviderWrapper } from './providers/openai-compatible.provider';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ProviderRegistryWrapper, OpenaiCompatibleProviderWrapper, LlmService],
  controllers: [LlmController],
  exports: [LlmService],
})
export class LlmModule {}