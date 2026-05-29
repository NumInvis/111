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
  REALM_ADVANCEMENT_THRESHOLDS,
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