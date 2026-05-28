import { forwardRef } from 'react'
import type { NpcSeed } from '@/types'

interface NPCProfileProps {
  npc: NpcSeed
}

const NPCProfile = forwardRef<HTMLDivElement, NPCProfileProps>(
  ({ npc }, ref) => {
    const trust = Math.round(npc.trustLevel * 100)
    const trustColor = trust >= 70 ? 'bg-accent-green' : trust >= 40 ? 'bg-primary' : 'bg-accent-red'

    return (
      <div ref={ref} className="bg-bg-card border-3 border-border-primary shadow-nb">
        <div className="bg-bg-dark text-text-inverse px-4 py-3 border-b-3 border-border-primary flex justify-between">
          <div>
            <h3 className="font-mono text-lg font-bold">{npc.name}</h3>
            <p className="text-sm opacity-80">{npc.role}</p>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold">{npc.cultivationLevel ?? '未知境界'}</div>
            <div className="text-xs opacity-80">{npc.faction ?? '无门派'}</div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {npc.personality.slice(0, 3).map((p) => (
              <span key={p} className="px-2 py-0.5 text-xs font-mono border-2 border-border-primary bg-accent-cyan">{p}</span>
            ))}
            <span className={`px-2 py-0.5 text-xs font-mono border-2 border-border-primary ${trustColor}`}>
              信任 {trust}%
            </span>
          </div>

          <div>
            <div className="font-mono text-xs font-bold text-text-secondary mb-1">目标</div>
            <p className="text-sm text-text-primary leading-relaxed">{npc.goal}</p>
          </div>

          {npc.mathematicalStrength && (
            <div>
              <div className="font-mono text-xs font-bold text-text-secondary mb-1">数学特长</div>
              <p className="text-sm text-text-primary">{npc.mathematicalStrength}</p>
            </div>
          )}

          <div>
            <div className="font-mono text-xs font-bold text-text-secondary mb-1">对话风格</div>
            <p className="text-sm text-text-primary leading-relaxed">{npc.dialogueStyle}</p>
          </div>
        </div>
      </div>
    )
  }
)
NPCProfile.displayName = 'NPCProfile'

export { NPCProfile }