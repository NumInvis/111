import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  label?: string
  variant?: 'primary' | 'cyan' | 'green' | 'red' | 'purple'
  size?: 'sm' | 'md'
}

const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, value, max = 100, label, variant = 'primary', size = 'md', ...props }, ref) => {
    const pct = Math.min(100, Math.max(0, (value / max) * 100))
    const colorMap = {
      primary: 'bg-primary',
      cyan: 'bg-accent-cyan',
      green: 'bg-accent-green',
      red: 'bg-accent-red',
      purple: 'bg-accent-purple',
    }
    const h = size === 'sm' ? 'h-4' : 'h-6'

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        {label && (
          <div className="flex justify-between mb-1">
            <span className="font-mono text-xs font-bold text-text-secondary">{label}</span>
            <span className="font-mono text-xs font-bold text-text-primary">
              {value} / {max}
            </span>
          </div>
        )}
        <div className={`w-full ${h} bg-bg-card border-3 border-border-primary relative`}>
          <div
            className={`absolute inset-y-0 left-0 ${colorMap[variant]} transition-all duration-300`}
            style={{ width: `${pct}%` }}
          />
          <span
            className={`absolute inset-0 flex items-center justify-center font-mono text-xs font-bold ${
              pct > 50 ? 'text-text-primary' : 'text-text-secondary'
            }`}
          >
            {Math.round(pct)}%
          </span>
        </div>
      </div>
    )
  }
)
ProgressBar.displayName = 'ProgressBar'

export { ProgressBar }
