import type {
  ApiResponse,
  WorldBlueprint,
  GenerationPreferences,
  GenerationScale,
  GenerationMode,
  PlayerState,
  StateUpdate,
  EndingCandidate,
} from '@/types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function fetchApi<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new Error(`API ${res.status}: ${text}`)
  }
  const wrapper = await res.json() as ApiResponse<T>
  if (!wrapper.success) {
    throw new Error(wrapper.error ?? 'API returned unsuccessful')
  }
  return wrapper
}

export async function createSession(userId?: string): Promise<{ id: string; status: string }> {
  const res = await fetchApi<{ id: string; status: string }>('/game/sessions', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
  return res.data!
}

export async function getSession(id: string) {
  const res = await fetchApi<Record<string, unknown>>(`/game/sessions/${id}`)
  return res.data
}

export async function getGameState(id: string): Promise<PlayerState> {
  const res = await fetchApi<PlayerState>(`/game/sessions/${id}/state`)
  return res.data!
}

export async function applyAction(
  sessionId: string,
  actionType: string,
  payload: Record<string, unknown>,
): Promise<StateUpdate> {
  const res = await fetchApi<StateUpdate>(`/game/sessions/${sessionId}/actions`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, actionType, payload, turn: 0 }),
  })
  return res.data!
}

export async function generateWorld(
  sessionId: string,
  preferences: GenerationPreferences,
): Promise<WorldBlueprint> {
  const res = await fetchApi<WorldBlueprint>(`/generation/world/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify(preferences),
  })
  return res.data!
}

export async function getWorldBlueprint(sessionId: string): Promise<WorldBlueprint | null> {
  const res = await fetchApi<WorldBlueprint>(`/generation/world/${sessionId}`)
  return res.data ?? null
}

export async function nextYear(sessionId: string): Promise<StateUpdate> {
  const res = await fetchApi<StateUpdate>(`/game/sessions/${sessionId}/next-year`, {
    method: 'POST',
  })
  return res.data!
}

export async function startDialogue(
  sessionId: string,
  npcId: string,
): Promise<{ npcId: string; phase: string }> {
  const res = await fetchApi<{ npcId: string; phase: string }>(`/game/sessions/${sessionId}/dialogue`, {
    method: 'POST',
    body: JSON.stringify({ npcId }),
  })
  return res.data!
}



export async function checkEndings(sessionId: string): Promise<EndingCandidate[]> {
  const res = await fetchApi<EndingCandidate[]>(`/game/sessions/${sessionId}/endings`)
  return res.data ?? []
}

export async function endSession(sessionId: string): Promise<{ id: string; status: string }> {
  const res = await fetchApi<{ id: string; status: string }>(`/game/sessions/${sessionId}/end`, {
    method: 'POST',
  })
  return res.data!
}

const SCALE_MAP: Record<string, GenerationScale> = {
  '快速模式': 'small',
  '完整模式': 'medium',
  '无限模式': 'large',
}

const MODE_MAP: Record<string, GenerationMode> = {
  '快速模式': 'quick',
  '完整模式': 'complete',
  '无限模式': 'infinite',
}

export function toGenPref(pref: { direction: string; mode: string; seed?: number }): GenerationPreferences {
  return {
    theme: pref.direction,
    scale: SCALE_MAP[pref.mode] ?? 'medium',
    tone: pref.direction,
    seed: pref.seed,
    mode: MODE_MAP[pref.mode] ?? 'complete',
  }
}

export async function getProviders(): Promise<{ active: string; available: string[] }> {
  const res = await fetchApi<{ active: string; available: string[] }>('/llm/providers')
  return res.data!
}