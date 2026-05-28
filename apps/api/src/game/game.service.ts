import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { AuditService } from '../audit/audit.service';
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
  ) {}

  async createSession(userId?: string): Promise<{ id: string; status: string }> {
    const session = await this.prisma.gameSession.create({
      data: {
        userId: userId ?? undefined,
        status: 'active',
      },
    });
    this.logger.log(`Game session created: ${session.id}`);
    return { id: session.id, status: session.status };
  }

  async getSession(sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        worldBlueprint: true,
        gameStates: { orderBy: { turn: 'desc' }, take: 1 },
      },
    });

    if (!session) {
      throw new Error(`Game session "${sessionId}" not found.`);
    }

    return session;
  }

  async applyAction(sessionId: string, action: GameAction): Promise<StateUpdate> {
    const session = await this.getSession(sessionId);
    if (session.status !== 'active') {
      throw new Error(`Session "${sessionId}" is not active (status: ${session.status}).`);
    }

    const blueprintData = session.worldBlueprint?.data;
    if (!blueprintData) {
      throw new Error(`No world blueprint found for session "${sessionId}".`);
    }

    const worldBlueprint = WorldBlueprintSchema.parse(blueprintData);
    const latestStateRecord = session.gameStates[0];
    if (!latestStateRecord) {
      throw new Error(`No game state found for session "${sessionId}".`);
    }

    const playerState = PlayerStateSchema.parse(latestStateRecord.data);

    const validationResult = this.actionValidator.validateAction(
      worldBlueprint,
      playerState,
      action.actionType,
      action.payload,
    );

    if (!validationResult.allowed) {
      throw new Error(`Action validation failed: ${validationResult.reason ?? 'unknown reason'}`);
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
      case 'rest':
      case 'trade':
        stateUpdate = {
          newState: {},
          journalEntries: [],
          events: [],
          relationships: playerState.relationships,
        };
        break;
      default:
        throw new Error(`Unsupported action type: "${action.actionType}".`);
    }

    const mergedState: PlayerState = { ...playerState, ...stateUpdate.newState };
    PlayerStateSchema.parse(mergedState);

    await this.prisma.gameState.create({
      data: {
        sessionId,
        turn: mergedState.age,
        data: mergedState as object,
      },
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
        data: {
          sessionId,
          eventType: event.eventType,
          data: event.data as object,
          turn: event.turn,
        },
      });
    }

    await this.auditService.logStateChange(sessionId, `action:${action.actionType}`, {
      actionType: action.actionType,
      turn: mergedState.age,
      journalCount: stateUpdate.journalEntries.length,
      eventCount: stateUpdate.events.length,
    });

    return stateUpdate;
  }

  async nextYear(sessionId: string): Promise<StateUpdate> {
    const session = await this.getSession(sessionId);
    if (session.status !== 'active') {
      throw new Error(`Session "${sessionId}" is not active.`);
    }

    const blueprintData = session.worldBlueprint?.data;
    if (!blueprintData) {
      throw new Error(`No world blueprint for session "${sessionId}".`);
    }
    const worldBlueprint = WorldBlueprintSchema.parse(blueprintData);

    const latestStateRecord = session.gameStates[0];
    if (!latestStateRecord) {
      throw new Error(`No game state for session "${sessionId}".`);
    }
    const playerState = PlayerStateSchema.parse(latestStateRecord.data);

    const stateUpdate = applyNextYearAction(sessionId, playerState, {}, worldBlueprint);

    const mergedState: PlayerState = { ...playerState, ...stateUpdate.newState };
    PlayerStateSchema.parse(mergedState);

    await this.prisma.gameState.create({
      data: {
        sessionId,
        turn: mergedState.age,
        data: mergedState as object,
      },
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
        data: {
          sessionId,
          eventType: event.eventType,
          data: event.data as object,
          turn: event.turn,
        },
      });
    }

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
    const session = await this.getSession(sessionId);
    const blueprintData = session.worldBlueprint?.data;
    if (!blueprintData) {
      throw new Error(`No world blueprint for session "${sessionId}".`);
    }
    const worldBlueprint = WorldBlueprintSchema.parse(blueprintData);

    const latestStateRecord = session.gameStates[0];
    if (!latestStateRecord) {
      throw new Error(`No game state for session "${sessionId}".`);
    }
    const playerState = PlayerStateSchema.parse(latestStateRecord.data);

    return this.endingArbitrator.checkAllEndingCandidates(
      worldBlueprint.endingCandidates,
      playerState,
    );
  }

  async triggerEnding(sessionId: string, endingId: string): Promise<{ endingId: string; summary: string }> {
    const session = await this.getSession(sessionId);
    if (session.status !== 'active') {
      throw new Error(`Session "${sessionId}" is not active.`);
    }

    const blueprintData = session.worldBlueprint?.data;
    if (!blueprintData) {
      throw new Error(`No world blueprint for session "${sessionId}".`);
    }
    const worldBlueprint = WorldBlueprintSchema.parse(blueprintData);

    const latestStateRecord = session.gameStates[0];
    if (!latestStateRecord) {
      throw new Error(`No game state for session "${sessionId}".`);
    }
    const playerState = PlayerStateSchema.parse(latestStateRecord.data);

    const candidate = worldBlueprint.endingCandidates.find((c) => c.id === endingId);
    if (!candidate) {
      throw new Error(`Ending candidate "${endingId}" not found in world blueprint.`);
    }

    const eligibility = this.endingArbitrator.checkEndingCandidate(candidate, playerState);
    if (!eligibility.allowed) {
      throw new Error(`Ending "${endingId}" is not eligible: ${eligibility.reason ?? 'requirements not met'}`);
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
      WorldBlueprintSchema.shape.endingCandidates.element,
      {
        sessionId,
        agentType: 'ending',
        promptName: 'ending_candidate',
      },
    );

    const summary = data.description;

    await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: 'ended' },
    });

    await this.auditService.logStateChange(sessionId, 'ending_triggered', {
      endingId,
      endingTitle: candidate.title,
    });

    return { endingId, summary };
  }

  async endSession(sessionId: string): Promise<{ id: string; status: string }> {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Game session "${sessionId}" not found.`);
    }

    const updated = await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: 'ended' },
    });

    this.logger.log(`Session "${sessionId}" ended.`);
    return { id: updated.id, status: updated.status };
  }

  async startDialogue(sessionId: string, npcId: string): Promise<{ npcId: string; phase: string }> {
    const session = await this.getSession(sessionId);
    if (session.status !== 'active') {
      throw new Error(`Session "${sessionId}" is not active.`);
    }

    const blueprintData = session.worldBlueprint?.data;
    if (!blueprintData) {
      throw new Error(`No world blueprint for session "${sessionId}".`);
    }
    const worldBlueprint = WorldBlueprintSchema.parse(blueprintData);

    const npc = worldBlueprint.npcs.find((n) => n.id === npcId);
    if (!npc) {
      throw new Error(`NPC "${npcId}" not found in world blueprint.`);
    }

    const latestStateRecord = session.gameStates[0];
    if (!latestStateRecord) {
      throw new Error(`No game state for session "${sessionId}".`);
    }
    const playerState = PlayerStateSchema.parse(latestStateRecord.data);

    const stateMachine = new GameStateMachine({
      phase: 'exploring',
      turn: playerState.age,
      playerState,
      worldBlueprint,
      pendingActions: [],
      safetyFlags: [],
    });

    if (!stateMachine.canTransition('talk')) {
      throw new Error(`Cannot start dialogue from current phase "${stateMachine.getPhase()}".`);
    }

    stateMachine.transition('talk');

    await this.auditService.logStateChange(sessionId, 'dialogue_started', {
      npcId,
      npcName: npc.name,
    });

    return { npcId, phase: 'dialoguing' };
  }

  async getState(sessionId: string): Promise<PlayerState> {
    const session = await this.getSession(sessionId);
    const latestStateRecord = session.gameStates[0];
    if (!latestStateRecord) {
      throw new Error(`No game state for session "${sessionId}".`);
    }
    return PlayerStateSchema.parse(latestStateRecord.data);
  }
}