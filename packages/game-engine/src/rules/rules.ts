import type {
  PlayerState,
  WorldBlueprint,
  EndingCandidate,
  ActionType,
  Attribute,
  Clue,
  TriggerCondition,
  RealmAdvancementRule,
} from '@variational-infinity/shared';
import { realmOrder, requireRealmOrder, REALM_NAMES_ORDERED } from '../constants/realm-constants';
import type { RealmName } from '@variational-infinity/shared';

export interface RuleCheckResult {
  allowed: boolean;
  reason?: string;
}

export class EndingArbitrator {
  checkEndingCandidate(
    candidate: EndingCandidate,
    playerState: PlayerState,
    worldBlueprint: WorldBlueprint,
  ): RuleCheckResult {
    for (const evidenceId of candidate.requiredEvidence) {
      if (!playerState.discoveredClues.includes(evidenceId)) {
        const clueExists = worldBlueprint.clues.some((c) => c.id === evidenceId);
        return {
          allowed: false,
          reason: `Missing required evidence: "${evidenceId}". ${clueExists ? 'This clue exists in the world but has not been discovered yet.' : 'This clue ID does not exist in the world blueprint.'}`,
        };
      }
    }

    if (candidate.requiredRealm) {
      const playerRealmIdx = realmOrder(playerState.realm);
      const requiredRealmIdx = requireRealmOrder(candidate.requiredRealm);
      if (playerRealmIdx < requiredRealmIdx) {
        return {
          allowed: false,
          reason: `Player realm "${playerState.realm}" does not meet required realm "${candidate.requiredRealm}". Current: order ${playerRealmIdx}, required: order ${requiredRealmIdx}.`,
        };
      }
    }

    return { allowed: true };
  }

  checkAllEndingCandidates(
    candidates: EndingCandidate[],
    playerState: PlayerState,
    worldBlueprint: WorldBlueprint,
  ): EndingCandidate[] {
    return candidates.filter((c) => this.checkEndingCandidate(c, playerState, worldBlueprint).allowed);
  }
}

export class ActionValidator {
  validateAction(
    worldBlueprint: WorldBlueprint,
    playerState: PlayerState,
    actionType: ActionType,
    payload: Record<string, unknown>,
  ): RuleCheckResult {
    const locationIds = worldBlueprint.locations.map((l) => l.id);
    const npcIds = worldBlueprint.npcs.map((n) => n.id);
    const clueIds = worldBlueprint.clues.map((c) => c.id);

    switch (actionType) {
      case 'move': {
        const targetId = payload.targetLocationId as string | undefined;
        if (!targetId) {
          return { allowed: false, reason: 'Move action requires targetLocationId in payload.' };
        }
        if (!locationIds.includes(targetId)) {
          return { allowed: false, reason: `Target location "${targetId}" does not exist in this world.` };
        }
        const currentLocation = worldBlueprint.locations.find(
          (l) => l.id === playerState.currentLocationId,
        );
        if (!currentLocation) {
          return { allowed: false, reason: `Current location "${playerState.currentLocationId}" not found in world.` };
        }
        if (!currentLocation.connections.includes(targetId)) {
          return { allowed: false, reason: `Location "${targetId}" is not connected to current location "${currentLocation.id}". Available connections: ${currentLocation.connections.join(', ')}.` };
        }
        return { allowed: true };
      }

      case 'talk': {
        const npcId = payload.npcId as string | undefined;
        if (!npcId) {
          return { allowed: false, reason: 'Talk action requires npcId in payload.' };
        }
        if (!npcIds.includes(npcId)) {
          return { allowed: false, reason: `NPC "${npcId}" does not exist in this world.` };
        }
        return { allowed: true };
      }

      case 'next_year': {
        return { allowed: true };
      }

      case 'discover': {
        const clueId = payload.clueId as string | undefined;
        const rumorId = payload.rumorId as string | undefined;
        if (!clueId && !rumorId) {
          return { allowed: false, reason: 'Discover action requires clueId or rumorId in payload.' };
        }
        if (clueId) {
          if (!clueIds.includes(clueId)) {
            return { allowed: false, reason: `Clue "${clueId}" does not exist in this world.` };
          }
          if (playerState.discoveredClues.includes(clueId)) {
            return { allowed: false, reason: `Clue "${clueId}" already discovered.` };
          }
        }
        if (rumorId) {
          const rumorIds = worldBlueprint.rumors.map((r) => r.id);
          if (!rumorIds.includes(rumorId)) {
            return { allowed: false, reason: `Rumor "${rumorId}" does not exist in this world.` };
          }
          if (playerState.discoveredRumors.includes(rumorId)) {
            return { allowed: false, reason: `Rumor "${rumorId}" already discovered.` };
          }
        }
        return { allowed: true };
      }

      case 'investigate': {
        return { allowed: true };
      }

      case 'event_choice': {
        const eventId = payload.eventId as string | undefined;
        const optionIndex = payload.optionIndex as number | undefined;
        if (!eventId) {
          return { allowed: false, reason: 'Event choice action requires eventId in payload.' };
        }
        if (optionIndex === undefined) {
          return { allowed: false, reason: 'Event choice action requires optionIndex in payload.' };
        }
        const event = worldBlueprint.events.find((e) => e.id === eventId);
        if (!event) {
          return { allowed: false, reason: `Event "${eventId}" does not exist in this world.` };
        }
        if (optionIndex < 0 || optionIndex >= event.options.length) {
          return { allowed: false, reason: `Option index ${optionIndex} out of range for event "${eventId}".` };
        }
        return { allowed: true };
      }

      case 'end_dialogue': {
        return { allowed: true };
      }

      case 'resolve_event': {
        return { allowed: true };
      }

      case 'attempt_breakthrough': {
        return { allowed: true };
      }

      default:
        return { allowed: false, reason: `Unknown action type: "${actionType}".` };
    }
  }
}

