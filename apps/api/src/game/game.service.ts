import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { AuditService } from '../audit/audit.service';
import { SafetyService } from '../safety/safety.service';
import { AgentBridgeService } from '../agent-bridge/agent-bridge.service';
import {
  GameStateMachine,
  ActionValidator,
  EndingArbitrator,
  RealmAdvancementChecker,
  REALM_NAMES_ORDERED,
  applyMoveAction,
  applyTalkAction,
  applyNextYearAction,
  applyDiscoverAction,
  applyInvestigateAction,
  applyEventChoiceAction,
  applyEndDialogueAction,
  applyResolveEventAction,
  applyAttemptBreakthroughAction,
} from '@variational-infinity/game-engine';
import type { StateUpdate } from '@variational-infinity/game-engine';
import { z } from 'zod';
import {
  WorldBlueprintSchema,
  PlayerStateSchema,
  GameActionSchema,
  EventTypeEnum,
  JournalCategoryEnum,
  AttributeNameEnum,
} from '@variational-infinity/shared';
import type {
  WorldBlueprint,
  PlayerState,
  GameAction,
  ActionType,
  EndingCandidate,
  FriendshipLevel,
} from '@variational-infinity/shared';
import { PromptRegistryService } from '../llm/prompt-registry.service';

const NpcDialogueOutputSchema = z.object({
  role: z.string(),
  content: z.string(),
  metadata: z.object({
    emotion: z.string(),
    trustChange: z.number().min(-0.1).max(0.1),
    hintAtSecret: z.boolean().optional(),
    suggestedActions: z.array(z.string()).optional(),
  }).optional(),
});

const NPC_DIALOGUE_ALLOWED_FIELDS = ['role', 'content', 'metadata'];

