import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Subscription } from '@/store/subscriptionStore'
import { daysUntil, formatDate } from '@/lib/subscription-utils'
import { formatWithUserCurrency } from '@/utils/currency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function SubscriptionActivity({ subscriptions, paid = false, className, onSelect }: {
  subscriptions: Subscription[]; paid?: boolean; className?: string; onSelect?: (subscription: Subscription) => void
}) {
  const { t } = useTranslation('dashboard')
  return <Card className={cn('flex min-h-[240px] flex-col', className)}>
    <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
      <CardTitle>{t(paid ? 'recentlyPaid' : 'upcomingRenewals')}</CardTitle>
      <Badge variant="secondary">{subscriptions.length}</Badge>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col">
      <div className="flex-1">
        {subscriptions.length ? <div className="max-h-64 divide-y overflow-y-auto">
          {subscriptions.map(sub => <button key={sub.id} onClick={() => onSelect?.(sub)} className="flex w-full items-center justify-between gap-3 rounded-lg py-3 text-left first:pt-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <span className="flex min-w-0 items-center gap-3">
              <span className="service-avatar h-9 w-9 rounded-[13px] text-xs" aria-hidden="true">{sub.name.slice(0, 1)}</span>
              <span className="min-w-0"><span className="block truncate text-xs font-semibold">{sub.name}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{formatDate(paid ? sub.lastBillingDate! : sub.nextBillingDate)} · {sub.plan}</span></span>
            </span>
            <span className="shrink-0 text-right"><span className="block text-xs font-semibold">{formatWithUserCurrency(sub.amount, sub.currency)}</span>
              {!paid && <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{daysUntil(sub.nextBillingDate) === 0 ? t('today') : `${daysUntil(sub.nextBillingDate)} ${t('days')}`}</span>}
            </span>
          </button>)}
        </div> : <p className="flex min-h-24 items-center justify-center text-center text-xs leading-relaxed text-muted-foreground">{t(paid ? 'noSubscriptionsPaidInLast7Days' : 'noUpcomingRenewalsNext7Days')}</p>}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3 text-[11px] text-muted-foreground">
        <span>{t(paid ? 'subscriptionsPaidInLast7Days' : 'subscriptionsRenewingInNext7Days')}</span>
        <Link to="/subscriptions" className="shrink-0 hover:text-foreground">{t('viewAll')} →</Link>
      </div>
    </CardContent>
  </Card>
}
