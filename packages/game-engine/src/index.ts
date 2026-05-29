export {
  GameStateMachine,
  REALM_ORDER,
  realmOrder,
  type GamePhase,
  type GameStateSnapshot,
  type StateTransition,
} from './state-machine/index';

export {
  EndingArbitrator,
  ActionValidator,
  StateBoundsChecker,
  RealmAdvancementChecker,
  type RuleCheckResult,
  evaluateTriggerCondition,
  REALM_NAMES_ORDERED,
} from './rules/index';

export {
  applyMoveAction,
  applyTalkAction,
  applyNextYearAction,
  applyDiscoverAction,
  applyInvestigateAction,
  applyEventChoiceAction,
  applyEndDialogueAction,
  applyResolveEventAction,
  applyAttemptBreakthroughAction,
  applyRealmAdvancement,
  type StateUpdate,
} from './reducers/index';

export {
  replayTrace,
  type TraceEntry,
  type ReplayResult,
} from './harness/replay';

export {
  WORLD_BOOK,
  getWorldBookEntry,
  getMathLevel,
  isBoundaryWall,
  isUntouchable,
  isLowerRealm,
  isUpperRealm,
  formatWorldBookForPrompt,
  type WorldBookEntry,
} from './constants/world-book';