import { applyMoveAction, applyTalkAction, applyNextYearAction, applyDiscoverAction, applyInvestigateAction, applyEventChoiceAction, applyEndDialogueAction, applyResolveEventAction, applyAttemptBreakthroughAction } from '../reducers/reducers';
import type { StateUpdate } from '../reducers/reducers';
import type { PlayerState, WorldBlueprint } from '@variational-infinity/shared';
import { PlayerStateSchema, WorldBlueprintSchema } from '@variational-infinity/shared';

export interface TraceEntry {
  turn: number;
  actionType: string;
  payload: Record<string, unknown>;
  stateSnapshot: Record<string, unknown>;
  events: Record<string, unknown>[];
}

export interface ReplayResult {
  matched: boolean;
  mismatches: Array<{ turn: number; field: string; expected: unknown; actual: unknown }>;
  errors: Array<{ turn: number; actionType: string; error: string }>;
}

type ReducerFn = (sessionId: string, playerState: PlayerState, payload: Record<string, unknown>, worldBlueprint: WorldBlueprint) => StateUpdate;

const REDUCER_MAP: Record<string, ReducerFn> = {
  move: applyMoveAction as ReducerFn,
  talk: applyTalkAction as ReducerFn,
  next_year: applyNextYearAction as ReducerFn,
  discover: applyDiscoverAction as ReducerFn,
  investigate: applyInvestigateAction as ReducerFn,
  event_choice: applyEventChoiceAction as ReducerFn,
  end_dialogue: applyEndDialogueAction as ReducerFn,
  resolve_event: applyResolveEventAction as ReducerFn,
  attempt_breakthrough: applyAttemptBreakthroughAction as ReducerFn,
};

export function replayTrace(trace: TraceEntry[], worldBlueprintRaw: Record<string, unknown>): ReplayResult {
  const wbParse = WorldBlueprintSchema.safeParse(worldBlueprintRaw);
  if (!wbParse.success) {
    return { matched: false, mismatches: [], errors: [{ turn: 0, actionType: 'init', error: `WorldBlueprint schema invalid: ${wbParse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` }] };
  }
  const worldBlueprint = wbParse.data as WorldBlueprint;

  const mismatches: Array<{ turn: number; field: string; expected: unknown; actual: unknown }> = [];
  const errors: Array<{ turn: number; actionType: string; error: string }> = [];

  let initialized = false;
  let currentPlayer: PlayerState | null = null;

  for (const entry of trace) {
    if (!initialized) {
      const psParse = PlayerStateSchema.safeParse(entry.stateSnapshot);
      if (!psParse.success) {
        errors.push({ turn: entry.turn, actionType: entry.actionType, error: 'Initial state schema invalid' });
        break;
      }
      currentPlayer = psParse.data as PlayerState;
      initialized = true;
      continue;
    }

    const current = currentPlayer!;
    const reducer = REDUCER_MAP[entry.actionType];
    if (!reducer) {
      errors.push({ turn: entry.turn, actionType: entry.actionType, error: `Unknown action type: ${entry.actionType}` });
      continue;
    }

    try {
      const sessionId = 'replay';
      const stateUpdate = reducer(sessionId, current, entry.payload, worldBlueprint);
      const actualState: PlayerState = { ...current, ...stateUpdate.newState };
      if (stateUpdate.newState.attributes) {
        actualState.attributes = { ...current.attributes, ...stateUpdate.newState.attributes };
      }
      if (stateUpdate.newState.discoveredClues) {
        actualState.discoveredClues = [...current.discoveredClues, ...stateUpdate.newState.discoveredClues.filter((id) => !current.discoveredClues.includes(id))];
      }
      if (stateUpdate.newState.discoveredLocations) {
        actualState.discoveredLocations = [...current.discoveredLocations, ...stateUpdate.newState.discoveredLocations.filter((id) => !current.discoveredLocations.includes(id))];
      }
      if (stateUpdate.newState.discoveredNpcs) {
        actualState.discoveredNpcs = [...current.discoveredNpcs, ...stateUpdate.newState.discoveredNpcs.filter((id) => !current.discoveredNpcs.includes(id))];
      }
      if (stateUpdate.newState.discoveredRumors) {
        actualState.discoveredRumors = [...current.discoveredRumors, ...stateUpdate.newState.discoveredRumors.filter((id) => !current.discoveredRumors.includes(id))];
      }
      if (stateUpdate.relationships) {
        actualState.relationships = { ...current.relationships, ...stateUpdate.relationships };
      }

      const expectedParse = PlayerStateSchema.safeParse(entry.stateSnapshot);
      if (expectedParse.success) {
        const expected = expectedParse.data as PlayerState;
        for (const key of Object.keys(expected)) {
          if (JSON.stringify((expected as Record<string, unknown>)[key]) !== JSON.stringify((actualState as Record<string, unknown>)[key])) {
            mismatches.push({ turn: entry.turn, field: key, expected: (expected as Record<string, unknown>)[key], actual: (actualState as Record<string, unknown>)[key] });
          }
        }
      }

      currentPlayer = actualState;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ turn: entry.turn, actionType: entry.actionType, error: message });
    }
  }

  return { matched: mismatches.length === 0 && errors.length === 0, mismatches, errors };
}