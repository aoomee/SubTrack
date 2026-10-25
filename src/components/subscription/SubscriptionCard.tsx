import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Pencil, Trash2, Ban, RotateCcw } from 'lucide-react'
import { Subscription, useSubscriptionStore } from '@/store/subscriptionStore'
import { useSettingsStore } from '@/store/settingsStore'
import { formatDate, daysUntil, getCategoryLabel, getPaymentMethodLabel } from '@/lib/subscription-utils'
import { convertCurrency, formatCurrencyAmount, formatWithUserCurrency } from '@/utils/currency'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface SubscriptionCardProps {
  subscription: Subscription
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  onStatusChange: (id: number, status: 'active' | 'cancelled') => void
  onViewDetails?: (subscription: Subscription) => void
}

export function SubscriptionCard({ subscription, onEdit, onDelete, onStatusChange, onViewDetails }: SubscriptionCardProps) {
  const { id, name, plan, amount, currency, nextBillingDate, billingCycle, status, renewalType } = subscription
  const { categories, paymentMethods } = useSubscriptionStore()
  const displayCurrency = useSettingsStore(state => state.currency)
  const { t } = useTranslation(['common', 'subscription', 'dashboard'])
  const months = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 }[billingCycle]
  const monthlyAmount = convertCurrency(amount / months, currency, displayCurrency)
  const overdue = daysUntil(nextBillingDate) < 0 && status === 'active'
  return (
    <Card className="group cursor-pointer rounded-[24px] transition-colors hover:bg-accent/40"
      role="button" tabIndex={0} aria-label={name}
      onClick={() => onViewDetails?.(subscription)}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onViewDetails?.(subscription)
        }
      }}>
      <CardContent className="p-5 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="service-avatar h-11 w-11 rounded-[15px]" aria-hidden="true">{name.slice(0, 1)}</span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{name}</h3>
              <p className="mt-1 truncate text-xs text-muted-foreground">{plan} · {getCategoryLabel(subscription, categories)}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{getPaymentMethodLabel(subscription, paymentMethods)}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant={overdue ? 'destructive' : 'secondary'} className="gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-foreground' : status === 'trial' ? 'border border-foreground' : 'bg-muted-foreground/40'}`} />
              {t(`subscription:${status}`)}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={event => event.stopPropagation()} aria-label={t('common:options')}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={event => event.stopPropagation()}>
                <DropdownMenuItem onSelect={() => onEdit(id)}><Pencil className="mr-2 h-4 w-4" />{t('common:edit')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onStatusChange(id, status === 'active' ? 'cancelled' : 'active')}>
                  {status === 'active' ? <Ban className="mr-2 h-4 w-4" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  {t(`subscription:${status === 'active' ? 'cancelled' : 'active'}`)}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDelete(id)}><Trash2 className="mr-2 h-4 w-4" />{t('common:delete')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t pt-4">
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            <p className={overdue ? 'text-destructive' : ''}>{t('subscription:nextPayment')} {formatDate(nextBillingDate)}</p>
            <p>{t(renewalType === 'auto' ? 'subscription:automaticRenewal' : 'subscription:manualRenewal')} · {t(`common:${billingCycle}`)}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-base font-semibold">{formatWithUserCurrency(amount, currency)}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{t('dashboard:monthlyEquivalent', { amount: formatCurrencyAmount(monthlyAmount, displayCurrency) })}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
