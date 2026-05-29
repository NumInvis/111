import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { Tag } from '@/components/ui/Tag'
import { motion } from 'framer-motion'
import { RotateCcw, Clock, MapPin, Scroll, Users, Skull } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
export const Route = createFileRoute('/death')({
  component: DeathPage,
})

function DeathPage() {
  const { player, currentYear, journal, reset } = useGameStore()

  return (
    <div className="min-h-screen bg-bg-paper">
      <main className="max-w-3xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <Skull className="w-16 h-16 mx-auto mb-6 text-accent-red" />
            <div className="inline-block bg-accent-red border-3 border-border-primary shadow-nb-lg px-8 py-4 mb-4">
              <h1 className="font-mono text-3xl md:text-4xl font-black text-text-inverse">寿元耗尽</h1>
            </div>
            <p className="font-mono text-text-secondary text-lg mt-4">
              享年{player?.age ?? '?'}岁，寿元已尽，归于天地。
            </p>
          </div>

          <Panel title="一生回顾" titleBg="dark" className="mb-6">
            <p className="text-text-primary leading-relaxed">
              {player ? `行者于${currentYear}年离世，终境${player.realm}。` : '行者已归于天地。'}
            </p>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Tag variant="default">终境：{player?.realm ?? '炼体'}</Tag>
              <Tag variant="info">享年：{player?.age ?? 16}岁</Tag>
              <Tag variant="warning">发现线索：{player?.discoveredClues?.length ?? 0}条</Tag>
              <Tag variant="success">结识NPC：{player?.discoveredNpcs?.length ?? 0}人</Tag>
            </div>
          </Panel>

          <Panel title="推演数据" titleBg="cyan" className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={<Clock className="w-4 h-4" />} label="推演年数" value={`${currentYear} 年`} />
              <Stat icon={<MapPin className="w-4 h-4" />} label="最终境界" value={player?.realm ?? '炼体'} />
              <Stat icon={<Scroll className="w-4 h-4" />} label="经历事件" value={`${journal.length} 件`} />
              <Stat icon={<Users className="w-4 h-4" />} label="结识人数" value={`${player?.discoveredNpcs?.length ?? 0} 人`} />
            </div>
          </Panel>

          {player?.attributes && (
            <Panel title="最终属性" titleBg="purple" className="mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(player.attributes).map(([key, val]) => (
                  <div key={key} className="bg-bg-card border-2 border-border-primary p-2 text-center">
                    <div className="font-mono text-xs text-text-secondary">{key}</div>
                    <div className="font-mono text-base font-bold">{val}</div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/world-gen">
              <Button variant="dark" size="lg" className="gap-2" onClick={reset}>
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