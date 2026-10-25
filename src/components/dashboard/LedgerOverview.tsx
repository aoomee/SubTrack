import { useState } from 'react'
import { Link } from 'react-router-dom'
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
  const entries = Object.entries(data).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0)
  return <div className="mx-6 mb-6 border-t pt-5 sm:mx-8 sm:mb-7">
    <div className="mb-3 flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{t('categoryBreakdown')}</span>
      <Link to="/expense-reports" className="hover:underline">{t('viewDetails')} →</Link>
    </div>
    {entries.length ? <>
      <div className="flex h-2 gap-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        {entries.map(([category, amount], index) => <span key={category} style={{ flex: amount / total, background: `hsl(var(--chart-${index % 5 + 1}))` }} />)}
      </div>
      <div className="mt-3.5 flex flex-wrap justify-between gap-x-5 gap-y-2 text-[11px]">
        {entries.map(([category, amount], index) => <div key={category} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: `hsl(var(--chart-${index % 5 + 1}))` }} />
          <span className="text-muted-foreground">{categories.find(item => item.value === category)?.label || category}</span>
          <span className="font-medium">{formatCurrencyAmount(amount, currency)} · {(amount / total * 100).toFixed(0)}%</span>
        </div>)}
      </div>
    </> : <p className="py-2 text-xs text-muted-foreground">{t('noSpendingDataAvailable')}</p>}
  </div>
}

export function BillingCalendar({ subscriptions }: { subscriptions: Subscription[] }) {
  const { t, i18n } = useTranslation('dashboard')
  const now = new Date()
  const year = now.getFullYear(), month = now.getMonth()
  const [selectedDay, setSelectedDay] = useState(now.getDate())
  const days = new Date(year, month + 1, 0).getDate()
  const leading = (new Date(year, month, 1).getDay() + 6) % 7
  const selected = getCalendarSubscriptions(subscriptions, year, month, selectedDay)
  const locale = i18n.resolvedLanguage || 'en'
  return <Card className="flex min-w-0 flex-col">
    <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
      <CardTitle>{t('billingCalendar')}</CardTitle>
      <span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { month: 'long' }).format(now)}</span>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col">
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {Array.from({ length: 7 }, (_, index) => <span key={`weekday-${index}`} className="pb-2 text-[10px] text-muted-foreground">{new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2026, 0, 5 + index))}</span>)}
        {Array.from({ length: leading }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1
          const entries = getCalendarSubscriptions(subscriptions, year, month, day)
          return <button key={day} type="button" aria-pressed={selectedDay === day}
            aria-label={t('calendarDay', { date: new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(new Date(year, month, day)), count: entries.length })}
            onClick={() => setSelectedDay(day)}
            className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full pb-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedDay === day ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'} ${day === now.getDate() && selectedDay !== day ? 'ring-1 ring-border' : ''}`}>
            {day}{entries.length > 0 && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-current" />}
          </button>
        })}
      </div>
      <div className="mt-4 border-t pt-3 text-[11px] text-muted-foreground" aria-live="polite">
        {selected.length ? selected.map(sub => <div key={sub.id} className="flex justify-between gap-2 py-0.5"><span className="truncate">{sub.name}</span><span className="shrink-0 text-foreground">{formatWithUserCurrency(sub.amount, sub.currency)}</span></div>) : <p>{t('noScheduledPayments')}</p>}
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
      <Link className="text-xs text-muted-foreground hover:text-foreground" to="/subscriptions">{t('viewAll')} →</Link>
    </div>
    <Card className="divide-y overflow-hidden">
      {active.length ? active.map(sub => {
        const months = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 }[sub.billingCycle]
        const monthly = convertCurrency(sub.amount / months, sub.currency, currency)
        return <button key={sub.id} onClick={() => onSelect(sub)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6">
          <span className="flex min-w-0 items-center gap-3.5"><span className="service-avatar" aria-hidden="true">{sub.name.slice(0, 1)}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{sub.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{sub.plan} · {getCategoryLabel(sub, categories)} · {getPaymentMethodLabel(sub, paymentMethods)}</span></span></span>
          <span className="shrink-0 text-right"><span className="block text-sm font-semibold">{formatWithUserCurrency(sub.amount, sub.currency)}</span><span className="mt-1 block text-[11px] text-muted-foreground">{t('monthlyEquivalent', { amount: formatCurrencyAmount(monthly, currency) })}</span></span>
        </button>
      }) : <p className="p-6 text-center text-sm text-muted-foreground">{t('noActiveServices')}</p>}
    </Card>
  </section>
}
