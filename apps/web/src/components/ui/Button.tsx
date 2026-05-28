import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Slot } from '@radix-ui/react-slot'
import { forwardRef } from 'react'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wide cursor-pointer nb-hover nb-active transition-all duration-150',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-text-primary border-3 border-border-primary shadow-nb',
        secondary: 'bg-bg-card text-text-primary border-3 border-border-primary shadow-nb',
        danger: 'bg-accent-red text-text-inverse border-3 border-border-primary shadow-nb',
        cyan: 'bg-accent-cyan text-text-primary border-3 border-border-primary shadow-nb',
        ghost: 'bg-transparent border-3 border-border-primary text-text-primary shadow-nb',
        dark: 'bg-bg-dark text-text-inverse border-3 border-border-primary shadow-nb',
      },
      size: {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
        icon: 'p-3',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
