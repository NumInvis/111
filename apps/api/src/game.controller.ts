import { Controller, Get, Post, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import { GameService } from './game.service';

@Controller()
export class GameController {
  constructor(private readonly game: GameService) {}

  @Get('health')
  health() {
    return { success: true, data: 'ok' };
  }

  @Post('game/sessions')
  async createSession() {
    try {
      const result = await this.game.createSession();
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
