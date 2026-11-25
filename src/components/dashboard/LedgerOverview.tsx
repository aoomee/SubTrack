import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSubscriptionStore, type Subscription } from '@/store/subscriptionStore'
import { useSettingsStore } from '@/store/settingsStore'
import { convertCurrency, formatCurrencyAmount, formatWithUserCurrency } from '@/utils/currency'
import { getCategoryLabel, getPaymentMethodLabel } from '@/lib/subscription-utils'
import { getCalendarSubscriptions } from '@/lib/billing-calendar'

export function CategoryStrip({ data }: { data: Record<string, number> }) {
  const { t } = useTranslation('dashboard')
  const categories = useSubscriptionStore(state => state.categories)
  const currency = useSettingsStore(state => state.currency)
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const entries = Object.entries(data).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0)
  return <div className="mx-6 mb-6 border-t pt-5 sm:mx-8 sm:mb-7">
    <div className="mb-3 flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{t('categoryBreakdown')}</span>
      <Link to="/expense-reports" className="group inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
        <span>{t('viewDetails')}</span>
        <span className="inline-block transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true">→</span>
      </Link>
    </div>
    {entries.length ? <>
      <div className="flex h-2 gap-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        {entries.map(([category, amount], index) => {
          const label = categories.find(item => item.value === category)?.label || category
          const dimmed = hoveredCategory !== null && hoveredCategory !== category
          return (
            <span
              key={category}
              title={`${label}: ${formatCurrencyAmount(amount, currency)} (${(amount / total * 100).toFixed(0)}%)`}
              onMouseEnter={() => setHoveredCategory(category)}
              onMouseLeave={() => setHoveredCategory(null)}
              className="transition-[flex-grow,opacity] duration-300 ease-out"
              style={{
                flex: amount / total,
                background: `hsl(var(--chart-${index % 5 + 1}))`,
                opacity: dimmed ? 0.35 : 1,
              }}
            />
          )
        })}
      </div>
      <div className="mt-3.5 flex flex-wrap justify-between gap-x-5 gap-y-2 text-[11px]">
        {entries.map(([category, amount], index) => {
          const dimmed = hoveredCategory !== null && hoveredCategory !== category
          return (
            <div
              key={category}
              onMouseEnter={() => setHoveredCategory(category)}
              onMouseLeave={() => setHoveredCategory(null)}
              className="flex cursor-default items-center gap-2 transition-opacity duration-200"
              style={{ opacity: dimmed ? 0.45 : 1 }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: `hsl(var(--chart-${index % 5 + 1}))` }} />
              <span className="text-muted-foreground">{categories.find(item => item.value === category)?.label || category}</span>
              <span className="font-medium tabular-nums">{formatCurrencyAmount(amount, currency)} · {(amount / total * 100).toFixed(0)}%</span>
            </div>
          )
        })}
      </div>
    </> : <p className="py-2 text-xs text-muted-foreground">{t('noSpendingDataAvailable')}</p>}
  </div>
}

