import { GameState, RealmName, REALM_ORDER } from '@variational-infinity/shared';

export const ATTRIBUTE_MIN = 0;
export const ATTRIBUTE_MAX = 100;

export function clampAttributes(state: GameState): GameState {
  const next: GameState = {
    ...state,
    player: {
      ...state.player,
      attributes: { ...state.player.attributes },
    },
  };

  for (const [key, value] of Object.entries(next.player.attributes)) {
    next.player.attributes[key] = Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, value));
  }

  return next;
}

export function enforceLifespan(state: GameState): GameState {
  const next: GameState = {
    ...state,
    player: { ...state.player },
  };

  if (next.player.age >= next.player.lifespan) {
    next.player.age = next.player.lifespan;
  }

  return next;
}

export function isRealmProgressValid(from: RealmName, to: RealmName): boolean {
  const fromIdx = REALM_ORDER.indexOf(from);
  const toIdx = REALM_ORDER.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx >= fromIdx;
}

export function enforceRealmProgression(state: GameState, previousRealm: RealmName): GameState {
  const next: GameState = {
    ...state,
    player: { ...state.player },
  };

  if (!isRealmProgressValid(previousRealm, next.player.realm)) {
    next.player.realm = previousRealm;
  }

  return next;
}

export function applyHardRules(state: GameState, previousRealm: RealmName): GameState {
  let next = clampAttributes(state);
  next = enforceLifespan(next);
  next = enforceRealmProgression(next, previousRealm);
  return next;
}
