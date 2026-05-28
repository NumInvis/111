import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { AuditService } from '../audit/audit.service';
import { SafetyService } from '../safety/safety.service';
import {
  GameStateMachine,
  ActionValidator,
  EndingArbitrator,
  RealmAdvancementChecker,
  applyMoveAction,
  applyTalkAction,
  applyNextYearAction,
  applyDiscoverAction,
  applyInvestigateAction,
  applyEventChoiceAction,
} from '@vi/game-engine';
import type { StateUpdate } from '@vi/game-engine';
import { z } from 'zod';
import {
  WorldBlueprintSchema,
  PlayerStateSchema,
  GameActionSchema,
  EventTypeEnum,
  JournalCategoryEnum,
} from '@vi/shared';
import type {
  WorldBlueprint,
  PlayerState,
  GameAction,
  ActionType,
  EndingCandidate,
  ApiResponse,
} from '@vi/shared';
import { PromptRegistry } from '@vi/ai';

const NpcDialogueOutputSchema = z.object({
  role: z.enum(['npc']),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly actionValidator = new ActionValidator();
  private readonly endingArbitrator = new EndingArbitrator();
  private readonly realmAdvancementChecker = new RealmAdvancementChecker();
  private readonly promptRegistry = new PromptRegistry();

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
    private readonly auditService: AuditService,
    private readonly safetyService: SafetyService,
  ) {}

  private async loadSession(sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        worldBlueprint: true,
        gameStates: { orderBy: { turn: 'desc' }, take: 1 },
      },
    });
    if (!session) throw new NotFoundException(`Session "${sessionId}" not found`);
    return session;
  }

  private async loadWorldBlueprint(sessionId: string): Promise<WorldBlueprint> {
    const session = await this.loadSession(sessionId);
    const data = session.worldBlueprint?.data;
    if (!data) throw new BadRequestException(`No world blueprint for session "${sessionId}". Generate a world first.`);
    return WorldBlueprintSchema.parse(data);
  }

  private async loadPlayerState(sessionId: string): Promise<PlayerState> {
    const session = await this.loadSession(sessionId);
    const record = session.gameStates[0];
    if (!record) throw new BadRequestException(`No game state for session "${sessionId}".`);
    return PlayerStateSchema.parse(record.data);
  }

  private async persistStateUpdate(sessionId: string, playerState: PlayerState, stateUpdate: StateUpdate) {
    const mergedState: PlayerState = { ...playerState, ...stateUpdate.newState };
    PlayerStateSchema.parse(mergedState);

    await this.prisma.gameState.create({
      data: { sessionId, turn: mergedState.age, data: mergedState as object },
    });

    for (const entry of stateUpdate.journalEntries) {
      await this.prisma.journalEntry.create({
        data: {
          sessionId,
          turn: entry.turn,
          locationId: entry.locationId ?? undefined,
          action: entry.action,
          result: entry.result,
          evidenceTag: entry.evidenceTag ?? false,
          category: entry.category,
        },
      });
    }

    for (const event of stateUpdate.events) {
      await this.prisma.worldEvent.create({
        data: { sessionId, eventType: event.eventType, data: event.data as object, turn: event.turn },
      });
    }

    return mergedState;
  }

  async createSession(userId?: string): Promise<{ id: string; status: string }> {
    const session = await this.prisma.gameSession.create({
      data: { userId: userId ?? undefined, status: 'active' },
    });
    this.logger.log(`Game session created: ${session.id}`);
    return { id: session.id, status: session.status };
  }

  async getSession(sessionId: string) {
    return await this.loadSession(sessionId);
  }

  async applyAction(sessionId: string, action: GameAction): Promise<StateUpdate> {
    const session = await this.loadSession(sessionId);
    if (session.status !== 'active') {
      throw new BadRequestException(`Session "${sessionId}" is not active (status: ${session.status}).`);
    }

    const worldBlueprint = await this.loadWorldBlueprint(sessionId);
    const playerState = await this.loadPlayerState(sessionId);

    const validationResult = this.actionValidator.validateAction(
      worldBlueprint, playerState, action.actionType, action.payload,
    );

    if (!validationResult.allowed) {
      throw new BadRequestException(`Action validation failed: ${validationResult.reason ?? 'unknown reason'}`);
    }

    let stateUpdate: StateUpdate;

    switch (action.actionType) {
      case 'move':
        stateUpdate = applyMoveAction(sessionId, playerState, action.payload as { targetLocationId: string }, worldBlueprint);
        break;
      case 'talk':
        stateUpdate = applyTalkAction(sessionId, playerState, action.payload as { npcId: string }, worldBlueprint);
        break;
      case 'next_year':
        stateUpdate = applyNextYearAction(sessionId, playerState, action.payload as Record<string, unknown>, worldBlueprint);
        break;
      case 'discover':
        stateUpdate = applyDiscoverAction(sessionId, playerState, action.payload as { clueId?: string; rumorId?: string }, worldBlueprint);
        break;
      case 'investigate':
        stateUpdate = applyInvestigateAction(sessionId, playerState, action.payload as { target: string; depth?: string }, worldBlueprint);
        break;
      case 'event_choice':
        stateUpdate = applyEventChoiceAction(sessionId, playerState, action.payload as { eventId: string; optionIndex: number; attributeEffects: Record<string, number> }, worldBlueprint);
        break;
      case 'rest':
      case 'trade':
        stateUpdate = { newState: {}, journalEntries: [], events: [], relationships: playerState.relationships };
        break;
      default:
        throw new BadRequestException(`Unsupported action type: "${action.actionType}".`);
    }

    await this.persistStateUpdate(sessionId, playerState, stateUpdate);

    await this.auditService.logStateChange(sessionId, `action:${action.actionType}`, {
      actionType: action.actionType,
      turn: stateUpdate.newState.age ?? playerState.age,
    });

    return stateUpdate;
  }

  async nextYear(sessionId: string): Promise<StateUpdate> {
    const session = await this.loadSession(sessionId);
    if (session.status !== 'active') {
      throw new BadRequestException(`Session "${sessionId}" is not active.`);
    }

    const worldBlueprint = await this.loadWorldBlueprint(sessionId);
    const playerState = await this.loadPlayerState(sessionId);

    const stateUpdate = applyNextYearAction(sessionId, playerState, {}, worldBlueprint);

    const mergedState = await this.persistStateUpdate(sessionId, playerState, stateUpdate);

    if (mergedState.age >= mergedState.lifespan) {
      await this.prisma.gameSession.update({
        where: { id: sessionId },
        data: { status: 'ended' },
      });
    }

    await this.auditService.logStateChange(sessionId, 'next_year', {
      newAge: mergedState.age,
      realm: mergedState.realm,
    });

    return stateUpdate;
  }

  async checkEnding(sessionId: string): Promise<EndingCandidate[]> {
    const worldBlueprint = await this.loadWorldBlueprint(sessionId);
    const playerState = await this.loadPlayerState(sessionId);

    return this.endingArbitrator.checkAllEndingCandidates(
      worldBlueprint.endingCandidates, playerState,
    );
  }

  async triggerEnding(sessionId: string, endingId: string): Promise<{ endingId: string; summary: string }> {
    const session = await this.loadSession(sessionId);
    if (session.status !== 'active') {
      throw new BadRequestException(`Session "${sessionId}" is not active.`);
    }

    const worldBlueprint = await this.loadWorldBlueprint(sessionId);
    const playerState = await this.loadPlayerState(sessionId);

    const candidate = worldBlueprint.endingCandidates.find((c) => c.id === endingId);
    if (!candidate) {
      throw new BadRequestException(`Ending candidate "${endingId}" not found in world blueprint.`);
    }

    const eligibility = this.endingArbitrator.checkEndingCandidate(candidate, playerState);
    if (!eligibility.allowed) {
      throw new BadRequestException(`Ending "${endingId}" is not eligible: ${eligibility.reason ?? 'requirements not met'}`);
    }

    const prompt = this.promptRegistry.render('ending_candidate', {
      playerAge: String(playerState.age),
      playerRealm: playerState.realm,
      playerAttributes: JSON.stringify(playerState.attributes),
      discoveredClues: JSON.stringify(playerState.discoveredClues),
      discoveredNpcs: JSON.stringify(playerState.discoveredNpcs),
      historySummary: playerState.historySummary,
      worldConflict: worldBlueprint.worldProfile.coreConflict,
      endingCandidateIds: JSON.stringify(worldBlueprint.endingCandidates.map((c) => c.id)),
    });

    const { data } = await this.llmService.generateWithSchema(
      prompt,
      WorldBlueprintSchema.shape.endingCandidates.element as z.ZodType<EndingCandidate>,
      { sessionId, agentType: 'ending', promptName: 'ending_candidate' },
    );

    await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: 'ended' },
    });

    await this.auditService.logStateChange(sessionId, 'ending_triggered', {
      endingId,
      endingTitle: candidate.title,
    });

    return { endingId, summary: data.description };
  }

  async endSession(sessionId: string): Promise<{ id: string; status: string }> {
    const session = await this.loadSession(sessionId);

    const updated = await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: 'ended' },
    });

    this.logger.log(`Session "${sessionId}" ended.`);
    return { id: updated.id, status: updated.status };
  }

  async startDialogue(sessionId: string, npcId: string): Promise<{ npcId: string; phase: string }> {
    const session = await this.loadSession(sessionId);
    if (session.status !== 'active') {
      throw new BadRequestException(`Session "${sessionId}" is not active.`);
    }

    const worldBlueprint = await this.loadWorldBlueprint(sessionId);
    const npc = worldBlueprint.npcs.find((n) => n.id === npcId);
    if (!npc) {
      throw new BadRequestException(`NPC "${npcId}" not found in world blueprint.`);
    }

    const playerState = await this.loadPlayerState(sessionId);

    const stateMachine = new GameStateMachine({
      phase: 'exploring',
      turn: playerState.age,
      playerState,
      worldBlueprint,
      pendingActions: [],
      safetyFlags: [],
    });

    if (!stateMachine.canTransition('talk')) {
      throw new BadRequestException(`Cannot start dialogue from current phase "${stateMachine.getPhase()}".`);
    }

    stateMachine.transition('talk');

    await this.auditService.logStateChange(sessionId, 'dialogue_started', {
      npcId,
      npcName: npc.name,
    });

    return { npcId, phase: 'dialoguing' };
  }

  async generateDialogueMessage(
    sessionId: string,
    npcId: string,
    playerMessage: string,
  ): Promise<{ content: string; emotion: string; trustChange: number }> {
    const session = await this.loadSession(sessionId);
    if (session.status !== 'active') {
      throw new BadRequestException(`Session "${sessionId}" is not active.`);
    }

    const inputSafetyResult = this.safetyService.checkInput(playerMessage);
    if (!inputSafetyResult.safe) {
      const errors = inputSafetyResult.errors?.join('; ') ?? 'unknown injection detected';
      await this.auditService.logSafetyEvent(sessionId, 'injection_detected', 'critical', { errors });
      throw new BadRequestException(`Input safety check failed: ${errors}`);
    }

    const worldBlueprint = await this.loadWorldBlueprint(sessionId);
    const npc = worldBlueprint.npcs.find((n) => n.id === npcId);
    if (!npc) {
      throw new BadRequestException(`NPC "${npcId}" not found.`);
    }

    const playerState = await this.loadPlayerState(sessionId);

    const prompt = this.promptRegistry.render('npc_dialogue', {
      npcName: npc.name,
      npcRole: npc.role,
      npcPersonality: npc.personality.join(', '),
      npcGoal: npc.goal,
      npcSecret: npc.secret,
      npcForbiddenTopics: npc.forbiddenTopics.join(', '),
      npcDialogueStyle: npc.dialogueStyle,
      playerRealm: playerState.realm,
      playerAttributes: JSON.stringify(playerState.attributes),
      playerMessage,
    });

    const { data } = await this.llmService.generateWithSchema(
      prompt,
      NpcDialogueOutputSchema,
      { sessionId, agentType: 'npc', promptName: 'npc_dialogue', temperature: 0.8 },
    );

    const outputSafetyResult = this.safetyService.checkOutput(JSON.stringify(data));
    if (!outputSafetyResult.safe) {
      await this.auditService.logSafetyEvent(sessionId, 'output_safety_violation', 'high', {
        errors: outputSafetyResult.errors,
      });
      throw new BadRequestException(`NPC dialogue output safety check failed: ${outputSafetyResult.errors?.join('; ') ?? 'unknown'}`);
    }

    const metadata = data.metadata ?? {};
    const emotion = (metadata.emotion as string) ?? 'neutral';
    const trustChange = typeof metadata.trustChange === 'number' ? metadata.trustChange : 0;

    await this.prisma.dialogueMessage.create({
      data: {
        sessionId,
        npcId,
        role: data.role,
        content: data.content,
        metadata: metadata as object,
        turn: playerState.age,
      },
    });

    await this.auditService.logStateChange(sessionId, 'dialogue_message', {
      npcId,
      npcName: npc.name,
      contentLength: data.content.length,
    });

    return { content: data.content, emotion, trustChange };
  }

  async getState(sessionId: string): Promise<PlayerState> {
    return await this.loadPlayerState(sessionId);
  }
}