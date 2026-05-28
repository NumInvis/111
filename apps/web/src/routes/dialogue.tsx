import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { NPCProfile } from '@/components/ui/NPCProfile'
import { Tag } from '@/components/ui/Tag'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, User, Bot, Scroll, Loader2 } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { startDialogue, applyAction } from '@/lib/api'
import type { DialogueMessage } from '@/types'

export const Route = createFileRoute('/dialogue')({
  component: DialoguePage,
})

function DialoguePage() {
  const {
    worldBlueprint, sessionId, player,
    messages: msgStore, addMessage, addJournalEntries, setPhase,
  } = useGameStore()

  const npcs = worldBlueprint?.npcs ?? []
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isLoadingDialogue, setIsLoadingDialogue] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeNpc = selectedNpcId
    ? npcs.find((n) => n.id === selectedNpcId) ?? null
    : ((player?.discoveredNpcs?.length ?? 0) > 0
      ? npcs.find((n) => n.id === player!.discoveredNpcs[0]) ?? npcs[0] ?? null
      : null)

  const npcMessages = activeNpc ? (msgStore[activeNpc.id] ?? []) : []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [npcMessages, isTyping])

  const relationship = activeNpc && player
    ? player.relationships[activeNpc.id]
    : undefined

  const handleStartChat = async (npcId: string) => {
    if (!sessionId) return
    setError(null)
    setIsLoadingDialogue(true)
    try {
      await startDialogue(sessionId, npcId)
      if (player) {
        const update = await applyAction(sessionId, 'talk', { npcId }, player.age)
        if (update.journalEntries.length > 0) addJournalEntries(update.journalEntries)
        if (update.newState) {
          useGameStore.getState().setPlayer({ ...player, ...update.newState } as import('@/types').PlayerState)
        }
      }
      setSelectedNpcId(npcId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '对话启动失败')
    } finally {
      setIsLoadingDialogue(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || !activeNpc || !sessionId || !player) return
    setError(null)

    const playerMsg: DialogueMessage = {
      id: `${Date.now()}-player`,
      npcId: activeNpc.id,
      role: 'player',
      content: input.trim(),
      turn: player.age,
    }
    addMessage(activeNpc.id, playerMsg)
    setInput('')
    setIsTyping(true)

    try {
      await applyAction(sessionId, 'talk', {
        npcId: activeNpc.id,
        message: input.trim(),
      }, player.age)

      const npcMsg: DialogueMessage = {
        id: `${Date.now() + 1}-npc`,
        npcId: activeNpc.id,
        role: 'npc',
        content: activeNpc.dialogueStyle,
        turn: player.age,
        metadata: { note: 'NPC 回复由本地生成，后端仅验证状态转换' },
      }
      addMessage(activeNpc.id, npcMsg)
    } catch (err) {
      setError(err instanceof Error ? err.message : '对话失败')
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleBackToExplore = () => {
    setPhase('exploring')
  }

  if (!worldBlueprint || npcs.length === 0) {
    return (
      <div className="min-h-screen bg-bg-paper flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-text-secondary mb-4">尚无可用 NPC</p>
          <Link to="/explore"><Button>返回探索</Button></Link>
        </div>
      </div>
    )
  }

  if (isLoadingDialogue) {
    return (
      <div className="min-h-screen bg-bg-paper flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
          <p className="font-mono text-text-secondary">正在开启对话...</p>
        </div>
      </div>
    )
  }

  const discoveredNpcs = player
    ? npcs.filter((n) => player.discoveredNpcs.includes(n.id))
    : []

  return (
    <div className="min-h-screen bg-bg-paper flex flex-col">
      <header className="border-b-3 border-border-primary bg-bg-card shadow-nb">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link to="/explore" onClick={handleBackToExplore}>
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          {activeNpc && (
            <div className="flex-1">
              <h1 className="font-mono text-base font-bold">{activeNpc.name}</h1>
              <p className="text-xs text-text-secondary">{activeNpc.role} · {activeNpc.cultivationLevel ?? '未知境界'}</p>
            </div>
          )}
          {relationship && (
            <Tag variant={relationship.trust >= 0.7 ? 'success' : relationship.trust >= 0.4 ? 'info' : 'warning'}>
              信任 {Math.round(relationship.trust * 100)}% · {relationship.friendshipLevel}
            </Tag>
          )}
          <Link to="/journal"><Button variant="ghost" size="icon"><Scroll className="w-5 h-5" /></Button></Link>
        </div>
      </header>

      {discoveredNpcs.length > 1 && (
        <div className="max-w-4xl mx-auto w-full px-6 py-2 flex gap-2 overflow-x-auto">
          {discoveredNpcs.map((npc) => (
            <button key={npc.id} onClick={() => handleStartChat(npc.id)}
              className={`px-3 py-1.5 font-mono text-xs font-bold border-3 border-border-primary whitespace-nowrap transition-all ${
                activeNpc?.id === npc.id ? 'bg-primary shadow-nb' : 'bg-bg-card shadow-nb-sm hover:shadow-nb'
              }`}>
              {npc.name}
            </button>
          ))}
        </div>
      )}

      {activeNpc && (
        <div className="max-w-4xl mx-auto w-full px-6 py-3">
          <NPCProfile npc={activeNpc} />
        </div>
      )}

      <div className="flex-1 max-w-4xl mx-auto w-full px-6 overflow-y-auto">
        <div className="space-y-4 py-4">
          {npcMessages.length === 0 && (
            <div className="text-center py-10 text-text-secondary font-mono text-sm">
              与 {activeNpc?.name} 的对话即将开始...
            </div>
          )}
          <AnimatePresence>
            {npcMessages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`flex gap-3 ${msg.role === 'player' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-9 h-9 border-3 border-border-primary flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'player' ? 'bg-primary' : 'bg-accent-cyan'
                }`}>
                  {msg.role === 'player' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className="max-w-[80%]">
                  <div className={`border-3 border-border-primary p-4 shadow-nb ${
                    msg.role === 'player' ? 'bg-primary' : 'bg-bg-card'
                  }`}>
                    <p className="text-text-primary leading-relaxed whitespace-pre-wrap text-sm">{msg.content}</p>
                  </div>
                  {msg.memoryRefs && msg.memoryRefs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.memoryRefs.map((ref) => (
                        <span key={ref.id} className="px-2 py-0.5 text-xs font-mono border-2 border-border-primary bg-accent-purple text-text-inverse">
                          引用记忆：{ref.content}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-9 h-9 bg-accent-cyan border-3 border-border-primary flex-shrink-0 flex items-center justify-center"><Bot className="w-4 h-4" /></div>
              <div className="bg-bg-card border-3 border-border-primary p-4 shadow-nb">
                <div className="flex gap-1">
                  <motion.div animate={{ opacity: [0.3,1,0.3] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-2 h-2 bg-text-secondary" />
                  <motion.div animate={{ opacity: [0.3,1,0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-2 h-2 bg-text-secondary" />
                  <motion.div animate={{ opacity: [0.3,1,0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-2 h-2 bg-text-secondary" />
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto w-full px-6 pb-2">
          <div className="bg-accent-red border-3 border-border-primary p-2 text-text-inverse font-mono text-xs">{error}</div>
        </div>
      )}

      <div className="border-t-3 border-border-primary bg-bg-card p-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={activeNpc ? `对 ${activeNpc.name} 说些什么...` : '选择一位 NPC...'}
            disabled={!activeNpc || isTyping}
            className="flex-1 bg-bg-card border-3 border-border-primary px-4 py-3 text-sm focus:outline-none focus:border-primary focus:shadow-nb disabled:opacity-50" />
          <Button onClick={handleSend} disabled={!input.trim() || isTyping || !activeNpc}><Send className="w-5 h-5" /></Button>
        </div>
      </div>
    </div>
  )
}