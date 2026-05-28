import type {
  PlayerState,
  WorldBlueprint,
  EndingCandidate,
  ActionType,
  Attribute,
} from '@variational-infinity/shared';
import { realmOrder, REALM_ORDER } from '../state-machine/game-state-machine';
import type { RealmName } from '@variational-infinity/shared';

export interface RuleCheckResult {
  allowed: boolean;
  reason?: string;
}

const REALM_ADVANCEMENT_THRESHOLDS: Record<string, Partial<Attribute>> = {
  '炼体': {},
  '练气': { calculation: 10, focus: 10, body: 10 },
  '筑基': { calculation: 20, geometry: 10, focus: 15, body: 15 },
  '本元': { calculation: 30, geometry: 20, abstraction: 15, focus: 20 },
  '通明': { calculation: 40, geometry: 30, abstraction: 25, proof: 15, intuition: 10 },
  '化神': { calculation: 50, geometry: 40, abstraction: 35, proof: 25, intuition: 20, focus: 30 },
  '归一': { calculation: 60, geometry: 50, abstraction: 45, proof: 35, intuition: 30, focus: 40 },
  '渡劫': { calculation: 70, geometry: 60, abstraction: 55, proof: 45, intuition: 40, focus: 50, body: 40 },
  '天门': { calculation: 80, geometry: 70, abstraction: 65, proof: 55, intuition: 50, focus: 60, body: 50 },
  '仙境': { calculation: 85, geometry: 75, abstraction: 70, proof: 60, intuition: 55, focus: 65, body: 55 },
  '圣境': { calculation: 90, geometry: 80, abstraction: 75, proof: 65, intuition: 60, focus: 70, body: 60 },
  '变分境': { calculation: 95, geometry: 85, abstraction: 80, proof: 70, intuition: 65, focus: 75 },
  '天道境': { calculation: 98, geometry: 90, abstraction: 85, proof: 75, intuition: 70, focus: 80 },
  '无限': { calculation: 100, geometry: 100, abstraction: 100, proof: 100, intuition: 100, focus: 100 },
};

export class EndingArbitrator {
  checkEndingCandidate(
    candidate: EndingCandidate,
    playerState: PlayerState,
  ): RuleCheckResult {
    for (const evidenceId of candidate.requiredEvidence) {
      if (!playerState.discoveredClues.includes(evidenceId)) {
        return {
          allowed: false,
          reason: `Missing required evidence: "${evidenceId}". Player has not discovered this clue.`,
        };
      }
    }

    if (candidate.requiredRealm) {
      const playerRealmIdx = realmOrder(playerState.realm);
      const requiredRealmIdx = realmOrder(candidate.requiredRealm as RealmName);
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
  ): EndingCandidate[] {
    return candidates.filter((c) => this.checkEndingCandidate(c, playerState).allowed);
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
        const npc = worldBlueprint.npcs.find((n) => n.id === npcId);
        if (!npc) {
          return { allowed: false, reason: `NPC "${npcId}" not found.` };
        }
        if (npc.faction) {
          const factionIds = worldBlueprint.factions.map((f) => f.id);
          if (!factionIds.includes(npc.faction)) {
            return { allowed: false, reason: `NPC "${npcId}" references faction "${npc.faction}" which does not exist.` };
          }
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
        if (clueId && playerState.discoveredClues.includes(clueId)) {
          return { allowed: false, reason: `Clue "${clueId}" already discovered.` };
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

      case 'rest': {
        return { allowed: true };
      }

      case 'trade': {
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

const REALM_NAMES_ORDERED: RealmName[] = Object.keys(REALM_ORDER) as RealmName[];

export class RealmAdvancementChecker {
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
    const thresholds = REALM_ADVANCEMENT_THRESHOLDS[nextRealm];

    if (!thresholds) {
      return {
        allowed: false,
        reason: `No advancement thresholds defined for realm "${nextRealm}".`,
      };
    }

    const failedAttributes: string[] = [];
    for (const [attrName, minRequired] of Object.entries(thresholds)) {
      const current = attributes[attrName as keyof Attribute];
      if (current < minRequired) {
        failedAttributes.push(`${attrName}: ${current}/${minRequired}`);
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
}

export { REALM_ADVANCEMENT_THRESHOLDS, REALM_NAMES_ORDERED };