const EndingOutputSchema = z.object({
  eligibleEndings: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    requiredEvidence: z.array(z.string()),
    requiredRealm: z.string().optional(),
    tone: z.string(),
    evidenceFulfilled: z.boolean(),
  })),
  ineligibleEndings: z.array(z.object({
    id: z.string(),
    reason: z.string(),
  })),
});

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly actionValidator = new ActionValidator();
  private readonly endingArbitrator = new EndingArbitrator();
  private readonly realmAdvancementChecker = new RealmAdvancementChecker();

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
    private readonly auditService: AuditService,
    private readonly safetyService: SafetyService,
    private readonly promptRegistryService: PromptRegistryService,
    private readonly agentBridgeService: AgentBridgeService,
    private readonly configService: ConfigService,
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
    if (stateUpdate.newState.attributes) {
      mergedState.attributes = { ...playerState.attributes, ...stateUpdate.newState.attributes };
    }
    if (stateUpdate.newState.discoveredClues) {
      mergedState.discoveredClues = [...playerState.discoveredClues, ...stateUpdate.newState.discoveredClues.filter((id) => !playerState.discoveredClues.includes(id))];
    }
    PlayerStateSchema.parse(mergedState);

    await this.prisma.$transaction([
      this.prisma.gameState.create({
        data: { sessionId, turn: mergedState.age, data: mergedState as object },
      }),
      ...stateUpdate.journalEntries.map((entry) =>
        this.prisma.journalEntry.create({
          data: {
            sessionId,
            turn: entry.turn,
            locationId: entry.locationId ?? undefined,
            action: entry.action,
            result: entry.result,
            evidenceTag: entry.evidenceTag ?? false,
            category: entry.category,
          },
        }),
      ),
      ...stateUpdate.events.map((event) =>
        this.prisma.worldEvent.create({
          data: { sessionId, eventType: event.eventType, data: event.data as object, turn: event.turn },
        }),
      ),
    ]);

    return mergedState;
  }

  private async recordGameTrace(sessionId: string, actionType: string, payload: Record<string, unknown>, mergedState: PlayerState, events: Array<{ eventType: string; data: Record<string, unknown>; turn: number }>): Promise<void> {
    await this.prisma.gameTrace.create({
      data: {
        sessionId,
        turn: mergedState.age,
        actionType,
        payload: payload as object,
        stateSnapshot: mergedState as object,
        events: events as object,
      },
    });
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
      case 'end_dialogue':
        stateUpdate = applyEndDialogueAction(sessionId, playerState, action.payload as { npcId?: string; trustChange?: number }, worldBlueprint);
        break;
      case 'resolve_event':
        stateUpdate = applyResolveEventAction(sessionId, playerState, action.payload as Record<string, unknown>, worldBlueprint);
        break;
      case 'attempt_breakthrough':
        stateUpdate = applyAttemptBreakthroughAction(sessionId, playerState, action.payload as Record<string, unknown>, worldBlueprint);
        break;
      default:
        throw new BadRequestException(`Unsupported action type: "${action.actionType}".`);
    }

    const mergedState = await this.persistStateUpdate(sessionId, playerState, stateUpdate);

    await this.auditService.logStateChange(sessionId, `action:${action.actionType}`, {
      actionType: action.actionType,
      turn: stateUpdate.newState.age ?? playerState.age,
    });

    await this.syncJournalToAgentMemory(sessionId, stateUpdate.journalEntries);

    await this.recordGameTrace(sessionId, action.actionType, action.payload as Record<string, unknown>, mergedState, stateUpdate.events);

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
        data: { status: 'death' },
      });
    }

    await this.auditService.logStateChange(sessionId, 'next_year', {
      newAge: mergedState.age,
      realm: mergedState.realm,
    });

    await this.syncJournalToAgentMemory(sessionId, stateUpdate.journalEntries);

    await this.recordGameTrace(sessionId, 'next_year', {}, mergedState, stateUpdate.events);

    return stateUpdate;
  }

  async checkEnding(sessionId: string): Promise<EndingCandidate[]> {
    const worldBlueprint = await this.loadWorldBlueprint(sessionId);
    const playerState = await this.loadPlayerState(sessionId);

    return this.endingArbitrator.checkAllEndingCandidates(
      worldBlueprint.endingCandidates, playerState, worldBlueprint,
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

    const eligibility = this.endingArbitrator.checkEndingCandidate(candidate, playerState, worldBlueprint);
    if (!eligibility.allowed) {
      throw new BadRequestException(`Ending "${endingId}" is not eligible: ${eligibility.reason ?? 'requirements not met'}`);
    }

    const useAgentBridge = this.configService.get<string>('USE_AGENT_BRIDGE', 'true') === 'true';
    let data: z.infer<typeof EndingOutputSchema>;

    if (useAgentBridge) {
      this.logger.log('Using Agent Service for ending evaluation candidate');
      const candidateRaw = await this.agentBridgeService.evaluateEndingCandidate({
        sessionId,
        discoveredEvidence: playerState.discoveredClues,
        journeySummary: playerState.historySummary,
        playerState: {
          age: playerState.age,
          realm: playerState.realm,
          attributes: playerState.attributes,
          currentLocationId: playerState.currentLocationId,
          discoveredClues: playerState.discoveredClues,
          discoveredNpcs: playerState.discoveredNpcs,
        },
      });

      const parseResult = EndingOutputSchema.safeParse(candidateRaw);
      if (!parseResult.success) {
        const errorDetails = parseResult.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        throw new Error(`Agent Service ending candidate schema validation failed: ${errorDetails}`);
      }
      data = parseResult.data;
    } else {
      this.logger.log('Using NestJS LLM for ending evaluation');
      const prompt = this.promptRegistryService.render('ending_candidate', {
        playerAge: String(playerState.age),
        playerRealm: playerState.realm,
        playerAttributes: JSON.stringify(playerState.attributes),
        discoveredClues: JSON.stringify(playerState.discoveredClues),
        discoveredNpcs: JSON.stringify(playerState.discoveredNpcs),
        historySummary: playerState.historySummary,
        worldConflict: worldBlueprint.worldProfile.coreConflict,
        endingCandidateIds: JSON.stringify(worldBlueprint.endingCandidates.map((c) => c.id)),
      });

      const { data: llmData } = await this.llmService.generateWithSchema(
        prompt,
        EndingOutputSchema,
        { sessionId, agentType: 'ending', promptName: 'ending_candidate' },
      );
      data = llmData;
    }

    const eligibleEnding = data.eligibleEndings.find((e) => e.id === endingId);
    const summary = eligibleEnding?.description ?? candidate.description;

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

    const npcMemories = await this.prisma.agentMemory.findMany({
      where: { npcId, sessionId },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    const memorySummary = npcMemories
      .map((m: { memoryType: string; content: string }) => `[${m.memoryType}] ${m.content}`)
      .join('\n');

    const useAgentBridge = this.configService.get<string>('USE_AGENT_BRIDGE', 'true') === 'true';
    let data: z.infer<typeof NpcDialogueOutputSchema>;

    if (useAgentBridge) {
      this.logger.log('Using Agent Service for NPC dialogue candidate');
      const candidateRaw = await this.agentBridgeService.generateNpcDialogueCandidate({
        sessionId,
        npcId,
        playerInput: playerMessage,
        currentLocationId: playerState.currentLocationId,
        npcContext: {
          name: npc.name,
          role: npc.role,
          personality: npc.personality,
          goal: npc.goal,
          secret: npc.secret,
          forbiddenTopics: npc.forbiddenTopics,
          dialogueStyle: npc.dialogueStyle,
          cultivationLevel: npc.cultivationLevel,
          mathematicalStrength: npc.mathematicalStrength,
          trustLevel: npc.trustLevel,
          memorySummary,
        },
      });

      const parseResult = NpcDialogueOutputSchema.safeParse(candidateRaw);
      if (!parseResult.success) {
        const errorDetails = parseResult.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        throw new Error(`Agent Service NPC dialogue candidate schema validation failed: ${errorDetails}`);
      }
      data = parseResult.data;
    } else {
      this.logger.log('Using NestJS LLM for NPC dialogue');
      const prompt = this.promptRegistryService.render('npc_dialogue', {
        npcName: npc.name,
        npcRole: npc.role,
        npcPersonality: npc.personality.join(', '),
        npcGoal: npc.goal,
        npcSecret: npc.secret,
        npcForbiddenTopics: npc.forbiddenTopics.join(', '),
        npcDialogueStyle: npc.dialogueStyle,
        npcRealm: npc.cultivationLevel ?? 'unknown',
        npcMathStrength: npc.mathematicalStrength ?? 'unknown',
        playerRealm: playerState.realm,
        playerAttributes: JSON.stringify(playerState.attributes),
        playerMessage,
        npcMemorySummary: memorySummary || 'No prior memories of this NPC.',
      });

      const { data: llmData } = await this.llmService.generateWithSchema(
        prompt,
        NpcDialogueOutputSchema,
        { sessionId, agentType: 'npc', promptName: 'npc_dialogue', temperature: 0.8 },
      );
      data = llmData;
    }

    const outputSafetyResult = this.safetyService.fullOutputCheck(
      data,
      NPC_DIALOGUE_ALLOWED_FIELDS,
      undefined,
      { npcIds: [npcId] },
    );
    if (!outputSafetyResult.safe) {
      await this.auditService.logSafetyEvent(sessionId, 'output_safety_violation', 'high', {
        errors: outputSafetyResult.errors,
      });
      throw new BadRequestException(`NPC dialogue output safety check failed: ${outputSafetyResult.errors?.join('; ') ?? 'unknown'}`);
    }

    const metadata = data.metadata ?? { emotion: 'neutral', trustChange: 0 };
    const emotion = metadata.emotion ?? 'neutral';
    const trustChange = metadata.trustChange ?? 0;

    const trustBefore = playerState.relationships?.[npcId]?.trust ?? npc.trustLevel ?? 0.3;
    const trustAfter = Math.max(0, Math.min(1, trustBefore + trustChange));

    const friendshipLevel: FriendshipLevel = trustAfter >= 0.7 ? 'confidant' : trustAfter >= 0.5 ? 'friend' : trustAfter >= 0.3 ? 'acquaintance' : 'stranger';
    const updatedRelationships: Record<string, { npcId: string; trust: number; friendshipLevel: FriendshipLevel; lastInteractionTurn: number }> = {
      ...playerState.relationships,
      [npcId]: {
        npcId,
        trust: trustAfter,
        friendshipLevel,
        lastInteractionTurn: playerState.age,
      },
    };

    const updatedPlayerState: PlayerState = {
      ...playerState,
      relationships: updatedRelationships,
    };

    PlayerStateSchema.parse(updatedPlayerState);

    await this.prisma.$transaction([
      this.prisma.dialogueMessage.create({
        data: {
          sessionId,
          npcId,
          role: data.role,
          content: data.content,
          metadata: metadata as object,
          turn: playerState.age,
          trustBefore,
          trustAfter,
        },
      }),
      this.prisma.gameState.create({
        data: {
          sessionId,
          turn: playerState.age,
          data: updatedPlayerState as object,
        },
      }),
    ]);

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

  async getBreakthroughStatus(sessionId: string): Promise<{ canAttempt: boolean; nextRealm: string | null; reason: string }> {
    const worldBlueprint = await this.loadWorldBlueprint(sessionId);
    const playerState = await this.loadPlayerState(sessionId);

    const result = this.realmAdvancementChecker.checkRealmAdvancement(
      playerState.realm,
      playerState.attributes,
    );

    if (result.allowed) {
      const currentIdx = REALM_NAMES_ORDERED.indexOf(playerState.realm);
      const nextRealm = REALM_NAMES_ORDERED[currentIdx + 1] ?? null;
      return { canAttempt: true, nextRealm, reason: result.reason ?? '' };
    }

    return { canAttempt: false, nextRealm: null, reason: result.reason ?? '' };
  }

  private async syncJournalToAgentMemory(sessionId: string, journalEntries: Array<{ turn: number; action: string; result: string; locationId?: string; category: string; evidenceTag?: boolean }>): Promise<void> {
    const useAgentBridge = this.configService.get<string>('USE_AGENT_BRIDGE', 'true') === 'true';
    if (!useAgentBridge || journalEntries.length === 0) return;

    const rawContent = journalEntries
      .map((entry) => `[Turn ${entry.turn}] ${entry.action}: ${entry.result}`)
      .join('\n');

    const npcIds = new Set<string>();
    for (const entry of journalEntries) {
      if (entry.action === 'talk' || entry.action === 'dialogue_message') {
        const match = entry.result.match(/NPC[:\s]+([a-zA-Z0-9_-]+)/);
        if (match) npcIds.add(match[1]);
      }
    }

    try {
      for (const npcId of npcIds) {
        const summaries = await this.agentBridgeService.summarizeMemory(npcId, rawContent);
        for (const summary of summaries) {
          await this.prisma.agentMemory.create({
            data: {
              npcId,
              sessionId,
              memoryType: (summary as Record<string, unknown>).memoryType as string ?? 'reflection',
              content: (summary as Record<string, unknown>).content as string,
              importance: (summary as Record<string, unknown>).importance as number ?? 0.5,
              source: 'journal',
            },
          });
        }
      }

      if (npcIds.size === 0) {
        const summaries = await this.agentBridgeService.summarizeMemory('world', rawContent);
        for (const summary of summaries) {
          await this.prisma.agentMemory.create({
            data: {
              npcId: 'world',
              sessionId,
              memoryType: (summary as Record<string, unknown>).memoryType as string ?? 'observation',
              content: (summary as Record<string, unknown>).content as string,
              importance: (summary as Record<string, unknown>).importance as number ?? 0.5,
              source: 'journal',
            },
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Agent memory sync skipped for session ${sessionId}: ${message}`);
    }
  }

  async getAgentMemory(sessionId: string): Promise<Record<string, unknown>[]> {
    const memories = await this.prisma.agentMemory.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
    return memories.map((m: { id: string; npcId: string; sessionId: string | null; memoryType: string; content: string; importance: number; source: string; createdAt: Date }) => ({
      id: m.id,
      npcId: m.npcId,
      sessionId: m.sessionId ?? '',
      memoryType: m.memoryType,
      content: m.content,
      importance: m.importance,
      source: m.source,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async storeAgentMemory(sessionId: string, body: { npcId: string; memoryType: string; content: string; importance: number; source: string }): Promise<Record<string, unknown>> {
    const memory = await this.prisma.agentMemory.create({
      data: {
        npcId: body.npcId,
        sessionId,
        memoryType: body.memoryType,
        content: body.content,
        importance: body.importance,
        source: body.source,
      },
    });
    return {
      id: memory.id,
      npcId: memory.npcId,
      sessionId: memory.sessionId,
      memoryType: memory.memoryType,
      content: memory.content,
      importance: memory.importance,
      source: memory.source,
      createdAt: memory.createdAt.toISOString(),
    };
  }

  async getGameTrace(sessionId: string): Promise<Record<string, unknown>[]> {
    const traces = await this.prisma.gameTrace.findMany({
      where: { sessionId },
      orderBy: { turn: 'asc' },
    });
    return traces.map((t: { id: string; sessionId: string; turn: number; actionType: string; payload: unknown; stateSnapshot: unknown; events: unknown; createdAt: Date }) => ({
      id: t.id,
      sessionId: t.sessionId,
      turn: t.turn,
      actionType: t.actionType,
      payload: t.payload as Record<string, unknown>,
      stateSnapshot: t.stateSnapshot as Record<string, unknown>,
      events: t.events as Record<string, unknown>[],
      createdAt: t.createdAt.toISOString(),
    }));
  }
}