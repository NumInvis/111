import type { EventSeed } from '@/types'

interface EventCardProps {
  event: EventSeed
  onSelectOption: (optionIndex: number) => void
}

export function EventCard({ event, onSelectOption }: EventCardProps) {
  return (
    <div className="bg-bg-card border-3 border-border-primary shadow-nb-lg">
      <div className="bg-bg-dark text-text-inverse px-6 py-3 border-b-3 border-border-primary flex justify-between">
        <h3 className="font-mono text-lg font-bold">{event.description}</h3>
        <span className="font-mono text-sm opacity-80">地点: {event.locationId}</span>
      </div>
      <div className="p-6">
        <p className="text-text-primary leading-relaxed mb-6 text-base">{event.triggerCondition}</p>
        <div className="space-y-3">
          <div className="font-mono text-sm font-bold text-text-secondary mb-2">选择你的行动：</div>
          {event.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => onSelectOption(idx)}
              className="w-full text-left bg-bg-paper border-3 border-border-primary shadow-nb p-4 transition-all duration-150 hover:shadow-nb-lg hover:-translate-x-0.5 hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono font-bold text-text-primary">{opt.label}</span>
                {opt.riskLevel && <span className="px-2 py-0.5 text-xs font-mono border-2 border-border-primary bg-accent-red">{opt.riskLevel}</span>}
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{opt.description}</p>
              <p className="text-xs text-text-secondary mt-1">{opt.consequenceHint}</p>
              {opt.attributeEffects && Object.keys(opt.attributeEffects).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(opt.attributeEffects).map(([attr, delta]) => (
                    <span key={attr} className="px-1 py-0.5 text-xs font-mono border border-border-primary bg-accent-cyan">
                      {attr} {delta > 0 ? '+' : ''}{delta}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}