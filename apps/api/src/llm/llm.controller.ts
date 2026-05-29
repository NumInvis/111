import { Controller, Get } from '@nestjs/common';
import { LlmService } from './llm.service';
import type { ApiResponse, LlmProviderInfo } from '@variational-infinity/shared';

@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Get('providers')
  getProviders(): ApiResponse<LlmProviderInfo> {
    const info = this.llmService.getProviderInfo();
    return { success: true, data: info };
  }
}