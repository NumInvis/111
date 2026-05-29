import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { Tag } from '@/components/ui/Tag'
import { EventCard } from '@/components/ui/EventCard'
import { StatusPanel } from '@/components/ui/StatusPanel'
import { Card } from '@/components/ui/Card'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Scroll, Calendar, MapPin, Loader2, Zap } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { nextYear, applyAction, checkEndings } from '@/lib/api'
import type { PlayerState, TriggerCondition } from '@/types'
import { REALMS } from '@/types'

function evaluateTrigger(condition: TriggerCondition, player: PlayerState): boolean {
  if (condition.minAge !== undefined && player.age < condition.minAge) return false
  if (condition.minRealm && REALMS.indexOf(player.realm as any) < REALMS.indexOf(condition.minRealm as any)) return false
  if (condition.discoveredNpcId && !player.discoveredNpcs.includes(condition.discoveredNpcId)) return false
  if (condition.discoveredClueId && !player.discoveredClues.includes(condition.discoveredClueId)) return false
  if (condition.locationId && player.currentLocationId !== condition.locationId) return false
  return true
}

export const Route = createFileRoute('/explore')({
  component: ExplorePage,
})

function ExplorePage() {
  const {
    sessionId, player, worldBlueprint, currentYear,
    activeEvent, availableEndings,
    setPlayer, setCurrentYear, addJournalEntries,
    setActiveEvent, setAvailableEndings, setPhase,
  } = useGameStore()

  const [isAdvancing, setIsAdvancing] = useState(false)
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [breakthroughHint, setBreakthroughHint] = useState<string | null>(null)

  const currentLocation = worldBlueprint?.locations.find(
    (l) => l.id === player?.currentLocationId,
  ) ?? null

  const nearbyNpcs = worldBlueprint?.npcs.filter((n) =>
    player?.discoveredNpcs.includes(n.id) || n.trustLevel >= 0.5 || worldBlueprint!.clues.some((c) => c.npcId === n.id && c.locationId === player?.currentLocationId)
  ) ?? []

  const locationClues = worldBlueprint?.clues.filter(
    (c) => c.locationId === player?.currentLocationId && !player?.discoveredClues.includes(c.id),
  ) ?? []

  const triggerableEvents = worldBlueprint?.events.filter((e) =>
    evaluateTrigger(e.triggerCondition, player!) && e.locationId === player?.currentLocationId,
  ) ?? []

  const visibleRumors = worldBlueprint?.rumors.filter((r) =>
    player?.discoveredRumors.includes(r.id) || r.relatedLocation === player?.currentLocationId,
  ) ?? []

  function mergeState(base: PlayerState, update: Partial<PlayerState>): PlayerState {
    const merged = { ...base, ...update } as PlayerState
    if (update.attributes) merged.attributes = { ...base.attributes, ...update.attributes }
    if (update.discoveredClues) merged.discoveredClues = [...base.discoveredClues, ...update.discoveredClues.filter(id => !base.discoveredClues.includes(id))]
    if (update.discoveredNpcs) merged.discoveredNpcs = [...base.discoveredNpcs, ...update.discoveredNpcs.filter(id => !base.discoveredNpcs.includes(id))]
    if (update.discoveredLocations) merged.discoveredLocations = [...base.discoveredLocations, ...update.discoveredLocations.filter(id => !base.discoveredLocations.includes(id))]
    if (update.discoveredRumors) merged.discoveredRumors = [...base.discoveredRumors, ...update.discoveredRumors.filter(id => !base.discoveredRumors.includes(id))]
    if (update.relationships) merged.relationships = { ...base.relationships, ...update.relationships }
    return merged
  }

  const handleNextYear = async () => {
    if (!sessionId || !player) return
    setError(null)
    setIsAdvancing(true)
    try {
      const update = await nextYear(sessionId)
      const merged = mergeState(player, update.newState)
      setPlayer(merged)
      setCurrentYear(merged.age)
      addJournalEntries(update.journalEntries)

      if (update.hints && update.hints.length > 0) {
        setBreakthroughHint(update.hints[0])
      } else {
        setBreakthroughHint(null)
      }

      const triggerable = worldBlueprint!.events.filter((e) =>
        evaluateTrigger(e.triggerCondition, merged) && e.locationId === merged.currentLocationId,
      )

      if (triggerable.length > 0) {
        setActiveEvent(triggerable[0])
      }

      if (merged.age >= merged.lifespan) {
        setPhase('death')
      }

      try {
        const endings = await checkEndings(sessionId)
        if (endings.length > 0) setAvailableEndings(endings)
      } catch {
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '推进失败')
    } finally {
      setIsAdvancing(false)
    }
  }

  const handleMove = async (targetLocationId: string) => {
    if (!sessionId || !player) return
    setError(null)
    setIsActing(true)
    try {
      const update = await applyAction(sessionId, 'move', { targetLocationId }, currentYear)
      const merged = mergeState(player, update.newState)
      setPlayer(merged)
      addJournalEntries(update.journalEntries)
    } catch (err) {
      setError(err instanceof Error ? err.message : '移动失败')
    } finally {
      setIsActing(false)
    }
  }

  const handleDiscoverClue = async (clueId: string) => {
    if (!sessionId || !player) return
    setError(null)
    setIsActing(true)
    try {
      const update = await applyAction(sessionId, 'discover', { clueId }, currentYear)
      const merged = mergeState(player, update.newState)
      setPlayer(merged)
      addJournalEntries(update.journalEntries)
    } catch (err) {
      setError(err instanceof Error ? err.message : '探索失败')
    } finally {
      setIsActing(false)
    }
  }

  const handleDiscoverRumor = async (rumorId: string) => {
    if (!sessionId || !player) return
    setError(null)
    setIsActing(true)
    try {
      const update = await applyAction(sessionId, 'discover', { rumorId }, currentYear)
      const merged = mergeState(player, update.newState)
      setPlayer(merged)
      addJournalEntries(update.journalEntries)
    } catch (err) {
      setError(err instanceof Error ? err.message : '探索失败')
    } finally {
      setIsActing(false)
    }
  }

  const handleInvestigate = async () => {
    if (!sessionId || !player) return
    setError(null)
    setIsActing(true)
    try {
      const update = await applyAction(sessionId, 'investigate', {
        target: currentLocation?.id ?? player.currentLocationId,
      }, currentYear)
      const merged = mergeState(player, update.newState)
      setPlayer(merged)
      addJournalEntries(update.journalEntries)
    } catch (err) {
      setError(err instanceof Error ? err.message : '调查失败')
    } finally {
      setIsActing(false)
    }
  }

  const handleTalk = async (npcId: string) => {
    if (!sessionId || !player) return
    setError(null)
    try {
      const update = await applyAction(sessionId, 'talk', { npcId }, currentYear)
      const merged = mergeState(player, update.newState)
      setPlayer(merged)
      addJournalEntries(update.journalEntries)
      setPhase('dialoguing')
    } catch (err) {
      setError(err instanceof Error ? err.message : '对话启动失败')
    }
  }

  const handleSelectOption = async (optionIndex: number) => {
    if (!sessionId || !player || !activeEvent) return
    setError(null)
    const effects = activeEvent.options[optionIndex]?.attributeEffects ?? {}
    try {
      const update = await applyAction(sessionId, 'event_choice', {
        eventId: activeEvent.id,
        optionIndex,
        attributeEffects: effects,
      }, currentYear)
      const merged = mergeState(player, update.newState)
      setPlayer(merged)
      addJournalEntries(update.journalEntries)
      setActiveEvent(null)

      await applyAction(sessionId, 'resolve_event', {}, currentYear)
    } catch (err) {
      setError(err instanceof Error ? err.message : '选择失败')
    }
  }

  const handleBreakthrough = async () => {
    if (!sessionId || !player) return
    setError(null)
    setIsActing(true)
    setBreakthroughHint(null)
    try {
      const update = await applyAction(sessionId, 'attempt_breakthrough', {}, currentYear)
      const merged = mergeState(player, update.newState)
      setPlayer(merged)
      addJournalEntries(update.journalEntries)

      if (update.hints && update.hints.length > 0) {
        setError(update.hints[0])
      }

      try {
        const endings = await checkEndings(sessionId)
        if (endings.length > 0) setAvailableEndings(endings)
      } catch {
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '破境失败')
    } finally {
      setIsActing(false)
    }
  }

  const handleCheckEndings = async () => {
    if (!sessionId) return
    setError(null)
    try {
      const endings = await checkEndings(sessionId)
      setAvailableEndings(endings)
    } catch (err) {
      setError(err instanceof Error ? err.message : '检查结局失败')
    }
  }

  if (!worldBlueprint || !player) {
    return (
      <div className="min-h-screen bg-bg-paper flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-text-secondary mb-4">尚未创建推演</p>
          <Link to="/world-gen"><Button>开天辟地</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-paper">
      <header className="border-b-3 border-border-primary bg-bg-card shadow-nb">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div className="flex-1">
            <h1 className="font-mono text-base font-bold">探索</h1>
            <p className="text-xs text-text-secondary">{currentLocation?.name ?? '未知'} · {worldBlueprint.worldProfile.name}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/journal"><Button variant="secondary" size="sm" className="gap-1"><Scroll className="w-4 h-4" />旅记</Button></Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {error && (
          <div className="bg-accent-red border-3 border-border-primary shadow-nb p-3 mb-4 text-text-inverse font-mono text-sm">{error}</div>
        )}

        {breakthroughHint && (
          <div className="bg-accent-cyan border-3 border-border-primary shadow-nb p-3 mb-4 text-text-primary font-mono text-sm">{breakthroughHint}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <StatusPanel player={player} currentYear={currentYear} />

            <AnimatePresence>
              {activeEvent && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <EventCard event={activeEvent} onSelectOption={handleSelectOption} />
                </motion.div>
              )}
            </AnimatePresence>

            {!activeEvent && currentLocation && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Panel title={currentLocation.name} titleBg="dark">
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <Tag variant="info">{currentLocation.riskLevel}</Tag>
                    {currentLocation.atmosphere && <Tag variant="default">{currentLocation.atmosphere}</Tag>}
                  </div>
                  <p className="text-text-primary leading-relaxed mb-4">{currentLocation.description}</p>

                  {locationClues.length > 0 && (
                    <div className="mb-4">
                      <div className="font-mono text-sm font-bold text-accent-cyan mb-2">可发现线索：</div>
                      <div className="flex flex-wrap gap-2">
                        {locationClues.map((clue) => (
                          <Button key={clue.id} size="sm" variant="cyan"
                            onClick={() => handleDiscoverClue(clue.id)} disabled={isActing}>
                            {clue.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={handleInvestigate} disabled={isActing}>
                      <MapPin className="w-4 h-4" />调查此地
                    </Button>
                    {currentLocation.exploreActions.map((a) => (
                      <Button key={a} size="sm" variant="secondary" onClick={handleInvestigate} disabled={isActing}>
                        {a}
                      </Button>
                    ))}
                  </div>
                </Panel>
              </motion.div>
            )}

            {!activeEvent && (
              <Panel title="可前往地点" titleBg="cyan">
                <div className="space-y-2">
                  {worldBlueprint.locations
                    .filter((loc) =>
                      loc.id === player.currentLocationId ||
                      currentLocation?.connections.includes(loc.id) ||
                      player.discoveredLocations.includes(loc.id),
                    )
                    .map((loc) => (
                      <div key={loc.id}
                        onClick={() => { if (loc.id !== player.currentLocationId && !isActing) handleMove(loc.id) }}
                        className={`border-3 border-border-primary p-3 shadow-nb cursor-pointer transition-all hover:shadow-nb-lg hover:-translate-x-0.5 hover:-translate-y-0.5 ${
                          loc.id === player.currentLocationId ? 'bg-primary' : 'bg-bg-card'
                        }`}>
                        <div className="flex justify-between">
                          <span className="font-mono font-bold">{loc.name}</span>
                          <Tag variant="info">{loc.riskLevel}</Tag>
                        </div>
                      </div>
                    ))}
                </div>
              </Panel>
            )}

            {!activeEvent && triggerableEvents.length > 0 && (
              <Panel title="此地事件" titleBg="purple">
                <div className="space-y-2">
                  {triggerableEvents.filter((e) => e.oneTime ? !player.discoveredClues.includes(e.id) : true).map((e) => (
                    <div key={e.id}
                      onClick={() => setActiveEvent(e)}
                      className="bg-bg-card border-3 border-border-primary shadow-nb p-3 cursor-pointer hover:shadow-nb-lg transition-all">
                      <span className="font-mono font-bold text-sm">{e.description}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </div>

          <div className="space-y-5">
            <Card shadow="lg" hover={false} className="bg-primary">
              <div className="text-center">
                <Button variant="dark" size="lg" fullWidth className="gap-2"
                  onClick={handleNextYear} disabled={isAdvancing || !!activeEvent || isActing}>
                  {isAdvancing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
                  {isAdvancing ? 'AI 推演中...' : '下一年'}
                </Button>
                <p className="font-mono text-xs text-text-secondary mt-2">推进时间，属性自然增长</p>
              </div>
            </Card>

            <Button variant="cyan" fullWidth className="gap-2" onClick={handleBreakthrough} disabled={isActing || !breakthroughHint}>
              <Zap className="w-4 h-4" />尝试破境
            </Button>

            <Button variant="secondary" fullWidth className="gap-2" onClick={handleCheckEndings} disabled={isActing}>
              检查可触发结局
            </Button>

            {availableEndings.length > 0 && (
              <Panel title="可触发结局" titleBg="purple">
                <div className="space-y-2">
                  {availableEndings.map((e) => (
                    <Link key={e.id} to="/ending">
                      <div className="bg-bg-card border-3 border-border-primary shadow-nb p-3 hover:shadow-nb-lg cursor-pointer transition-all">
                        <span className="font-mono font-bold">{e.title}</span>
                        <p className="text-xs text-text-secondary">{e.tone}</p>
                        {e.requiredRealm && <Tag variant="warning">需境界: {e.requiredRealm}</Tag>}
                      </div>
                    </Link>
                  ))}
                </div>
              </Panel>
            )}

            <Panel title="可见 NPC" titleBg="primary">
              {nearbyNpcs.length === 0 ? (
                <p className="text-sm text-text-secondary">此处暂无 NPC</p>
              ) : (
                <div className="space-y-3">
                  {nearbyNpcs.map((npc) => (
                    <Link key={npc.id} to="/dialogue" onClick={() => handleTalk(npc.id)}>
                      <div className="bg-bg-card border-3 border-border-primary shadow-nb p-3 hover:shadow-nb-lg hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer transition-all">
                        <div className="flex justify-between mb-1">
                          <span className="font-mono font-bold">{npc.name}</span>
                          <span className="font-mono text-xs text-text-secondary">{npc.cultivationLevel ?? npc.role}</span>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {npc.personality.slice(0, 2).map((p) => (
                            <span key={p} className="px-2 py-0.5 text-xs font-mono border-2 border-border-primary bg-accent-cyan">{p}</span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="传闻" titleBg="purple">
              {visibleRumors.length === 0 ? (
                <p className="text-sm text-text-secondary">暂无传闻</p>
              ) : (
                <div className="space-y-2">
                  {visibleRumors.map((r) => (
                    <div key={r.id} className="bg-bg-card border-2 border-border-primary p-3 text-sm text-text-secondary">
                      {r.content}
                      <span className="text-xs ml-1">可信度: {Math.round(r.credibility * 100)}%</span>
                      {!player.discoveredRumors.includes(r.id) && (
                        <Button size="sm" variant="secondary" className="mt-1" onClick={() => handleDiscoverRumor(r.id)} disabled={isActing}>
                          追踪此传闻
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </main>
    </div>
  )
}