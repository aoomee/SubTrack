import { Calendar, CalendarRange, Edit, Trash2, MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { PaymentRecord } from "@/utils/dataTransform"
import { formatWithUserCurrency } from "@/utils/currency"
import { formatDateDisplay } from "@/utils/date"

interface PaymentListItemProps {
  payment: PaymentRecord
  onEdit: (payment: PaymentRecord) => void
  onDelete: (paymentId: number) => void
}

export function PaymentListItem({
  payment,
  onEdit,
  onDelete
}: PaymentListItemProps) {
  const { t } = useTranslation(['common', 'subscription'])
  // Get status badge color
  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'succeeded':
        return 'default'
      case 'failed':
        return 'destructive'
      case 'refunded':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const statusLabel = t(`common:${payment.status.toLowerCase()}`, {
    defaultValue: payment.status.charAt(0).toUpperCase() + payment.status.slice(1)
  })

  return (
    <Card className="group rounded-[16px] border-border/80 shadow-none transition-[background-color,border-color] duration-200 hover:border-primary/15 hover:bg-accent/25">
      <CardContent className="p-0 sm:p-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-3 px-4 py-3.5 sm:h-[56px] sm:grid-cols-[minmax(152px,.8fr)_minmax(0,2fr)_auto] sm:items-center sm:gap-x-5 sm:px-5 sm:py-0">
          <div className="min-w-0 sm:flex sm:items-center sm:justify-center sm:gap-2 sm:text-center">
            <p className="whitespace-nowrap text-lg font-semibold leading-6 tabular-nums">
              {formatWithUserCurrency(payment.amountPaid, payment.currency)}
            </p>
            <Badge
              variant={getStatusBadgeVariant(payment.status)}
              className="mt-1.5 h-5 w-fit px-2 text-xs font-medium sm:mt-0"
            >
              {statusLabel}
            </Badge>
          </div>

          <div className="col-span-2 grid min-w-0 gap-1.5 border-t border-border/60 pt-3 sm:col-span-1 sm:gap-1 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            <div className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] gap-x-2.5 sm:grid-cols-[16px_68px_minmax(0,1fr)] sm:items-center">
              <Calendar className="h-4 w-4 text-muted-foreground/75" />
              <p className="text-[11px] font-medium leading-4 tracking-[0.03em] text-muted-foreground/80 sm:text-xs">
                {t('common:paid')}
              </p>
              <p className="col-start-2 text-sm font-medium leading-5 tabular-nums text-foreground/80 sm:col-start-3 sm:whitespace-nowrap">
                {formatDateDisplay(payment.paymentDate)}
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] gap-x-2.5 sm:grid-cols-[16px_68px_minmax(0,1fr)] sm:items-center">
              <CalendarRange className="h-4 w-4 text-muted-foreground/75" />
              <p className="text-[11px] font-medium leading-4 tracking-[0.03em] text-muted-foreground/80 sm:text-xs">
                {t('common:billingPeriod')}
              </p>
              <p className="col-start-2 break-words text-[13px] leading-5 tabular-nums text-muted-foreground sm:col-start-3 sm:whitespace-nowrap">
                {formatDateDisplay(payment.billingPeriod.start)} – {formatDateDisplay(payment.billingPeriod.end)}
              </p>
            </div>
          </div>

          <div className="col-start-2 row-start-1 shrink-0 self-start sm:col-start-3 sm:self-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 touch-manipulation rounded-xl p-0 opacity-65 transition-opacity group-hover:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => onEdit(payment)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Edit className="h-4 w-4" />
                  {t('common:editPayment')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(payment.id)}
                  className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('common:deletePayment')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
