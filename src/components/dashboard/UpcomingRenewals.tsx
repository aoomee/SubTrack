import { useTranslation } from "react-i18next"
import { Calendar, CalendarIcon } from "lucide-react"
import { Subscription } from "@/store/subscriptionStore"
import { formatDate, daysUntil } from "@/lib/subscription-utils"
import { formatWithUserCurrency } from "@/utils/currency"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { cn } from "@/lib/utils"

interface UpcomingRenewalsProps {
  subscriptions: Subscription[]
  className?: string
}

export function UpcomingRenewals({ subscriptions, className }: UpcomingRenewalsProps) {
  const { t } = useTranslation('dashboard');

  const getBadgeVariant = (daysLeft: number) => {
    if (daysLeft <= 3) return "destructive"
    if (daysLeft <= 7) return "warning"
    return "secondary"
  }

  const getTimeLabel = (daysLeft: number) => {
    if (daysLeft === 0) return t('today')
    if (daysLeft === 1) return t('tomorrow')
    return `${daysLeft} ${t('days')}`
  }

  return (
    <Card className={cn("min-h-[340px] flex flex-col", className)}>
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-base">{t('upcomingRenewals')}</CardTitle>
        <CardDescription>
          {t('subscriptionsRenewingInNext7Days')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {subscriptions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Calendar className="h-10 w-10 text-muted-foreground opacity-50 mb-2" />
            <p className="text-muted-foreground">{t('noUpcomingRenewalsNext7Days')}</p>
          </div>
        ) : (
          <div className="flex-1 divide-y">
            {subscriptions.map((subscription) => {
              const daysRemaining = daysUntil(subscription.nextBillingDate)
              return (
                <div
                  key={subscription.id}
                  className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0 xl:grid-cols-[minmax(6.5rem,1fr)_auto]"
                >
                  <div className="flex min-w-0 flex-col">
                    <div className="truncate font-medium xl:overflow-visible xl:text-clip xl:whitespace-nowrap">
                      {subscription.name}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {subscription.plan}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-medium tabular-nums">
                        {formatWithUserCurrency(subscription.amount, subscription.currency)}
                      </div>
                      <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground tabular-nums">
                        <CalendarIcon className="h-3 w-3" />
                        {formatDate(subscription.nextBillingDate)}
                      </div>
                    </div>
                    <Badge variant={getBadgeVariant(daysRemaining)}>
                      {getTimeLabel(daysRemaining)}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
