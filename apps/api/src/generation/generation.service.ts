import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { SafetyService } from '../safety/safety.service';
import { AuditService } from '../audit/audit.service';
import { PromptRegistry } from '@vi/ai';
import { WorldBlueprintSchema, PlayerStateSchema } from '@vi/shared';
import type { WorldBlueprint, PlayerState, GenerationPreferences } from '@vi/shared';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);
  private readonly promptRegistry = new PromptRegistry();

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
    private readonly safetyService: SafetyService,
    private readonly auditService: AuditService,
  ) {}

  async generateWorld(sessionId: string, preferences: GenerationPreferences): Promise<WorldBlueprint> {
    this.logger.log(`Generating world for session ${sessionId} with preferences: ${JSON.stringify(preferences)}`);

    const prompt = this.promptRegistry.render('world_generation', {
      theme: preferences.theme,
      scale: preferences.scale,
      tone: preferences.tone,
      seed: String(preferences.seed ?? 0),
      mode: preferences.mode,
    });

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
      WorldBlueprintSchema,
      {
        sessionId,
        agentType: 'world_gen',
        promptName: 'world_generation',
        seed: preferences.seed,
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
      const blueprint = await this.prisma.worldBlueprint.create({
        data: {
          sessionId,
          generationId: crypto.randomUUID(),
          promptVersion: promptEntry.version,
          model: result.model,
          provider: result.provider,
          seed: preferences.seed ?? 0,
          data: data as object,
        },
      });

      const initialLocationId = data.locations[0]?.id ?? 'unknown';
      const defaultPlayerState: PlayerState = {
        name: '行者',
        age: 16,
        lifespan: 80,
        realm: '炼体',
        currentLocationId: initialLocationId,
        attributes: {
          calculation: 10,
          geometry: 5,
          abstraction: 5,
          proof: 3,
          intuition: 5,
          focus: 10,
          body: 20,
          family: 10,
        },
        discoveredLocations: [initialLocationId],
        discoveredNpcs: [],
        discoveredClues: [],
        discoveredRumors: [],
        relationships: {},
        historySummary: '初入灵墟，一切从零开始。',
      };

      PlayerStateSchema.parse(defaultPlayerState);

      await this.prisma.gameState.create({
        data: {
          sessionId,
          turn: 0,
          data: defaultPlayerState as object,
        },
      });

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