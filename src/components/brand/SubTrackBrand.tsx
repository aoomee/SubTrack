import { cn } from '@/lib/utils'

interface SubTrackBrandProps {
  className?: string
  showWordmark?: boolean
}

export function SubTrackMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('brand-mark', className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M50 10H22C14 10 10 14 10 21.5S14 33 22 33H29M35 33H42C50 33 54 37 54 44.5S50 56 42 56H14"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SubTrackBrand({ className, showWordmark = true }: SubTrackBrandProps) {
  return (
    <span className={cn('brand-lockup', className)} aria-hidden="true">
      <SubTrackMark />
      {showWordmark && <span className="brand-wordmark">SUBTRACK</span>}
    </span>
  )
}
