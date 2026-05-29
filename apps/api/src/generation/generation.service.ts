import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { SafetyService } from '../safety/safety.service';
import { AuditService } from '../audit/audit.service';
import { PromptRegistryService } from '../llm/prompt-registry.service';
import { z } from 'zod';
import { WorldBlueprintSchema, PlayerStateSchema } from '@variational-infinity/shared';
import type { WorldBlueprint, PlayerState } from '@variational-infinity/shared';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
    private readonly safetyService: SafetyService,
    private readonly auditService: AuditService,
    private readonly promptRegistry: PromptRegistryService,
  ) {}

  async generateWorld(sessionId: string): Promise<WorldBlueprint> {
    this.logger.log(`Generating world for session ${sessionId} — zero-param, AI decides everything`);

    const prompt = this.promptRegistry.render('world_generation', {});

    const inputSafetyResult = this.safetyService.checkInput(prompt);
    if (!inputSafetyResult.safe) {
      const errors = inputSafetyResult.errors?.join('; ') ?? 'unknown injection detected';
      await this.auditService.logSafetyEvent(sessionId, 'injection_detected', 'critical', {
        errors: inputSafetyResult.errors,
        injectionScore: inputSafetyResult.injectionScore,
      });
      throw new Error(`Input safety check failed: ${errors}`);
    }

    const promptEntry = this.promptRegistry.get('world_generation');

    const { data, result } = await this.llmService.generateWithSchema<WorldBlueprint>(
      prompt,
      WorldBlueprintSchema as z.ZodType<WorldBlueprint>,
      {
        sessionId,
        agentType: 'world_gen',
        promptName: 'world_generation',
        temperature: 0.7,
      },
    );

    const locationIds = data.locations.map((l) => l.id);
    const npcIds = data.npcs.map((n) => n.id);
    const factionIds = data.factions.map((f) => f.id);

    const fullSafetyCheck = this.safetyService.fullOutputCheck(
      data,
      undefined,
      undefined,
      { locationIds, npcIds, factionIds },
    );

    if (!fullSafetyCheck.safe) {
      const errors = fullSafetyCheck.errors?.join('; ') ?? 'unknown safety violation';
      await this.auditService.logSafetyEvent(sessionId, 'output_safety_violation', 'high', {
        errors: fullSafetyCheck.errors,
        injectionScore: fullSafetyCheck.injectionScore,
      });
      throw new Error(`Output safety check failed: ${errors}`);
    }

    try {
      const initialLocationId = data.locations[0]?.id ?? 'unknown';
      const startingState = data.startingState;

      const defaultPlayerState: PlayerState = {
        name: startingState.name,
        age: startingState.age,
        lifespan: startingState.lifespan,
        realm: startingState.realm as PlayerState['realm'],
        currentLocationId: initialLocationId,
        attributes: startingState.attributes,
        discoveredLocations: [initialLocationId],
        discoveredNpcs: [],
        discoveredClues: [],
        discoveredRumors: [],
        relationships: {},
        historySummary: `初入${data.worldProfile.name}，一切从零开始。`,
      };

      PlayerStateSchema.parse(defaultPlayerState);

      const [blueprint] = await this.prisma.$transaction([
        this.prisma.worldBlueprint.create({
          data: {
            sessionId,
            generationId: crypto.randomUUID(),
            promptVersion: promptEntry.version,
            model: result.model,
            provider: result.provider,
            seed: 0,
            data: data as object,
          },
        }),
        this.prisma.gameState.create({
          data: {
            sessionId,
            turn: 0,
            data: defaultPlayerState as object,
          },
        }),
      ]);

      this.logger.log(`World generated and initial state created for session ${sessionId}`);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to persist world blueprint: ${message}`);
      throw new Error(`Failed to persist world blueprint: ${message}`);
    }
  }

  async getWorldBlueprint(sessionId: string): Promise<WorldBlueprint | null> {
    const record = await this.prisma.worldBlueprint.findUnique({
      where: { sessionId },
    });

    if (!record) return null;

    return WorldBlueprintSchema.parse(record.data);
  }
}
