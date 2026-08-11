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
      className="group w-full cursor-pointer overflow-hidden transition-[background-color,border-color,transform] duration-200 hover:border-primary/20 hover:bg-accent/35 active:translate-y-px"
      onClick={() => onViewDetails?.(subscription)}
    >
      <CardContent className="p-0 sm:p-0">
        <div className="grid min-h-[92px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3 px-5 py-4 sm:grid-cols-[minmax(190px,1.3fr)_minmax(110px,.65fr)_minmax(130px,.8fr)_minmax(160px,.9fr)_auto] sm:px-6 xl:grid-cols-[minmax(190px,1.25fr)_minmax(105px,.6fr)_minmax(130px,.75fr)_minmax(180px,1fr)_minmax(130px,.75fr)_auto]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background text-sm font-semibold text-primary">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[15px] font-semibold">{name}</h3>
                  <Badge variant={status === 'active' ? 'success' : 'secondary'}>
                    {t(`subscription:${status}`)}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{plan}</p>
              </div>
            </div>
          </div>

          <div className="text-right sm:text-left">
            <p className="text-[15px] font-semibold tabular-nums">{formatWithUserCurrency(amount, currency)}</p>
            <div className="mt-1">
              <Badge variant={getBillingCycleBadgeVariant()}>
                {t(`common:${billingCycle}`, { defaultValue: billingCycle })}
              </Badge>
            </div>
          </div>

          <div className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground sm:flex">
            <Tag className="h-4 w-4 shrink-0" />
            <span className="truncate">{categoryLabel}</span>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-3 border-t pt-3 text-sm sm:border-0 sm:pt-0">
            <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className={isExpiringSoon ? "truncate font-medium text-warning" : "truncate"}>
                {formatDate(nextBillingDate)}
              </span>
            </div>
            {isExpiringSoon && status === 'active' && (
              <Badge variant={getBadgeVariant()}>
                {daysLeft === 0 ? t('common:today') : `${daysLeft} ${t('common:days')}`}
              </Badge>
            )}
          </div>

          <div className="hidden min-w-0 items-center gap-3 text-sm text-muted-foreground xl:flex">
            <span className="flex min-w-0 items-center gap-2">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="truncate">{paymentMethodLabel}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {renewalType === 'auto' ? <RotateCcw className="h-4 w-4" /> : <Hand className="h-4 w-4" />}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
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
        </div>
      </CardContent>
    </Card>
  )
}
