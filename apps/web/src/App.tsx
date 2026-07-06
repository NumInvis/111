import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, ArrowLeft, Skull, Trophy, Scroll, Sparkles, Settings2, X } from 'lucide-react'
import { logger, fetchApi } from './lib/logger'

interface GameState {
  player: {
    name: string; age: number; lifespan: number; realm: string; location: string
    attributes: Record<string, number>; discovered: string[]
    relationships: Record<string, { trust: number; level: string }>; history: string
  }
  world: {
    name: string; conflict: string; rules: string[]
    attributes: Array<{ name: string; desc: string; growth: number }>
    locations: Array<{ id: string; name: string; desc: string }>
    npcs: Array<{ id: string; name: string; role: string; personality: string[]; goal: string; secret: string }>
    clues: Array<{ id: string; name: string; desc: string }>
    endings: Array<{ id: string; title: string; desc: string; evidence: string[] }>
  }
}

interface TurnResp {
  narrative: string; options: Array<{ id: string; label: string; desc: string }>
  state: GameState; status: 'playing' | 'died' | 'ended'
}

interface WorldPreference {
  theme?: string; tone?: string; scale?: 'small' | 'medium' | 'large'; seed?: string
}

interface AIConfig {
  api_base: string
  api_key: string
  model: string
  timeout_ms: number
  temperature: number
}

interface AppConfigData {
  ai: AIConfig
  port: number
}

interface ModelInfo {
  id: string
  owned_by?: string
}

const LORE_FRAGMENTS = [
  '天地初开，混沌未分...',
  '大道无形，生育天地...',
  '算力凝结，化为星辰...',
  '因果纠缠，命运编织...',
  '一念之间，万象更新...',
  '积分之道，深不可测...',
  '变分之境，极值显现...',
  '无穷级数，收敛于一...',
]

const WISDOM = [
  '道可道，非常道',
  '万物皆数',
  '数学是宇宙的语言',
  '证明即修行',
  '极值处见真章',
]

const TONES = ['轻松', '严肃', '黑暗', '浪漫', '荒诞']
const SCALES: Array<{ value: WorldPreference['scale']; label: string }> = [
  { value: 'small', label: '小型' },
  { value: 'medium', label: '中型' },
  { value: 'large', label: '大型' },
]

type Phase = 'home' | 'creating' | 'playing' | 'loading' | 'died' | 'ended'

