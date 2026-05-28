import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { Tag } from '@/components/ui/Tag'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles, Dice5, Loader2 } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { createSession, generateWorld, toGenPref } from '@/lib/api'

export const Route = createFileRoute('/world-gen')({
  component: WorldGenPage,
})

const DIRECTIONS = ['纯粹数学','应用数学','计算数学','统计概率','随机混沌']
const MODES = ['快速模式','完整模式','无限模式']

function WorldGenPage() {
  const navigate = useNavigate()
  const { setSessionId, setPreference, setWorldBlueprint, setPlayer, setCurrentYear } = useGameStore()

  const [pref, setPref] = useState({ direction: '纯粹数学', mode: '完整模式', seed: undefined as number | undefined })
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
      setPreference(pref)
      setStep('AI 正在生成世界...')
      const blueprint = await generateWorld(session.id, toGenPref(pref))
      setWorldBlueprint(blueprint)
      const initialLocationId = blueprint.locations[0]?.id ?? ''
      setPlayer({
        name: '行者',
        age: 16,
        lifespan: 80,
        realm: '炼体',
        currentLocationId: initialLocationId,
        attributes: {
          calculation: 10, geometry: 5, abstraction: 5, proof: 3,
          intuition: 5, focus: 10, body: 20, family: 10,
        },
        discoveredLocations: [initialLocationId],
        discoveredNpcs: [],
        discoveredClues: [],
        discoveredRumors: [],
        relationships: {},
        historySummary: '初入灵墟，一切从零开始。',
      })
      setCurrentYear(16)
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
              <h2 className="font-mono text-3xl font-black mb-2">配置你的世界</h2>
              <p className="text-text-secondary">AI 根据数学方向偏好生成独一无二的修行世界</p>
            </div>
            {error && (
              <div className="bg-accent-red border-3 border-border-primary shadow-nb p-4 mb-6 text-text-inverse font-mono text-sm">{error}</div>
            )}
            <Panel title="世界参数" titleBg="dark" className="mb-6">
              <div className="mb-6">
                <h3 className="font-mono text-base font-bold mb-3">数学方向</h3>
                <div className="flex flex-wrap gap-2">
                  {DIRECTIONS.map((d) => (
                    <button key={d} onClick={() => setPref((p) => ({ ...p, direction: d }))}
                      className={`px-4 py-2 font-mono font-bold border-3 border-border-primary transition-all ${
                        pref.direction === d ? 'bg-primary shadow-nb-lg -translate-x-0.5 -translate-y-0.5' : 'bg-bg-card shadow-nb hover:shadow-nb-lg'
                      }`}>{d}</button>
                  ))}
                </div>
              </div>
              <div className="mb-6">
                <h3 className="font-mono text-base font-bold mb-3">推演模式</h3>
                <div className="flex flex-wrap gap-2">
                  {MODES.map((m) => (
                    <button key={m} onClick={() => setPref((p) => ({ ...p, mode: m }))}
                      className={`px-4 py-2 font-mono font-bold border-3 border-border-primary transition-all ${
                        pref.mode === m ? 'bg-accent-cyan shadow-nb-lg -translate-x-0.5 -translate-y-0.5' : 'bg-bg-card shadow-nb hover:shadow-nb-lg'
                      }`}>{m}</button>
                  ))}
                </div>
              </div>
              <div className="mb-6">
                <h3 className="font-mono text-base font-bold mb-3">随机种子（可选）</h3>
                <input type="number" value={pref.seed ?? ''}
                  onChange={(e) => setPref((p) => ({ ...p, seed: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="留空则随机"
                  className="w-full bg-bg-card border-3 border-border-primary px-4 py-2 font-mono focus:outline-none focus:border-primary focus:shadow-nb"
                />
              </div>
              <div className="border-t-3 border-border-primary pt-4">
                <div className="flex flex-wrap gap-2">
                  <Tag variant="warning">{pref.direction}</Tag>
                  <Tag variant="info">{pref.mode}</Tag>
                  {pref.seed !== undefined && <Tag variant="success">Seed: {pref.seed}</Tag>}
                </div>
              </div>
            </Panel>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="gap-2" onClick={handleGenerate}>
                <Sparkles className="w-5 h-5" /> 生成世界
              </Button>
              <Button variant="secondary" size="lg" className="gap-2"
                onClick={() => setPref({ direction: DIRECTIONS[Math.floor(Math.random()*DIRECTIONS.length)], mode: MODES[Math.floor(Math.random()*MODES.length)], seed: Math.floor(Math.random()*1000000) })}>
                <Dice5 className="w-5 h-5" /> 机机配置
              </Button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}