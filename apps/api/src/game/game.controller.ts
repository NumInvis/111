import { Controller, Get, Post, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import { GameService } from './game.service';
import type { ApiResponse, EndingCandidate } from '@variational-infinity/shared';
import type { PlayerState, GameAction } from '@variational-infinity/shared';
import type { StateUpdate } from '@variational-infinity/game-engine';
import { CreateSessionDto, ApplyActionDto, TriggerEndingDto, StartDialogueDto, SendDialogueMessageDto, StoreAgentMemoryDto } from '../dto/dto';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('sessions')
  async createSession(@Body() body: CreateSessionDto): Promise<ApiResponse<{ id: string; status: string }>> {
    const session = await this.gameService.createSession(body.userId);
    return { success: true, data: session };
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string): Promise<ApiResponse<Record<string, unknown>>> {
    try {
      const session = await this.gameService.getSession(id);
      return { success: true, data: session as unknown as Record<string, unknown> };
    } catch {
      throw new NotFoundException(`Session "${id}" not found`);
    }
  }

  @Post('sessions/:id/actions')
  async applyAction(
    @Param('id') id: string,
    @Body() action: ApplyActionDto,
  ): Promise<ApiResponse<StateUpdate>> {
    try {
      const result = await this.gameService.applyAction(id, action);
      return { success: true, data: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      throw new BadRequestException(msg);
    }
  }

  @Post('sessions/:id/next-year')
  async nextYear(@Param('id') id: string): Promise<ApiResponse<StateUpdate>> {
    try {
      const result = await this.gameService.nextYear(id);
      return { success: true, data: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Next year failed';
      throw new BadRequestException(msg);
    }
  }

  @Get('sessions/:id/state')
  async getState(@Param('id') id: string): Promise<ApiResponse<PlayerState>> {
    try {
      const state = await this.gameService.getState(id);
      return { success: true, data: state };
    } catch {
      throw new NotFoundException(`No game state for session "${id}"`);
    }
  }

  @Get('sessions/:id/endings')
  async checkEnding(@Param('id') id: string): Promise<ApiResponse<EndingCandidate[]>> {
    try {
      const endings = await this.gameService.checkEnding(id);
      return { success: true, data: endings };
    } catch {
      throw new NotFoundException(`Session "${id}" not found`);
    }
  }

  @Post('sessions/:id/trigger-ending')
  async triggerEnding(
    @Param('id') id: string,
    @Body() body: TriggerEndingDto,
  ): Promise<ApiResponse<{ endingId: string; summary: string }>> {
    try {
      const result = await this.gameService.triggerEnding(id, body.endingId);
      return { success: true, data: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Trigger ending failed';
      throw new BadRequestException(msg);
    }
  }

  @Post('sessions/:id/end')
  async endSession(@Param('id') id: string): Promise<ApiResponse<{ id: string; status: string }>> {
    try {
      const result = await this.gameService.endSession(id);
      return { success: true, data: result };
    } catch {
      throw new NotFoundException(`Session "${id}" not found`);
    }
  }

  @Post('sessions/:id/dialogue')
  async startDialogue(
    @Param('id') id: string,
    @Body() body: StartDialogueDto,
  ): Promise<ApiResponse<{ npcId: string; phase: string }>> {
    try {
      const result = await this.gameService.startDialogue(id, body.npcId);
      return { success: true, data: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Start dialogue failed';
      throw new BadRequestException(msg);
    }
  }

  @Post('sessions/:id/dialogue/message')
  async sendDialogueMessage(
    @Param('id') id: string,
    @Body() body: SendDialogueMessageDto,
  ): Promise<ApiResponse<{ content: string; emotion: string; trustChange: number }>> {
    try {
      const result = await this.gameService.generateDialogueMessage(id, body.npcId, body.message);
      return { success: true, data: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Dialogue generation failed';
      throw new BadRequestException(msg);
    }
  }

  @Get('sessions/:id/agent-memory')
  async getAgentMemory(@Param('id') id: string): Promise<ApiResponse<Record<string, unknown>[]>> {
    try {
      const memories = await this.gameService.getAgentMemory(id);
      return { success: true, data: memories as Record<string, unknown>[] };
    } catch {
      throw new NotFoundException(`No agent memory for session "${id}"`);
    }
  }

  @Post('sessions/:id/agent-memory')
  async storeAgentMemory(
    @Param('id') id: string,
    @Body() body: StoreAgentMemoryDto,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    try {
      const memory = await this.gameService.storeAgentMemory(id, body);
      return { success: true, data: memory as Record<string, unknown> };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Store agent memory failed';
      throw new BadRequestException(msg);
    }
  }

  @Get('sessions/:id/trace')
  async getGameTrace(@Param('id') id: string): Promise<ApiResponse<Record<string, unknown>[]>> {
    try {
      const traces = await this.gameService.getGameTrace(id);
      return { success: true, data: traces as Record<string, unknown>[] };
    } catch {
      throw new NotFoundException(`No trace for session "${id}"`);
    }
  }
}