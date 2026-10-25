import { LoadingIndicator } from '@/components/ui/loading-indicator'
import { cn } from '@/lib/utils'

interface PageLoadingProps {
  className?: string
}

/** Covers the current content area while a route and its initial data settle. */
export function PageLoading({ className }: PageLoadingProps) {
  return (
    <div
      className={cn(
        'flex min-h-[240px] w-full items-center justify-center',
        className,
      )}
      aria-busy="true"
    >
      <LoadingIndicator size="lg" />
    </div>
  )
}
