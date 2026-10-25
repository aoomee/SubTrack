import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

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
      <circle cx="32" cy="20" r="11" fill="currentColor" />
      <circle cx="22" cy="35" r="11" fill="currentColor" />
      <circle cx="42" cy="35" r="11" fill="currentColor" />
      <path
        d="M32 35C33 44 30 50 25 54"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SubTrackBrand({ className, showWordmark = true }: SubTrackBrandProps) {
  const { t } = useTranslation('navigation')
  return (
    <span className={cn('brand-lockup', className)} aria-hidden="true">
      <span className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-primary text-primary-foreground"><SubTrackMark className="h-7 w-7" /></span>
      {showWordmark && <span className="brand-wordmark">{t('brandName')}</span>}
    </span>
  )
}
