import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './logger.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { PrismaService } from './prisma.service';
import { AIConfigService } from './config';
import { ModelService } from './models';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), LoggerModule],
  controllers: [GameController],
  providers: [GameService, PrismaService, AIConfigService, ModelService],
})
export class AppModule {}
