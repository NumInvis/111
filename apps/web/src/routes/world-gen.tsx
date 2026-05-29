import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { createSession, generateWorld, getGameState } from '@/lib/api'

export const Route = createFileRoute('/world-gen')({
  component: WorldGenPage,
})

function WorldGenPage() {
  const navigate = useNavigate()
  const { setSessionId, setWorldBlueprint, setPlayer, setCurrentYear } = useGameStore()

  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setError(null)
    setLoading(true)
    setStep('创建推演会话...')
    try {
      const session = await createSession()
      setSessionId(session.id)
      setStep('AI 正在生成世界...')
      const blueprint = await generateWorld(session.id)
      setWorldBlueprint(blueprint)
      const playerState = await getGameState(session.id)
      setPlayer(playerState)
      setCurrentYear(playerState.age)
      setLoading(false)
      navigate({ to: '/explore' })
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : '生成失败，请检查后端的 AI_PROVIDER 是否已配置')
    }
  }

  return (
    <div className="min-h-screen bg-bg-paper">
      <header className="border-b-3 border-border-primary bg-bg-card shadow-nb">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <h1 className="font-mono text-lg font-bold">开天辟地</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-6 text-primary" />
            <h2 className="font-mono text-2xl font-bold mb-2">正在生成世界...</h2>
            <p className="font-mono text-text-secondary mb-8">{step}</p>
            <div className="max-w-md mx-auto"><ProgressBar value={50} max={100} variant="primary" /></div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center mb-8">
              <h2 className="font-mono text-3xl font-black mb-2">开天辟地</h2>
              <p className="text-text-secondary">AI 为你生成独一无二的修行世界</p>
            </div>
            {error && (
              <div className="bg-accent-red border-3 border-border-primary shadow-nb p-4 mb-6 text-text-inverse font-mono text-sm">{error}</div>
            )}
            <Panel title="世界生成" titleBg="dark" className="mb-6">
              <div className="text-center py-8">
                <p className="font-mono text-text-secondary mb-6">
                  一切由天意决定。AI 将自主决定世界主题、属性体系、突破规则。
                </p>
                <Button size="lg" className="gap-2" onClick={handleGenerate}>
                  <Sparkles className="w-5 h-5" /> 开天辟地
                </Button>
              </div>
            </Panel>
          </motion.div>
        )}
      </main>
    </div>
  )
}
