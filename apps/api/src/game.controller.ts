import { Controller, Get, Post, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import { GameService } from './game.service';
import { AIConfigService, AIConfig } from './config';
import { ModelService } from './models';
import { WorldPreference } from '@variational-infinity/shared';

@Controller()
export class GameController {
  constructor(
    private readonly game: GameService,
    private readonly aiConfig: AIConfigService,
    private readonly models: ModelService,
  ) {}

  @Get('health')
  health() {
    return { success: true, data: 'ok' };
  }

  @Get('config')
  getConfig() {
    return { success: true, data: this.aiConfig.toSafeJSON() };
  }

  @Post('config')
  updateConfig(@Body() body: { ai?: Partial<AIConfig>; port?: number }) {
    if (!body || (!body.ai && body.port === undefined)) {
      throw new BadRequestException('ai or port is required');
    }

    const cfg = this.aiConfig.save({ ai: body.ai, port: body.port });
    return { success: true, data: cfg };
  }

  @Get('models')
  async listModels() {
    try {
      const models = await this.models.listModels();
      return { success: true, data: { models, count: models.length } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      throw new BadRequestException(msg);
    }
  }

  @Post('game/sessions')
  async createSession(@Body() body?: { preference?: WorldPreference }) {
    try {
      const result = await this.game.createSession(body?.preference);
      return { success: true, data: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      throw new BadRequestException(msg);
    }
  }

  @Get('game/sessions/:id')
  async getSession(@Param('id') id: string) {
    try {
      const result = await this.game.getSession(id);
      return { success: true, data: result };
    } catch (err) {
      throw new NotFoundException(err instanceof Error ? err.message : 'Not found');
    }
  }

  @Post('game/sessions/:id/action')
  async sendAction(@Param('id') id: string, @Body() body: { action: string }) {
    if (!body.action) throw new BadRequestException('action is required');
    try {
      const result = await this.game.sendAction(id, body.action);
      return { success: true, data: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      throw new BadRequestException(msg);
    }
  }
}
