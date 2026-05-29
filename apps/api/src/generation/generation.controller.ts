import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { GenerationService } from './generation.service';
import type { ApiResponse, WorldBlueprint } from '@variational-infinity/shared';
import { GenerationPreferencesDto } from '../dto/dto';

@Controller('generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post('world/:sessionId')
  async generateWorld(
    @Param('sessionId') sessionId: string,
    @Body() preferences: GenerationPreferencesDto,
  ): Promise<ApiResponse<WorldBlueprint>> {
    const blueprint = await this.generationService.generateWorld(sessionId, preferences);
    return { success: true, data: blueprint };
  }

  @Get('world/:sessionId')
  async getWorldBlueprint(
    @Param('sessionId') sessionId: string,
  ): Promise<ApiResponse<WorldBlueprint>> {
    const blueprint = await this.generationService.getWorldBlueprint(sessionId);
    if (!blueprint) {
      return { success: false, error: `World blueprint not found for session ${sessionId}` };
    }
    return { success: true, data: blueprint };
  }
}