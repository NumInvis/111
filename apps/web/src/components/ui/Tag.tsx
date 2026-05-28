import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'warning' | 'danger' | 'success' | 'info' | 'mystery'
}

const Tag = forwardRef<HTMLSpanElement, TagProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variantMap = {
      default: 'bg-accent-cyan text-text-primary',
      warning: 'bg-primary text-text-primary',
      danger: 'bg-accent-red text-text-inverse',
      success: 'bg-accent-green text-text-primary',
      info: 'bg-bg-card text-text-primary',
      mystery: 'bg-accent-purple text-text-inverse',
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-block px-3 py-1 text-sm font-semibold font-mono border-2 border-border-primary',
          variantMap[variant],
          className
        )}
        {...props}
      >
        {children}
      </span>
    )
  }
)
Tag.displayName = 'Tag'

export { Tag }