export default function App() {
  const [phase, setPhase] = useState<Phase>('home')
  const [sid, setSid] = useState<string | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [narrative, setNarrative] = useState('')
  const [options, setOptions] = useState<TurnResp['options']>([])
  const [consequence, setConsequence] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [log, setLog] = useState<Array<{ r: string; c: string }>>([])
  const [loreIdx, setLoreIdx] = useState(0)
  const [wisdomIdx] = useState(() => Math.floor(Math.random() * WISDOM.length))
  const [showPref, setShowPref] = useState(false)
  const [preference, setPreference] = useState<WorldPreference>({ theme: '', tone: '', scale: 'medium', seed: '' })
  const [showSettings, setShowSettings] = useState(false)
  const [cfg, setCfg] = useState<Partial<AIConfig>>({ api_base: '', api_key: '', model: '' })
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' })
  }, [log.length])

  useEffect(() => {
    if (phase !== 'creating' && phase !== 'loading') return
    const interval = setInterval(() => setLoreIdx((i) => (i + 1) % LORE_FRAGMENTS.length), 3000)
    return () => clearInterval(interval)
  }, [phase])

  async function loadConfig() {
    try {
      const res = await fetchApi<AppConfigData>('/config')
      if (res.data?.ai) {
        setCfg(res.data.ai)
      }
    } catch (e) {
      logger.error('加载配置失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  async function fetchModels() {
    setModelsLoading(true)
    try {
      const res = await fetchApi<{ models: ModelInfo[]; count: number }>('/models')
      if (res.data) {
        setModels(res.data.models)
        logger.logGameEvent('模型列表加载', { count: res.data.count })
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '获取模型列表失败')
    } finally {
      setModelsLoading(false)
    }
  }

  async function saveConfig() {
    try {
      await fetchApi<AppConfigData>('/config', {
        method: 'POST',
        body: JSON.stringify({ ai: cfg }),
      })
      setShowSettings(false)
      setErr(null)
      logger.logGameEvent('配置已保存')
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存配置失败')
    }
  }

  function buildPreference(): WorldPreference | undefined {
    const p: WorldPreference = {}
    if (preference.theme?.trim()) p.theme = preference.theme.trim()
    if (preference.tone?.trim()) p.tone = preference.tone.trim()
    if (preference.scale) p.scale = preference.scale
    if (preference.seed?.trim()) p.seed = preference.seed.trim()
    return Object.keys(p).length > 0 ? p : undefined
  }

  async function startGame() {
    setPhase('creating'); setErr(null); setLog([])
    const pref = buildPreference()
    logger.logUserAction('开天辟地', pref as Record<string, unknown> | undefined)
    try {
      const s = await fetchApi<{ id: string; state: GameState }>('/game/sessions', {
        method: 'POST',
        body: JSON.stringify({ preference: pref }),
      })
      if (!s.data) throw new Error('No data')
      setSid(s.data.id); setState(s.data.state)
      setLog([{ r: 'sys', c: `世界「${s.data.state.world.name}」已生成` }])
      logger.logGameEvent('世界生成完成', { worldName: s.data.state.world.name })

      setPhase('loading')
      const t = await fetchApi<TurnResp>(`/game/sessions/${s.data.id}/action`, {
        method: 'POST', body: JSON.stringify({ action: '开始第一年' }),
      })
      if (!t.data) throw new Error('No data')
      setNarrative(t.data.narrative); setOptions(t.data.options); setState(t.data.state)
      setLog((l) => [...l, { r: 'ai', c: t.data!.narrative }])
      setPhase(t.data.status === 'playing' ? 'playing' : t.data.status)
      logger.logGameEvent('第一回合', { age: t.data.state.player.age })
    } catch (e) {
      setErr(e instanceof Error ? e.message : '生成失败'); setPhase('home')
      logger.error('游戏创建失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  async function choose(id: string) {
    if (!sid) return
    const o = options.find((x) => x.id === id)
    if (!o) return
    setPhase('loading'); setErr(null); setOptions([]); setConsequence(null)
    setLog((l) => [...l, { r: 'me', c: o.label }])
    logger.logUserAction('选择选项', { label: o.label, id })
    try {
      const t = await fetchApi<TurnResp>(`/game/sessions/${sid}/action`, {
        method: 'POST', body: JSON.stringify({ action: o.label }),
      })
      if (!t.data) throw new Error('No data')
      setNarrative(t.data.narrative); setOptions(t.data.options); setState(t.data.state)
      setConsequence(t.data.narrative)
      setLog((l) => [...l, { r: 'ai', c: t.data!.narrative }])
      setPhase(t.data.status === 'playing' ? 'playing' : t.data.status)
      logger.logGameEvent('回合完成', { age: t.data.state.player.age, realm: t.data.state.player.realm, status: t.data.status })
    } catch (e) {
      setErr(e instanceof Error ? e.message : '操作失败'); setPhase('playing')
      logger.error('回合失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  function reset() {
    logger.logUserAction('重新推演')
    setSid(null); setState(null); setNarrative(''); setOptions([]); setConsequence(null)
    setErr(null); setLog([]); setPhase('home')
  }

  function openSettings() {
    loadConfig()
    fetchModels()
    setShowSettings(true)
  }

  // HOME
  if (phase === 'home') {
    return (
      <div className="min-h-screen bg-bg-paper flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6 max-w-md px-4">
          <div className="inline-block bg-primary border-3 border-border-primary shadow-nb-xl px-8 py-4">
            <h1 className="font-mono text-4xl md:text-5xl font-black text-text-inverse tracking-tight">变分无限</h1>
          </div>
          <p className="font-mono text-text-secondary text-sm">数学修仙 · AI 即引擎 · 人生模拟</p>
          <div className="bg-bg-card border-3 border-border-primary shadow-nb p-4">
            <p className="font-mono text-xs text-accent-cyan italic">{WISDOM[wisdomIdx]}</p>
          </div>

          <AnimatePresence>
            {showPref && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="bg-bg-card border-3 border-border-primary shadow-nb p-4 text-left space-y-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono font-bold text-sm">世界偏好</h2>
                  <button onClick={() => setShowPref(false)} className="p-1 nb-hover"><X className="w-4 h-4" /></button>
                </div>
                <div>
                  <label className="font-mono text-xs text-text-secondary block mb-1">主题</label>
                  <input value={preference.theme} onChange={(e) => setPreference((p) => ({ ...p, theme: e.target.value }))}
                    placeholder="如：古典修仙、赛博数学、克苏鲁几何"
                    className="w-full bg-bg-paper border-2 border-border-primary px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan" />
                </div>
                <div>
                  <label className="font-mono text-xs text-text-secondary block mb-1">基调</label>
                  <div className="flex flex-wrap gap-2">
                    {TONES.map((t) => (
                      <button key={t} onClick={() => setPreference((p) => ({ ...p, tone: t }))}
                        className={`px-3 py-1 border-2 border-border-primary font-mono text-xs transition-all ${preference.tone === t ? 'bg-primary text-text-inverse' : 'bg-bg-paper nb-hover'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-mono text-xs text-text-secondary block mb-1">规模</label>
                  <div className="flex gap-2">
                    {SCALES.map((s) => (
                      <button key={s.value} onClick={() => setPreference((p) => ({ ...p, scale: s.value }))}
                        className={`flex-1 px-3 py-1 border-2 border-border-primary font-mono text-xs transition-all ${preference.scale === s.value ? 'bg-primary text-text-inverse' : 'bg-bg-paper nb-hover'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-mono text-xs text-text-secondary block mb-1">种子 / 关键词</label>
                  <input value={preference.seed} onChange={(e) => setPreference((p) => ({ ...p, seed: e.target.value }))}
                    placeholder="让 LLM 围绕某个关键词展开"
                    className="w-full bg-bg-paper border-2 border-border-primary px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {err && <p className="font-mono text-sm text-accent-red bg-accent-red/10 border-3 border-accent-red p-3">{err}</p>}

          <div className="flex gap-3 justify-center">
            {!showPref && (
              <button onClick={() => setShowPref(true)} className="font-mono font-bold uppercase tracking-wide bg-bg-card text-text-primary border-3 border-border-primary shadow-nb px-4 py-4 text-lg nb-hover nb-active transition-all">
                <Settings2 className="w-5 h-5 inline mr-2" />偏好
              </button>
            )}
            <button onClick={openSettings} className="font-mono font-bold uppercase tracking-wide bg-bg-card text-text-primary border-3 border-border-primary shadow-nb px-4 py-4 text-lg nb-hover nb-active transition-all">
              ⚙ 设置
            </button>
            <button onClick={startGame} className="font-mono font-bold uppercase tracking-wide bg-primary text-text-inverse border-3 border-border-primary shadow-nb px-8 py-4 text-lg nb-hover nb-active transition-all">
              <Sparkles className="w-5 h-5 inline mr-2" />开天辟地
            </button>
          </div>
        </motion.div>

        {showSettings && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowSettings(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-bg-card border-3 border-border-primary shadow-nb-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono font-bold text-lg">⚙ AI 设置</h2>
                <button onClick={() => setShowSettings(false)} className="p-1 nb-hover"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="font-mono text-xs text-text-secondary block mb-1">API 地址</label>
                  <input value={cfg.api_base || ''} onChange={(e) => setCfg((c) => ({ ...c, api_base: e.target.value }))}
                    placeholder="https://..."
                    className="w-full bg-bg-paper border-2 border-border-primary px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan" />
                </div>
                <div>
                  <label className="font-mono text-xs text-text-secondary block mb-1">API Key</label>
                  <input type="password" value={cfg.api_key || ''} onChange={(e) => setCfg((c) => ({ ...c, api_key: e.target.value }))}
                    placeholder="sk-..."
                    className="w-full bg-bg-paper border-2 border-border-primary px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-mono text-xs text-text-secondary">模型</label>
                    <button onClick={fetchModels} disabled={modelsLoading} className="font-mono text-xs border-2 border-border-primary px-2 py-1 nb-hover disabled:opacity-50">
                      {modelsLoading ? '获取中...' : '📡 获取模型列表'}
                    </button>
                  </div>
                  <select value={cfg.model || ''} onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}
                    className="w-full bg-bg-paper border-2 border-border-primary px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan">
                    <option value="">-- 选择模型 --</option>
                    {cfg.model && !models.some((m) => m.id === cfg.model) && <option value={cfg.model}>{cfg.model} (当前)</option>}
                    {models.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-xs text-text-secondary block mb-1">超时 (ms)</label>
                    <input type="number" value={cfg.timeout_ms || 60000} onChange={(e) => setCfg((c) => ({ ...c, timeout_ms: Number(e.target.value) }))}
                      className="w-full bg-bg-paper border-2 border-border-primary px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan" />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-text-secondary block mb-1">温度</label>
                    <input type="number" step="0.1" min="0" max="2" value={cfg.temperature ?? 0.9} onChange={(e) => setCfg((c) => ({ ...c, temperature: Number(e.target.value) }))}
                      className="w-full bg-bg-paper border-2 border-border-primary px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowSettings(false)} className="font-mono border-2 border-border-primary px-4 py-2 nb-hover">取消</button>
                <button onClick={saveConfig} className="font-mono bg-primary text-text-inverse border-2 border-border-primary px-4 py-2 nb-hover">保存</button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    )
  }

  // LOADING (creating world or resolving turn)
  if (phase === 'creating' || (phase === 'loading' && !state)) {
    return (
      <div className="min-h-screen bg-bg-paper flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-6">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 border-4 border-border-primary" />
            <div className="absolute inset-2 border-4 border-primary animate-spin" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-4 border-4 border-accent-cyan animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-2xl font-black text-primary">道</span>
            </div>
          </div>
          <p className="font-mono text-lg font-bold">{phase === 'creating' ? '开天辟地...' : '天道推演中...'}</p>
          <AnimatePresence mode="wait">
            <motion.p key={loreIdx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="font-mono text-sm text-accent-cyan italic">{LORE_FRAGMENTS[loreIdx]}</motion.p>
          </AnimatePresence>
        </motion.div>
      </div>
    )
  }

  if (!state) return null
  const p = state.player

  // DIED
  if (phase === 'died') {
    return (
      <div className="min-h-screen bg-bg-paper flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md text-center space-y-6 px-4">
          <Skull className="w-16 h-16 mx-auto text-accent-red" />
          <div className="bg-bg-card border-3 border-border-primary shadow-nb-xl p-6">
            <h1 className="font-mono text-3xl font-black mb-2">寿元耗尽</h1>
            <p className="font-mono text-sm text-text-secondary mb-4">享年 {p.age} 岁 · 境界 {p.realm}</p>
            <p className="text-sm text-text-primary leading-relaxed">{narrative}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            {Object.entries(p.attributes).map(([k, v]) => (
              <div key={k} className="bg-bg-card border-2 border-border-primary p-2 text-center">
                <div className="text-text-secondary">{k}</div><div className="font-bold">{v}</div>
              </div>
            ))}
          </div>
          <p className="font-mono text-xs text-text-secondary">经历 {log.length} 件事</p>
          <button onClick={reset} className="font-mono font-bold uppercase bg-primary text-text-inverse border-3 border-border-primary shadow-nb px-6 py-3 nb-hover nb-active">
            重新推演
          </button>
        </motion.div>
      </div>
    )
  }

  // ENDED
  if (phase === 'ended') {
    return (
      <div className="min-h-screen bg-bg-paper flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md text-center space-y-6 px-4">
          <Trophy className="w-16 h-16 mx-auto text-accent-orange" />
          <div className="bg-bg-card border-3 border-border-primary shadow-nb-xl p-6">
            <h1 className="font-mono text-3xl font-black mb-2">推演终结</h1>
            <p className="font-mono text-sm text-text-secondary mb-4">享年 {p.age} · {p.realm}</p>
            <p className="text-sm text-text-primary leading-relaxed">{narrative}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            {Object.entries(p.attributes).map(([k, v]) => (
              <div key={k} className="bg-bg-card border-2 border-border-primary p-2 text-center">
                <div className="text-text-secondary">{k}</div><div className="font-bold">{v}</div>
              </div>
            ))}
          </div>
          <button onClick={reset} className="font-mono font-bold uppercase bg-primary text-text-inverse border-3 border-border-primary shadow-nb px-6 py-3 nb-hover nb-active">
            重新推演
          </button>
        </motion.div>
      </div>
    )
  }

  // PLAYING (main game view)
  return (
    <div className="min-h-screen bg-bg-paper flex flex-col">
      {/* Header */}
      <header className="border-b-3 border-border-primary bg-bg-card shadow-nb">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={reset} className="p-2 border-3 border-border-primary bg-bg-card shadow-nb-sm nb-hover nb-active transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="font-mono text-base font-bold">{p.name}</h1>
            <p className="text-xs text-text-secondary">{state.world.name}</p>
          </div>
          <div className="text-right font-mono text-sm">
            <div className="flex items-center gap-1"><span className="text-text-secondary">年龄</span> <span className="font-bold">{p.age}/{p.lifespan}</span></div>
            <div className="text-primary font-bold">{p.realm}</div>
          </div>
          <button onClick={openSettings} className="p-2 border-3 border-border-primary bg-bg-card shadow-nb-sm nb-hover nb-active transition-all">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Attributes */}
      <div className="max-w-2xl mx-auto w-full px-4 py-2 flex gap-2 flex-wrap font-mono text-xs">
        {Object.entries(p.attributes).map(([k, v]) => (
          <div key={k} className="bg-bg-card border-2 border-border-primary shadow-nb-sm px-3 py-1">
            <span className="text-text-secondary">{k}</span>{' '}<span className="font-bold text-sm">{v}</span>
          </div>
        ))}
      </div>

      {/* Narrative + Log */}
      <main ref={scrollRef} className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 overflow-y-auto space-y-3">
        {/* Consequence highlight */}
        <AnimatePresence mode="wait">
          {consequence && phase === 'playing' && (
            <motion.div key="consequence" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-bg-highlight border-3 border-border-primary shadow-nb p-4">
              <p className="font-mono text-xs text-primary font-bold mb-1">天道回应</p>
              <p className="text-sm text-text-primary leading-relaxed">{consequence}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Log entries */}
        {log.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            className={`border-l-3 pl-3 py-1 ${
              m.r === 'me' ? 'border-accent-cyan' : m.r === 'sys' ? 'border-accent-green' : 'border-primary'
            }`}>
            <p className="text-xs font-mono text-text-secondary mb-1">
              {m.r === 'me' ? '我' : m.r === 'sys' ? '系统' : '天道'}
            </p>
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{m.c}</p>
          </motion.div>
        ))}
      </main>

      {/* Error */}
      {err && (
        <div className="max-w-2xl mx-auto w-full px-4">
          <p className="bg-accent-red border-3 border-border-primary shadow-nb p-3 text-text-inverse font-mono text-sm">{err}</p>
        </div>
      )}

      {/* Loading indicator */}
      {phase === 'loading' && (
        <div className="max-w-2xl mx-auto w-full px-4 py-4 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
          <p className="font-mono text-sm text-text-secondary">天道推演中...</p>
        </div>
      )}

      {/* Options */}
      {phase === 'playing' && options.length > 0 && (
        <div className="max-w-2xl mx-auto w-full px-4 py-4 space-y-2">
          {options.map((o, i) => (
            <motion.button key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              onClick={() => choose(o.id)}
              className="w-full text-left bg-bg-card text-text-primary border-3 border-border-primary shadow-nb p-4 nb-hover nb-active transition-all">
              <div className="font-bold font-mono">{o.label}</div>
              <div className="text-sm text-text-secondary mt-1">{o.desc}</div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Journal toggle */}
      {log.length > 2 && phase === 'playing' && (
        <div className="max-w-2xl mx-auto w-full px-4 pb-4">
          <button onClick={() => {
            const el = scrollRef.current
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
          }}
            className="w-full text-center font-mono text-xs text-text-secondary border-2 border-border-subtle py-2 nb-hover nb-active transition-all">
            <Scroll className="w-3 h-3 inline mr-1" />查看全部历程 ({log.length} 条)
          </button>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowSettings(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-card border-3 border-border-primary shadow-nb-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono font-bold text-lg">⚙ AI 设置</h2>
              <button onClick={() => setShowSettings(false)} className="p-1 nb-hover"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="font-mono text-xs text-text-secondary block mb-1">API 地址</label>
                <input value={cfg.api_base || ''} onChange={(e) => setCfg((c) => ({ ...c, api_base: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-bg-paper border-2 border-border-primary px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan" />
              </div>
              <div>
                <label className="font-mono text-xs text-text-secondary block mb-1">API Key</label>
                <input type="password" value={cfg.api_key || ''} onChange={(e) => setCfg((c) => ({ ...c, api_key: e.target.value }))}
                  placeholder="sk-..."
                  className="w-full bg-bg-paper border-2 border-border-primary px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-xs text-text-secondary">模型</label>
                  <button onClick={fetchModels} disabled={modelsLoading} className="font-mono text-xs border-2 border-border-primary px-2 py-1 nb-hover disabled:opacity-50">
                    {modelsLoading ? '获取中...' : '📡 获取模型列表'}
                  </button>
                </div>
                <select value={cfg.model || ''} onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}
                  className="w-full bg-bg-paper border-2 border-border-primary px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan">
                  <option value="">-- 选择模型 --</option>
                  {cfg.model && !models.some((m) => m.id === cfg.model) && <option value={cfg.model}>{cfg.model} (当前)</option>}
                  {models.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-xs text-text-secondary block mb-1">超时 (ms)</label>
                  <input type="number" value={cfg.timeout_ms || 60000} onChange={(e) => setCfg((c) => ({ ...c, timeout_ms: Number(e.target.value) }))}
                    className="w-full bg-bg-paper border-2 border-border-primary px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan" />
                </div>
                <div>
                  <label className="font-mono text-xs text-text-secondary block mb-1">温度</label>
                  <input type="number" step="0.1" min="0" max="2" value={cfg.temperature ?? 0.9} onChange={(e) => setCfg((c) => ({ ...c, temperature: Number(e.target.value) }))}
                    className="w-full bg-bg-paper border-2 border-border-primary px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowSettings(false)} className="font-mono border-2 border-border-primary px-4 py-2 nb-hover">取消</button>
              <button onClick={saveConfig} className="font-mono bg-primary text-text-inverse border-2 border-border-primary px-4 py-2 nb-hover">保存</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
