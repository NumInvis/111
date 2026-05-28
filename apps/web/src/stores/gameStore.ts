import { create } from 'zustand'
import { produce } from 'immer'
import type {
  WorldPreference,
  WorldBlueprint,
  PlayerState,
  JournalEntry,
  DialogueMessage,
  EventSeed,
  EndingCandidate,
} from '@/types'



 interface GameState {
  sessionId: string | null
  preference: WorldPreference | null
  worldBlueprint: WorldBlueprint | null
  player: PlayerState | null
  currentYear: number
  journal: JournalEntry[]
  messages: Record<string, DialogueMessage[]>
  activeEvent: EventSeed | null
  availableEndings: EndingCandidate[]
  phase: 'initializing' | 'exploring' | 'dialoguing' | 'event' | 'ending_check' | 'ended' | 'death'
  error: string | null
  loading: boolean
  setSessionId: (id: string | null) => void
  setPreference: (p: WorldPreference) => void
  setWorldBlueprint: (wb: WorldBlueprint | null) => void
  setPlayer: (p: PlayerState | null) => void
  setCurrentYear: (y: number) => void
  addJournalEntries: (entries: JournalEntry[]) => void
  addMessage: (npcId: string, msg: DialogueMessage) => void
  setActiveEvent: (e: EventSeed | null) => void
  setAvailableEndings: (endings: EndingCandidate[]) => void
  setPhase: (p: GameState['phase']) => void
  setError: (e: string | null) => void
  setLoading: (l: boolean) => void
  reset: () => void
}

 export const useGameStore = create<GameState>((set) => ({
  sessionId: null,
  preference: null,
  worldBlueprint: null,
  player: null,
  currentYear: 16,
  journal: [],
  messages: {},
  activeEvent: null,
  availableEndings: [],
  phase: 'initializing',
  error: null,
  loading: false,
  setSessionId: (id) => set(produce((draft) => { draft.sessionId = id })),
  setPreference: (p) => set(produce((draft) => { draft.preference = p })),
  setWorldBlueprint: (wb) => set(produce((draft) => { draft.worldBlueprint = wb })),
  setPlayer: (p) => set(produce((draft) => { draft.player = p })),
  setCurrentYear: (y) => set(produce((draft) => { draft.currentYear = y })),
  addJournalEntries: (entries) => set(produce((draft) => {
    for (const entry of entries) {
      const existing = draft.journal.find((j: JournalEntry) => j.id === entry.id)
      if (!existing) draft.journal.unshift(entry)
    }
  })),
  addMessage: (npcId, msg) => set(produce((draft) => {
    if (!draft.messages[npcId]) draft.messages[npcId] = []
    draft.messages[npcId].push(msg)
  })),
  setActiveEvent: (e) => set(produce((draft) => { draft.activeEvent = e })),
  setAvailableEndings: (endings) => set(produce((draft) => { draft.availableEndings = endings })),
  setPhase: (p) => set(produce((draft) => { draft.phase = p })),
  setError: (e) => set(produce((draft) => { draft.error = e })),
  setLoading: (l) => set(produce((draft) => { draft.loading = l })),
  reset: () => set({
    sessionId: null,
    preference: null,
    worldBlueprint: null,
    player: null,
    currentYear: 16,
    journal: [],
    messages: {},
    activeEvent: null,
    availableEndings: [],
    phase: 'initializing',
    error: null,
    loading: false,
  }),
}))