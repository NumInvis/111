export {
  GameStateMachine,
  endingArbitrator,
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
  applyRealmAdvancement,
  type StateUpdate,
} from './reducers/index';