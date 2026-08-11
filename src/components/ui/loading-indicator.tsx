import { cn } from '@/lib/utils'

interface LoadingIndicatorProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-7 w-7 border-[3px]',
  lg: 'h-9 w-9 border-[3px]',
}

export function LoadingIndicator({ className, size = 'md' }: LoadingIndicatorProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'block animate-spin rounded-full border-primary/20 border-t-primary',
        sizeClasses[size],
        className,
      )}
    />
  )
}
