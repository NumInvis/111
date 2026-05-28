import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { ApiResponse } from '@vi/shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getProjectInfo(): ApiResponse<Record<string, string>> {
    return this.appService.getStatus();
  }

  @Get('health')
  getHealth(): ApiResponse<string> {
    return { success: true, data: 'ok' };
  }
}