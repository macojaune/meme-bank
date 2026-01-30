import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface NeoButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'brick' | 'lime' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const NeoButton = forwardRef<HTMLButtonElement, NeoButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseClasses = 'btn-neo font-bold transition-all duration-150'
    
    const variantClasses = {
      primary: 'btn-neo-primary',
      secondary: 'btn-neo-secondary',
      accent: 'btn-neo-accent',
      brick: 'btn-neo-brick',
      lime: 'btn-neo-lime',
      ghost: 'bg-transparent border-2 border-border hover:bg-surface-2',
    }
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg',
    }
    
    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
NeoButton.displayName = 'NeoButton'

export { NeoButton, type NeoButtonProps }
