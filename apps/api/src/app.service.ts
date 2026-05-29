import { Injectable } from '@nestjs/common';
import type { ApiResponse } from '@variational-infinity/shared';

@Injectable()
export class AppService {
  getStatus(): ApiResponse<Record<string, string>> {
    return {
      success: true,
      data: {
        name: '变分无限',
        codename: 'MythWeaver',
        version: '0.1.0',
        description: 'AI-native math-xianxia life-simulator game',
      },
    };
  }
}