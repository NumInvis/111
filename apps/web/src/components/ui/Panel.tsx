import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  titleBg?: 'dark' | 'primary' | 'cyan' | 'red' | 'purple'
  shadow?: 'sm' | 'md' | 'lg' | 'xl'
}

const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, title, titleBg = 'dark', shadow = 'lg', children, ...props }, ref) => {
    const bgMap = {
      dark: 'bg-bg-dark text-text-inverse',
      primary: 'bg-primary text-text-primary',
      cyan: 'bg-accent-cyan text-text-primary',
      red: 'bg-accent-red text-text-inverse',
      purple: 'bg-accent-purple text-text-inverse',
    }

    const shadowMap = {
      sm: 'shadow-nb-sm',
      md: 'shadow-nb',
      lg: 'shadow-nb-lg',
      xl: 'shadow-nb-xl',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'bg-bg-paper border-3 border-border-primary overflow-hidden',
          shadowMap[shadow],
          className
        )}
        {...props}
      >
        {title && (
          <div
            className={cn(
              'px-6 py-3 font-mono text-lg font-bold border-b-3 border-border-primary',
              bgMap[titleBg]
            )}
          >
            {title}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    )
  }
)
Panel.displayName = 'Panel'

export { Panel }
