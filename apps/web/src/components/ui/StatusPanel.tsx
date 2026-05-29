import { forwardRef } from 'react'
import { useGameStore } from '@/stores/gameStore'
import type { PlayerState } from '@/types'

interface StatusPanelProps {
  player: PlayerState
  currentYear: number
}

const StatusPanel = forwardRef<HTMLDivElement, StatusPanelProps>(
  ({ player, currentYear }, ref) => {
    const worldBlueprint = useGameStore((s) => s.worldBlueprint)
    const locationName = worldBlueprint?.locations.find(
      (l) => l.id === player.currentLocationId,
    )?.name ?? player.currentLocationId
    const attributeDefs = worldBlueprint?.attributeDefs ?? []
    const attrEntries = attributeDefs.map((def) => ({
      key: def.name,
      label: def.name,
      value: player.attributes[def.name] ?? 0,
    }))

    return (
      <div ref={ref} className="bg-bg-card border-3 border-border-primary shadow-nb">
        <div className="bg-bg-dark text-text-inverse px-4 py-2 border-b-3 border-border-primary flex justify-between">
          <span className="font-mono font-bold">{player.name}</span>
          <span className="font-mono text-sm opacity-80">第 {currentYear} 年 · {player.realm}</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="年龄" value={`${player.age} 岁`} />
            <Stat label="寿元" value={`${player.lifespan} 岁`} />
            <Stat label="境界" value={player.realm} highlight />
          </div>
          <div>
            <div className="font-mono text-xs font-bold text-text-secondary mb-2">属性</div>
            <div className="grid grid-cols-4 gap-2">
              {attrEntries.map(({ key, label, value }) => (
                <Attr key={key} label={label} value={value} />
              ))}
            </div>
          </div>
          {player.discoveredClues.length > 0 && (
            <div>
              <div className="font-mono text-xs font-bold text-text-secondary mb-1">发现线索 ({player.discoveredClues.length})</div>
              <div className="flex flex-wrap gap-1">
                {player.discoveredClues.map((c) => (
                  <span key={c} className="px-2 py-0.5 text-xs font-mono border-2 border-border-primary bg-accent-cyan">{c}</span>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="font-mono text-xs font-bold text-text-secondary mb-1">当前地点</div>
            <div className="font-mono font-bold text-sm">{locationName}</div>
          </div>
        </div>
      </div>
    )
  }
)
StatusPanel.displayName = 'StatusPanel'

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`border-3 border-border-primary p-2 text-center ${highlight ? 'bg-primary' : 'bg-bg-paper'}`}>
      <div className="font-mono text-xs text-text-secondary mb-1">{label}</div>
      <div className="font-mono text-base font-bold text-text-primary">{value}</div>
    </div>
  )
}

function Attr({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-bg-paper border-2 border-border-primary p-2 text-center">
      <div className="font-mono text-xs text-text-secondary mb-1">{label}</div>
      <div className="font-mono text-lg font-bold text-text-primary">{value}</div>
    </div>
  )
}

export { StatusPanel }