export class StateBoundsChecker {
  checkStateBounds(
    currentState: PlayerState,
    proposedUpdate: Partial<PlayerState>,
  ): RuleCheckResult {
    const merged = { ...currentState, ...proposedUpdate };

    if (merged.attributes) {
      for (const [key, value] of Object.entries(merged.attributes)) {
        if (typeof value !== 'number') {
          return { allowed: false, reason: `Attribute "${key}" must be a number, got ${typeof value}.` };
        }
        if (value < 0 || value > 100) {
          return { allowed: false, reason: `Attribute "${key}" value ${value} exceeds bounds [0, 100].` };
        }
      }
    }

    if (typeof merged.age === 'number' && merged.age < 0) {
      return { allowed: false, reason: `Age cannot be negative: ${merged.age}.` };
    }

    if (typeof merged.lifespan === 'number' && merged.lifespan <= 0) {
      return { allowed: false, reason: `Lifespan must be positive: ${merged.lifespan}.` };
    }

    const protectedFields = ['sessionId'] as const;
    for (const field of protectedFields) {
      if (field in proposedUpdate) {
        return { allowed: false, reason: `System field "${field}" cannot be modified.` };
      }
    }

    return { allowed: true };
  }
}

export class RealmAdvancementChecker {
  private advancementRules: RealmAdvancementRule[];

  constructor(advancementRules: RealmAdvancementRule[]) {
    this.advancementRules = advancementRules;
  }

  private findRule(fromRealm: string, toRealm: string): RealmAdvancementRule | undefined {
    return this.advancementRules.find(
      (r) => r.fromRealm === fromRealm && r.toRealm === toRealm,
    );
  }

  checkRealmAdvancement(
    currentRealm: RealmName,
    attributes: Attribute,
  ): RuleCheckResult {
    const currentIdx = realmOrder(currentRealm);
    const nextIdx = currentIdx + 1;

    if (nextIdx >= REALM_NAMES_ORDERED.length) {
      return {
        allowed: false,
        reason: `Already at maximum realm "${currentRealm}". No further advancement possible.`,
      };
    }

    const nextRealm = REALM_NAMES_ORDERED[nextIdx];
    const rule = this.findRule(currentRealm, nextRealm);

    if (!rule) {
      return {
        allowed: false,
        reason: `No advancement rule defined from "${currentRealm}" to "${nextRealm}".`,
      };
    }

    const failedAttributes: string[] = [];
    for (const [attrName, minRequired] of Object.entries(rule.requiredAttributes)) {
      const current = attributes[attrName];
      if (current === undefined || current < minRequired) {
        failedAttributes.push(`${attrName}: ${current ?? 0}/${minRequired}`);
      }
    }

    if (failedAttributes.length > 0) {
      return {
        allowed: false,
        reason: `Cannot advance to "${nextRealm}". Insufficient attributes: ${failedAttributes.join(', ')}.`,
      };
    }

    return {
      allowed: true,
      reason: `Eligible to advance from "${currentRealm}" to "${nextRealm}". All attribute thresholds met.`,
    };
  }

  getAdvancementRule(currentRealm: RealmName): RealmAdvancementRule | undefined {
    const currentIdx = realmOrder(currentRealm);
    const nextIdx = currentIdx + 1;
    if (nextIdx >= REALM_NAMES_ORDERED.length) return undefined;
    const nextRealm = REALM_NAMES_ORDERED[nextIdx];
    return this.findRule(currentRealm, nextRealm);
  }
}

export function evaluateTriggerCondition(
  condition: TriggerCondition,
  playerState: PlayerState,
): boolean {
  if (condition.minRealm) {
    const playerRealmIdx = realmOrder(playerState.realm);
    const requiredRealmIdx = requireRealmOrder(condition.minRealm);
    if (playerRealmIdx < requiredRealmIdx) return false;
  }
  if (condition.minAge !== undefined && playerState.age < condition.minAge) return false;
  if (condition.locationId && playerState.currentLocationId !== condition.locationId) return false;
  if (condition.discoveredNpcId && !playerState.discoveredNpcs.includes(condition.discoveredNpcId)) return false;
  if (condition.discoveredClueId && !playerState.discoveredClues.includes(condition.discoveredClueId)) return false;
  return true;
}

export { REALM_NAMES_ORDERED };
