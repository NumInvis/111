import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { GameService } from './game.service';
import type { ApiResponse, GameAction, PlayerState, EndingCandidate, StateUpdate } from '@vi/shared';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('sessions')
  async createSession(@Body() body?: { userId?: string }): Promise<ApiResponse<{ id: string; status: string }>> {
    const session = await this.gameService.createSession(body?.userId);
    return { success: true, data: session };
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string): Promise<ApiResponse<Record<string, unknown>>> {
    const session = await this.gameService.getSession(id);
    return { success: true, data: session as unknown as Record<string, unknown> };
  }

  @Post('sessions/:id/actions')
  async applyAction(
    @Param('id') id: string,
    @Body() action: GameAction,
  ): Promise<ApiResponse<StateUpdate>> {
    const result = await this.gameService.applyAction(id, action);
    return { success: true, data: result };
  }

  @Post('sessions/:id/next-year')
  async nextYear(@Param('id') id: string): Promise<ApiResponse<StateUpdate>> {
    const result = await this.gameService.nextYear(id);
    return { success: true, data: result };
  }

  @Get('sessions/:id/state')
  async getState(@Param('id') id: string): Promise<ApiResponse<PlayerState>> {
    const state = await this.gameService.getState(id);
    return { success: true, data: state };
  }

  @Get('sessions/:id/endings')
  async checkEnding(@Param('id') id: string): Promise<ApiResponse<EndingCandidate[]>> {
    const endings = await this.gameService.checkEnding(id);
    return { success: true, data: endings };
  }

  @Post('sessions/:id/end')
  async endSession(@Param('id') id: string): Promise<ApiResponse<{ id: string; status: string }>> {
    const result = await this.gameService.endSession(id);
    return { success: true, data: result };
  }

  @Post('sessions/:id/dialogue')
  async startDialogue(
    @Param('id') id: string,
    @Body() body: { npcId: string },
  ): Promise<ApiResponse<{ npcId: string; phase: string }>> {
    const result = await this.gameService.startDialogue(id, body.npcId);
    return { success: true, data: result };
  }
}