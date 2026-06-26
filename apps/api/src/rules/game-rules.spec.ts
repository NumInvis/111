import {
  applyHardRules,
  clampAttributes,
  enforceLifespan,
  enforceRealmProgression,
  isRealmProgressValid,
} from './game-rules';
import { GameState } from '@variational-infinity/shared';

function makeState(overrides?: Partial<GameState['player']>): GameState {
  return {
    player: {
      name: '行者',
      age: 16,
      lifespan: 80,
      realm: '炼体',
      location: 'loc1',
      attributes: { 体魄: 10, 计算: 10 },
      discovered: [],
      relationships: {},
      history: '',
      ...overrides,
    },
    world: {
      name: '测试世界',
      conflict: '测试冲突',
      rules: [],
      attributes: [],
      locations: [],
      npcs: [],
      clues: [],
      endings: [],
    },
  };
}

describe('clampAttributes', () => {
  it('把超过 100 的属性截断为 100', () => {
    const state = makeState({ attributes: { 体魄: 150, 计算: 10 } });
    const next = clampAttributes(state);
    expect(next.player.attributes['体魄']).toBe(100);
    expect(next.player.attributes['计算']).toBe(10);
  });

  it('把低于 0 的属性提升为 0', () => {
    const state = makeState({ attributes: { 体魄: -20, 计算: 10 } });
    const next = clampAttributes(state);
    expect(next.player.attributes['体魄']).toBe(0);
    expect(next.player.attributes['计算']).toBe(10);
  });

  it('不修改原对象', () => {
    const state = makeState({ attributes: { 体魄: 150 } });
    const next = clampAttributes(state);
    expect(state.player.attributes['体魄']).toBe(150);
    expect(next.player.attributes['体魄']).toBe(100);
  });
});

describe('enforceLifespan', () => {
  it('年龄达到寿元时保持不变（由调用方把状态设为 died）', () => {
    const state = makeState({ age: 80, lifespan: 80 });
    const next = enforceLifespan(state);
    expect(next.player.age).toBe(80);
  });

  it('年龄未达寿元时不做修改', () => {
    const state = makeState({ age: 30, lifespan: 80 });
    const next = enforceLifespan(state);
    expect(next.player.age).toBe(30);
  });
});

describe('isRealmProgressValid', () => {
  it('同境界合法', () => {
    expect(isRealmProgressValid('炼体', '炼体')).toBe(true);
  });

  it('前进合法', () => {
    expect(isRealmProgressValid('炼体', '练气')).toBe(true);
    expect(isRealmProgressValid('练气', '渡劫')).toBe(true);
  });

  it('倒退非法', () => {
    expect(isRealmProgressValid('练气', '炼体')).toBe(false);
    expect(isRealmProgressValid('无限', '炼体')).toBe(false);
  });
});

describe('enforceRealmProgression', () => {
  it('境界倒退时被重置为之前的境界', () => {
    const state = makeState({ realm: '炼体' });
    const next = enforceRealmProgression(state, '练气');
    expect(next.player.realm).toBe('练气');
  });

  it('境界前进时保留', () => {
    const state = makeState({ realm: '练气' });
    const next = enforceRealmProgression(state, '炼体');
    expect(next.player.realm).toBe('练气');
  });
});

describe('applyHardRules', () => {
  it('综合应用所有硬规则', () => {
    const state = makeState({
      age: 80,
      lifespan: 80,
      realm: '炼体',
      attributes: { 体魄: 150, 计算: -10 },
    });
    const next = applyHardRules(state, '练气');
    expect(next.player.attributes['体魄']).toBe(100);
    expect(next.player.attributes['计算']).toBe(0);
    expect(next.player.age).toBe(80);
    expect(next.player.realm).toBe('练气');
  });
});