export function BillingCalendar({ subscriptions }: { subscriptions: Subscription[] }) {
  const { t, i18n } = useTranslation('dashboard')
  const now = new Date()
  const [monthOffset, setMonthOffset] = useState(0)
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const [selectedDay, setSelectedDay] = useState(now.getDate())
  const days = new Date(year, month + 1, 0).getDate()
  const clampedSelectedDay = Math.min(selectedDay, days)
  const leading = (new Date(year, month, 1).getDay() + 6) % 7
  const selected = getCalendarSubscriptions(subscriptions, year, month, clampedSelectedDay)
  const locale = i18n.resolvedLanguage || 'en'

  const shiftMonth = (delta: number) => {
    setMonthOffset(prev => {
      const next = prev + delta
      const nextView = new Date(now.getFullYear(), now.getMonth() + next, 1)
      setSelectedDay(nextView.getFullYear() === now.getFullYear() && nextView.getMonth() === now.getMonth() ? now.getDate() : 1)
      return next
    })
  }

  return <Card className="flex min-w-0 flex-col">
    <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
      <CardTitle>{t('billingCalendar')}</CardTitle>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => { setMonthOffset(0); setSelectedDay(now.getDate()) }}
          disabled={isCurrentMonth}
          className="min-w-[4.5rem] rounded-full px-1.5 py-0.5 text-center text-xs font-medium text-muted-foreground transition-colors enabled:hover:bg-secondary enabled:hover:text-foreground"
        >
          {new Intl.DateTimeFormat(locale, { month: 'long', ...(year !== now.getFullYear() ? { year: 'numeric' } : {}) }).format(viewDate)}
        </button>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col">
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {Array.from({ length: 7 }, (_, index) => <span key={`weekday-${index}`} className="pb-2 text-[10px] text-muted-foreground">{new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2026, 0, 5 + index))}</span>)}
        {Array.from({ length: leading }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1
          const entries = getCalendarSubscriptions(subscriptions, year, month, day)
          const isSelected = clampedSelectedDay === day
          const isToday = isCurrentMonth && day === now.getDate()
          return <button key={day} type="button" aria-pressed={isSelected}
            aria-label={t('calendarDay', { date: new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(new Date(year, month, day)), count: entries.length })}
            onClick={() => setSelectedDay(day)}
            className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full pb-0.5 transition-[background-color,color,transform] duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-secondary'} ${isToday && !isSelected ? 'ring-1 ring-foreground/25 font-medium' : ''}`}>
            {day}{entries.length > 0 && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-current" />}
          </button>
        })}
      </div>
      <div className="mt-4 border-t pt-3 text-[11px] text-muted-foreground" aria-live="polite">
        {selected.length ? selected.map(sub => <div key={sub.id} className="flex justify-between gap-2 py-0.5"><span className="truncate text-foreground/90">{sub.name}</span><span className="shrink-0 font-medium tabular-nums text-foreground">{formatWithUserCurrency(sub.amount, sub.currency)}</span></div>) : <p>{t('noScheduledPayments')}</p>}
        <p className="mt-1.5 text-[10px]">{t('calendarBasis')}</p>
      </div>
    </CardContent>
  </Card>
}

export function ActiveSubscriptionList({ subscriptions, onSelect }: { subscriptions: Subscription[]; onSelect: (sub: Subscription) => void }) {
  const { t } = useTranslation(['dashboard', 'common'])
  const { categories, paymentMethods } = useSubscriptionStore()
  const currency = useSettingsStore(state => state.currency)
  const active = subscriptions.filter(sub => sub.status === 'active')
  return <section>
    <div className="mb-3 flex items-center justify-between px-2">
      <h2 className="text-sm font-semibold">{t('activeServices')}</h2>
      <Link className="group inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground" to="/subscriptions">
        <span>{t('viewAll')}</span>
        <span className="inline-block transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true">→</span>
      </Link>
    </div>
    <Card className="divide-y overflow-hidden">
      {active.length ? active.map(sub => {
        const months = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 }[sub.billingCycle]
        const monthly = convertCurrency(sub.amount / months, sub.currency, currency)
        return <button key={sub.id} type="button" onClick={() => onSelect(sub)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-muted/60 active:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6">
          <span className="flex min-w-0 items-center gap-3.5"><span className="service-avatar" aria-hidden="true">{sub.name.slice(0, 1)}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{sub.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{sub.plan} · {getCategoryLabel(sub, categories)} · {getPaymentMethodLabel(sub, paymentMethods)}</span></span></span>
          <span className="shrink-0 text-right"><span className="block text-sm font-semibold tabular-nums">{formatWithUserCurrency(sub.amount, sub.currency)}</span><span className="mt-1 block text-[11px] tabular-nums text-muted-foreground">{t('monthlyEquivalent', { amount: formatCurrencyAmount(monthly, currency) })}</span></span>
        </button>
      }) : <p className="p-6 text-center text-sm text-muted-foreground">{t('noActiveServices')}</p>}
    </Card>
  </section>
}
