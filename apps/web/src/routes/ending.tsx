import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { Tag } from '@/components/ui/Tag'
import { motion } from 'framer-motion'
import { ArrowLeft, RotateCcw, Scroll, Clock, MapPin, Users, Loader2, Trophy } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { checkEndings, triggerEnding, endSession } from '@/lib/api'
import type { EndingCandidate } from '@/types'

export const Route = createFileRoute('/ending')({
  component: EndingPage,
})

function EndingPage() {
  const { sessionId, player, currentYear, journal, setPhase, reset } = useGameStore()
  const [endings, setEndings] = useState<EndingCandidate[]>([])
  const [selectedEnding, setSelectedEnding] = useState<EndingCandidate | null>(null)
  const [endingSummary, setEndingSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [endingSession, setEndingSession] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      setError('尚未创建推演会话')
      return
    }
    checkEndings(sessionId)
      .then((result) => {
        setEndings(result)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '获取结局失败')
        setLoading(false)
      })
  }, [sessionId])

  const handleSelectEnding = (ending: EndingCandidate) => {
    setSelectedEnding(ending)
  }

  const handleConfirmEnding = async () => {
    if (!sessionId || !selectedEnding) return
    setEndingSession(true)
    setError(null)
    try {
      const result = await triggerEnding(sessionId, selectedEnding.id)
      setEndingSummary(result.summary)
      await endSession(sessionId)
      setPhase('ended')
    } catch (err) {
      setError(err instanceof Error ? err.message : '触发结局失败')
      setEndingSession(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-paper flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
          <p className="font-mono text-text-secondary">AI 正在检索可触发结局...</p>
        </div>
      </div>
    )
  }

  if (error && endings.length === 0) {
    return (
      <div className="min-h-screen bg-bg-paper flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-accent-red mb-4">{error}</p>
          <Link to="/explore"><Button>返回探索</Button></Link>
        </div>
      </div>
    )
  }

  if (!selectedEnding) {
    return (
      <div className="min-h-screen bg-bg-paper">
        <header className="border-b-3 border-border-primary bg-bg-card shadow-nb">
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3">
            <Link to="/explore"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
            <h1 className="font-mono text-lg font-bold">可触发结局</h1>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-6 py-6">
          {error && (
            <div className="bg-accent-red border-3 border-border-primary shadow-nb p-3 mb-4 text-text-inverse font-mono text-sm">{error}</div>
          )}
          {endings.length === 0 ? (
            <div className="text-center py-10">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-text-secondary" />
              <p className="font-mono text-text-secondary">当前尚无可触发的结局</p>
              <p className="font-mono text-xs text-text-secondary mt-2">继续探索、积累证据、提升境界以解锁更多结局</p>
              <Link to="/explore" className="mt-6"><Button>返回探索</Button></Link>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Panel title="选择你的结局" titleBg="dark" className="mb-6">
                <p className="text-text-secondary text-sm mb-4">以下结局已满足触发条件，选择一个以终结推演</p>
                <div className="space-y-4">
                  {endings.map((e) => (
                    <div key={e.id}
                      onClick={() => handleSelectEnding(e)}
                      className="bg-bg-card border-3 border-border-primary shadow-nb p-4 cursor-pointer hover:shadow-nb-lg hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-mono text-lg font-bold">{e.title}</span>
                        <Tag variant="warning">{e.tone}</Tag>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed mb-3">{e.description}</p>
                      <div className="flex gap-2 flex-wrap">
                        {e.requiredEvidence.map((ev) => (
                          <Tag key={ev} variant="success">证据: {ev}</Tag>
                        ))}
                        {e.requiredRealm && <Tag variant="info">需境界: {e.requiredRealm}</Tag>}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </motion.div>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-paper">
      <main className="max-w-3xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-block bg-primary border-3 border-border-primary shadow-nb-lg px-8 py-4 mb-4">
              <h1 className="font-mono text-3xl md:text-4xl font-black">{selectedEnding.title}</h1>
            </div>
          </div>

          <Panel title="一生总结" titleBg="dark" className="mb-6">
            <p className="text-text-primary leading-relaxed whitespace-pre-wrap">{endingSummary ?? selectedEnding.description}</p>
          </Panel>

          {selectedEnding.requiredEvidence.length > 0 && (
            <Panel title="证据链" titleBg="purple" className="mb-6">
              <div className="space-y-2">
                {selectedEnding.requiredEvidence.map((e, i) => (
                  <div key={i} className="bg-bg-card border-2 border-border-primary p-3">
                    <Tag variant="warning">证据</Tag>
                    <span className="font-mono text-sm font-bold ml-2">{e}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="推演数据" titleBg="cyan" className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={<Clock className="w-4 h-4" />} label="推演年数" value={`${currentYear} 年`} />
              <Stat icon={<MapPin className="w-4 h-4" />} label="年龄" value={`${player?.age ?? 16} 岁`} />
              <Stat icon={<Scroll className="w-4 h-4" />} label="经历事件" value={`${journal.length} 件`} />
              <Stat icon={<Users className="w-4 h-4" />} label="境界" value={player?.realm ?? '炼体'} />
            </div>
          </Panel>

          {endingSession ? (
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="font-mono text-text-secondary">正在终结推演...</p>
            </div>
          ) : error ? (
            <div className="bg-accent-red border-3 border-border-primary shadow-nb p-3 mb-4 text-text-inverse font-mono text-sm">{error}</div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="gap-2" onClick={handleConfirmEnding} disabled={endingSession}>
              <Trophy className="w-5 h-5" /> 确认此结局
            </Button>
            <Link to="/world-gen">
              <Button variant="secondary" size="lg" className="gap-2" onClick={reset}>
                <RotateCcw className="w-5 h-5" /> 重新推演
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-bg-card border-3 border-border-primary p-3 text-center">
      <div className="flex justify-center text-text-secondary mb-1">{icon}</div>
      <div className="font-mono text-xs text-text-secondary mb-1">{label}</div>
      <div className="font-mono text-base font-bold text-text-primary">{value}</div>
    </div>
  )
}