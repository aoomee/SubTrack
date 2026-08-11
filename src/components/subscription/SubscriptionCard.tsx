import { useTranslation } from "react-i18next"
import {
  Calendar,
  CreditCard,
  MoreVertical,
  Pencil,
  Trash2,
  Ban,
  Tag,
  RotateCcw,
  Hand
} from "lucide-react"

import { Subscription, useSubscriptionStore } from "@/store/subscriptionStore"
import {
  formatDate,
  daysUntil,
  getCategoryLabel,
  getPaymentMethodLabel
} from "@/lib/subscription-utils"
import { formatWithUserCurrency } from "@/utils/currency"

import {
  Card,
  CardContent
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SubscriptionCardProps {
  subscription: Subscription
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  onStatusChange: (id: number, status: 'active' | 'cancelled') => void
  onViewDetails?: (subscription: Subscription) => void
}

export function SubscriptionCard({
  subscription,
  onEdit,
  onDelete,
  onStatusChange,
  onViewDetails
}: SubscriptionCardProps) {
  const {
    id,
    name,
    plan,
    amount,
    currency,
    nextBillingDate,
    billingCycle,
    status,
    renewalType
  } = subscription
  
  // Get options from the store
  const { categories, paymentMethods } = useSubscriptionStore()
  const { t } = useTranslation(['common', 'subscription'])

  // Get the category and payment method labels using unified utility functions
  const categoryLabel = getCategoryLabel(subscription, categories)
  const paymentMethodLabel = getPaymentMethodLabel(subscription, paymentMethods)

  const daysLeft = daysUntil(nextBillingDate)
  const isExpiringSoon = daysLeft <= 7
  
  // Helper function to determine badge color based on urgency
  const getBadgeVariant = () => {
    if (status === 'cancelled') return "secondary"
    if (daysLeft <= 3) return "destructive"
    if (daysLeft <= 7) return "warning"
    return "secondary"
  }

  // Helper function to determine billing cycle badge variant
  const getBillingCycleBadgeVariant = () => {
    switch (billingCycle) {
      case 'yearly':
        return "success" // Green color for yearly
      case 'monthly':
        return "warning" // Orange/yellow for monthly
      case 'quarterly':
        return "info" // Blue for quarterly
      case 'semiannual':
        return "default"
      default:
        return "outline"
    }
  }

  return (
    <Card
      className="group w-full cursor-pointer overflow-hidden rounded-[18px] border-border/80 shadow-none transition-[background-color,border-color,transform] duration-200 hover:border-primary/20 hover:bg-accent/35 active:translate-y-px"
      onClick={() => onViewDetails?.(subscription)}
    >
      <CardContent className="p-0 sm:p-0">
        <div className="grid min-h-[88px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-3 px-5 py-2 sm:grid-cols-[minmax(220px,1.35fr)_minmax(140px,.8fr)_minmax(150px,.9fr)_minmax(190px,1fr)_minmax(180px,1fr)_auto] sm:items-stretch sm:gap-x-0 sm:px-6">
          <div className="min-w-0 sm:flex sm:self-stretch sm:items-center sm:justify-center">
            <div className="min-w-0 max-w-full sm:grid sm:w-[168px] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-2">
              <div className="min-w-0">
                <h3 className="break-words text-[15px] font-semibold leading-5">{name}</h3>
                <p className="mt-0.5 break-words text-[13px] leading-4 text-muted-foreground">{plan}</p>
              </div>
              <Badge className="mt-1.5 h-5 shrink-0 rounded-md px-2 text-[11px] font-medium sm:mt-0 sm:justify-self-end" variant={status === 'active' ? 'success' : 'secondary'}>
                {t(`subscription:${status}`)}
              </Badge>
            </div>
          </div>

          <div className="col-start-2 row-start-1 text-right sm:col-auto sm:row-auto sm:flex sm:self-stretch sm:flex-col sm:items-center sm:justify-center sm:gap-0.5 sm:border-l sm:border-border/60 sm:px-4 sm:text-center">
            <p className="mb-1 text-[11px] font-medium tracking-[0.03em] text-muted-foreground/80 sm:mb-0 sm:leading-4">{t('subscription:amount')}</p>
            <p className="whitespace-nowrap text-[15px] font-semibold tabular-nums sm:flex sm:min-h-5 sm:items-center">{formatWithUserCurrency(amount, currency)}</p>
            <div className="mt-2 sm:flex sm:min-h-[22px] sm:items-center sm:justify-center sm:mt-0">
              <Badge variant={getBillingCycleBadgeVariant()}>
                {t(`common:${billingCycle}`, { defaultValue: billingCycle })}
              </Badge>
            </div>
          </div>

          <div className="hidden min-w-0 border-border/60 text-sm sm:flex sm:self-stretch sm:flex-col sm:items-center sm:justify-center sm:gap-1 sm:border-l sm:px-4 sm:text-center">
            <p className="text-[11px] font-medium leading-4 tracking-[0.03em] text-muted-foreground/80">{t('subscription:category')}</p>
            <div className="grid min-h-8 w-full grid-cols-[20px_minmax(0,1fr)_20px] items-center text-center text-muted-foreground">
              <Tag className="col-start-1 h-4 w-4 shrink-0 justify-self-start text-muted-foreground/80" />
              <span className="col-start-2 min-w-0 justify-self-center break-words text-center text-[13px] font-medium leading-4 text-foreground/75">{categoryLabel}</span>
            </div>
          </div>

          <div className="col-span-3 row-start-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center border-t pt-3 text-sm sm:col-auto sm:row-auto sm:flex sm:self-stretch sm:flex-col sm:items-center sm:justify-center sm:gap-0.5 sm:border-l sm:border-t-0 sm:border-border/60 sm:px-4 sm:pt-0 sm:text-center">
            <p className="col-start-1 row-start-1 text-[11px] font-medium tracking-[0.03em] text-muted-foreground/80 sm:col-auto sm:row-auto sm:leading-4">{t('subscription:nextPayment')}</p>
            <div className="col-start-1 row-start-2 flex h-7 min-w-0 items-center gap-2 text-muted-foreground sm:col-auto sm:row-auto sm:grid sm:min-h-[22px] sm:w-full sm:grid-cols-[20px_minmax(0,1fr)_20px] sm:text-center">
              <Calendar className="h-4 w-4 shrink-0 text-muted-foreground/80 sm:col-start-1 sm:justify-self-start" />
              <span className={isExpiringSoon ? "whitespace-nowrap text-sm font-medium text-warning sm:col-start-2 sm:justify-self-center" : "whitespace-nowrap text-sm font-medium text-foreground/75 sm:col-start-2 sm:justify-self-center"}>
                {formatDate(nextBillingDate)}
              </span>
            </div>
            {isExpiringSoon && status === 'active' && (
              <div className="col-start-2 row-span-2 row-start-1 flex items-center pl-3 sm:col-auto sm:row-auto sm:row-span-1 sm:min-h-[22px] sm:justify-center sm:pl-0">
                <Badge variant={getBadgeVariant()}>
                  {daysLeft === 0 ? t('common:today') : `${daysLeft} ${t('common:days')}`}
                </Badge>
              </div>
            )}
          </div>

          <div className="hidden min-w-0 border-border/60 text-sm sm:flex sm:self-stretch sm:flex-col sm:items-center sm:justify-center sm:gap-0.5 sm:border-l sm:px-4 sm:text-center">
            <p className="text-[11px] font-medium leading-4 tracking-[0.03em] text-muted-foreground/80">{t('subscription:paymentMethod')}</p>
            <div className="grid min-h-[22px] w-full grid-cols-[20px_minmax(0,1fr)_20px] items-center text-center text-muted-foreground">
              <CreditCard className="col-start-1 h-4 w-4 shrink-0 justify-self-start text-muted-foreground/80" />
              <span className="col-start-2 min-w-0 justify-self-center break-words text-center text-sm font-medium leading-4 text-foreground/75">{paymentMethodLabel}</span>
            </div>
            <div className="grid min-h-[22px] w-full grid-cols-[20px_minmax(0,1fr)_20px] items-center text-center text-muted-foreground">
              {renewalType === 'auto' ? <RotateCcw className="col-start-1 h-4 w-4 shrink-0 justify-self-start text-muted-foreground/80" /> : <Hand className="col-start-1 h-4 w-4 shrink-0 justify-self-start text-muted-foreground/80" />}
              <span className="col-start-2 min-w-0 justify-self-center break-words text-center text-sm leading-4 text-muted-foreground">
                {renewalType === 'auto' ? t('subscription:automaticRenewal') : t('subscription:manualRenewal')}
              </span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="col-start-3 row-start-1 h-9 w-9 sm:col-auto sm:row-auto sm:self-center sm:justify-self-center"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">{t('common:options')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(id) }}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('common:edit')}
              </DropdownMenuItem>
              {status === 'active' ? (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(id, 'cancelled') }}>
                  <Ban className="mr-2 h-4 w-4" />
                  {t('subscription:cancelled')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(id, 'active') }}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {t('subscription:active')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(id) }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('common:delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="col-span-3 row-start-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 text-sm sm:hidden">
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">{t('subscription:category')}</p>
              <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <Tag className="h-4 w-4 shrink-0" />
                <span className="break-words">{categoryLabel}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">{t('subscription:paymentMethod')}</p>
              <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <CreditCard className="h-4 w-4 shrink-0" />
                <span className="break-words">{paymentMethodLabel}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">{t('subscription:renewalType')}</p>
              <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                {renewalType === 'auto' ? <RotateCcw className="h-4 w-4 shrink-0" /> : <Hand className="h-4 w-4 shrink-0" />}
                <span className="break-words">
                  {renewalType === 'auto' ? t('subscription:automaticRenewal') : t('subscription:manualRenewal')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
