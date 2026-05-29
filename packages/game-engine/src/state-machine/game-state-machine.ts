import type {
  PlayerState,
  WorldBlueprint,
  ActionType,
  EndingCandidate,
  RealmName,
  TriggerCondition,
} from '@variational-infinity/shared';
import { evaluateTriggerCondition } from '../rules/rules';
import { REALM_ORDER, realmOrder, requireRealmOrder } from '../constants/realm-constants';

export type GamePhase =
  | 'initializing'
  | 'exploring'
  | 'dialoguing'
  | 'event'
  | 'ending_check'
  | 'ended'
  | 'death';

export interface GameStateSnapshot {
  phase: GamePhase;
  turn: number;
  playerState: PlayerState;
  worldBlueprint: WorldBlueprint;
  pendingActions: ActionType[];
  safetyFlags: string[];
}

export interface StateTransition {
  from: GamePhase;
  to: GamePhase;
  action: string;
  condition?: (snapshot: GameStateSnapshot) => boolean;
}

const TRANSITIONS: StateTransition[] = [
  {
    from: 'initializing',
    to: 'exploring',
    action: 'world_generated',
  },
  {
    from: 'exploring',
    to: 'dialoguing',
    action: 'talk',
  },
  {
    from: 'exploring',
    to: 'event',
    action: 'next_year',
  },
  {
    from: 'exploring',
    to: 'event',
    action: 'discover',
  },
  {
    from: 'exploring',
    to: 'event',
    action: 'investigate',
  },
  {
    from: 'exploring',
    to: 'event',
    action: 'event_choice',
  },
  {
    from: 'exploring',
    to: 'ending_check',
    action: 'attempt_breakthrough',
  },
  {
    from: 'exploring',
    to: 'ending_check',
    action: 'ending_candidate',
    condition: (snap) => hasSufficientEvidence(snap),
  },
  {
    from: 'dialoguing',
    to: 'exploring',
    action: 'end_dialogue',
  },
  {
    from: 'event',
    to: 'exploring',
    action: 'resolve_event',
  },
  {
    from: 'ending_check',
    to: 'exploring',
    action: 'continue',
  },
  {
    from: 'ending_check',
    to: 'ended',
    action: 'trigger_ending',
  },
  {
    from: 'exploring',
    to: 'death',
    action: 'death',
    condition: (snap) =>
      snap.playerState.age >= snap.playerState.lifespan ||
      snap.safetyFlags.includes('death_event'),
  },
];

function hasSufficientEvidence(snapshot: GameStateSnapshot): boolean {
  const candidates = snapshot.worldBlueprint.endingCandidates;
  return candidates.some(
    (c) =>
      c.requiredEvidence.every((id) =>
        snapshot.playerState.discoveredClues.includes(id),
      ) &&
      (!c.requiredRealm ||
        realmOrder(snapshot.playerState.realm) >=
          requireRealmOrder(c.requiredRealm)),
  );
}



export class GameStateMachine {
  private snapshot: GameStateSnapshot;

  constructor(initialSnapshot: GameStateSnapshot) {
    this.snapshot = initialSnapshot;
  }

  getCurrentState(): GameStateSnapshot {
    return this.snapshot;
  }

  getPhase(): GamePhase {
    return this.snapshot.phase;
  }

  canTransition(action: string): boolean {
    const matching = TRANSITIONS.filter(
      (t) =>
        t.from === this.snapshot.phase &&
        t.action === action,
    );

    if (matching.length === 0) return false;

    return matching.every(
      (t) => !t.condition || t.condition(this.snapshot),
    );
  }

  transition(action: string): GameStateSnapshot {
    const matching = TRANSITIONS.filter(
      (t) =>
        t.from === this.snapshot.phase &&
        t.action === action,
    );

    if (matching.length === 0) {
      throw new Error(
        `No valid transition from "${this.snapshot.phase}" with action "${action}".`,
      );
    }

    const transition = matching.find(
      (t) => !t.condition || t.condition(this.snapshot),
    );

    if (!transition) {
      throw new Error(
        `Transition condition not met for "${action}" from "${this.snapshot.phase}".`,
      );
    }

    this.snapshot = {
      ...this.snapshot,
      phase: transition.to,
    };

    return this.snapshot;
  }

  updatePlayerState(partial: Partial<PlayerState>): GameStateSnapshot {
    this.snapshot = {
      ...this.snapshot,
      playerState: { ...this.snapshot.playerState, ...partial },
    };
    return this.snapshot;
  }

  addSafetyFlag(flag: string): GameStateSnapshot {
    if (!this.snapshot.safetyFlags.includes(flag)) {
      this.snapshot = {
        ...this.snapshot,
        safetyFlags: [...this.snapshot.safetyFlags, flag],
      };
    }
    return this.snapshot;
  }

  getAvailableActions(): string[] {
    return TRANSITIONS
      .filter((t) => t.from === this.snapshot.phase)
      .filter((t) => !t.condition || t.condition(this.snapshot))
      .map((t) => t.action);
  }

  checkEndingCandidates(): EndingCandidate[] {
    const candidates = this.snapshot.worldBlueprint.endingCandidates;
    return candidates.filter(
      (c) =>
        c.requiredEvidence.every((id) =>
          this.snapshot.playerState.discoveredClues.includes(id),
        ) &&
        (!c.requiredRealm ||
          realmOrder(this.snapshot.playerState.realm) >=
            requireRealmOrder(c.requiredRealm)),
    );
  }

  getTriggerableEvents(): typeof this.snapshot.worldBlueprint.events {
    return this.snapshot.worldBlueprint.events.filter((e) =>
      evaluateTriggerCondition(e.triggerCondition as TriggerCondition, this.snapshot.playerState),
    );
  }
}

export { REALM_ORDER, realmOrder };