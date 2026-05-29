import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Panel } from '@/components/ui/Panel'
import { Tag } from '@/components/ui/Tag'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, Sparkles, BookOpen, MapPin, Shield } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { ATTRIBUTE_LABELS } from '@/types'
import type { JournalCategory } from '@/types'

export const Route = createFileRoute('/journal')({
  component: JournalPage,
})

const CATEGORY_LABELS: Record<JournalCategory, string> = {
  event: '事件',
  discovery: '发现',
  relationship: '关系',
  realm: '境界',
  ending: '结局',
}

const CATEGORY_COLORS: Record<JournalCategory, string> = {
  event: 'bg-primary',
  discovery: 'bg-accent-cyan',
  relationship: 'bg-accent-purple',
  realm: 'bg-accent-green',
  ending: 'bg-accent-red',
}

function JournalPage() {
  const { player, currentYear, worldBlueprint, journal } = useGameStore()

  const clueNameMap = new Map(worldBlueprint?.clues?.map((c) => [c.id, c.name]) ?? [])

  if (!worldBlueprint) {
    return (
      <div className="min-h-screen bg-bg-paper flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-text-secondary mb-4">尚无旅记</p>
          <Link to="/world-gen"><Button>开天辟地</Button></Link>
        </div>
      </div>
    )
  }

  const locationNameMap = new Map(worldBlueprint.locations.map((l) => [l.id, l.name]))

  return (
    <div className="min-h-screen bg-bg-paper">
      <header className="border-b-3 border-border-primary bg-bg-card shadow-nb">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link to="/explore"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <h1 className="font-mono text-lg font-bold">旅记</h1>
          <span className="font-mono text-xs text-text-secondary ml-auto">{journal.length} 条记录</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Panel title="旅程记录" titleBg="dark">
                {journal.length === 0 ? (
                  <div className="text-center py-10 text-text-secondary">
                    <BookOpen className="w-8 h-8 mx-auto mb-3" />
                    <p className="font-mono text-sm">你的旅程尚未开始</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border-primary" />
                    <div className="space-y-5">
                      {journal.map((entry, index) => (
                        <motion.div key={entry.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}
                          className="relative pl-10">
                          <div className={`absolute left-2 top-1 w-4 h-4 border-3 border-border-primary ${CATEGORY_COLORS[entry.category] ?? 'bg-accent-cyan'}`} />
                          <Card shadow="sm" hover={false}>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Tag variant="info">{CATEGORY_LABELS[entry.category] ?? entry.category}</Tag>
                              {entry.evidenceTag && <Tag variant="success">证据</Tag>}
                              <span className="flex items-center gap-1 text-xs text-text-secondary ml-auto">
                                <Clock className="w-3 h-3" />第 {entry.turn} 年
                              </span>
                            </div>
                            <div className="font-mono font-bold text-sm mb-1">{entry.action}</div>
                            <p className="text-sm text-text-secondary leading-relaxed mb-2">{entry.result}</p>
                            <div className="flex gap-1 flex-wrap">
                              {entry.locationId && (
                                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-mono border-2 border-border-primary bg-bg-paper">
                                  <MapPin className="w-3 h-3" />{locationNameMap.get(entry.locationId) ?? entry.locationId}
                                </span>
                              )}
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>
            </motion.div>
          </div>

          <div>
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-5">
              <Panel title="当前推演" titleBg="primary">
                <div className="space-y-3">
                  <div><div className="text-xs text-text-secondary mb-1">世界</div><div className="font-mono font-bold text-sm">{worldBlueprint.worldProfile.name}</div></div>
                  <div><div className="text-xs text-text-secondary mb-1">境界</div><div className="font-mono font-bold text-sm">{player?.realm ?? '炼体'}</div></div>
                  <div><div className="text-xs text-text-secondary mb-1">年龄</div><div className="font-mono font-bold text-sm">{player?.age ?? 16} 岁</div></div>
                  <div>
                    <div className="text-xs text-text-secondary mb-1">推演进度</div>
                    <ProgressBar value={currentYear} max={player?.lifespan ?? 80} variant="primary" />
                    <span className="font-mono text-xs text-text-secondary mt-1">第 {currentYear} 年</span>
                  </div>
                </div>
              </Panel>

              {player && (
                <Panel title="属性概览" titleBg="cyan">
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.entries(ATTRIBUTE_LABELS) as [keyof typeof ATTRIBUTE_LABELS, string][]).map(([key, label]) => (
                      <div key={key} className="bg-bg-paper border-2 border-border-primary p-2 text-center">
                        <div className="font-mono text-xs text-text-secondary mb-1">{label}</div>
                        <div className={`font-mono text-lg font-bold ${
                          player.attributes[key] > 70 ? 'text-accent-green' : player.attributes[key] > 40 ? 'text-primary' : 'text-accent-red'
                        }`}>{player.attributes[key]}</div>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {player && player.discoveredClues.length > 0 && (
                <Panel title="已发现线索" titleBg="purple">
                  <div className="flex flex-wrap gap-1">
                    {player.discoveredClues.map((clue) => (
                      <span key={clue} className="px-2 py-0.5 text-xs font-mono border-2 border-border-primary bg-accent-cyan">
                        <Shield className="w-3 h-3 inline mr-1" />{clueNameMap.get(clue) ?? clue}
                      </span>
                    ))}
                  </div>
                </Panel>
              )}

              {journal.length > 0 && (
                <Card>
                  <div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-primary" /><h3 className="font-mono font-bold text-sm">历史摘要</h3></div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {player?.historySummary ?? '初入灵墟，一切从零开始。'}
                  </p>
                </Card>
              )}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  )
}