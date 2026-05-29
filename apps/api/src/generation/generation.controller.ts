import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { GenerationService } from './generation.service';
import type { ApiResponse, WorldBlueprint } from '@variational-infinity/shared';

@Controller('generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post('world/:sessionId')
  async generateWorld(
    @Param('sessionId') sessionId: string,
    @Body() _body: Record<string, unknown>,
  ): Promise<ApiResponse<WorldBlueprint>> {
    const blueprint = await this.generationService.generateWorld(sessionId);
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
