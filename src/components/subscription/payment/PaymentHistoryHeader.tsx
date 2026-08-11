import { Calendar, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"

interface PaymentHistoryHeaderProps {
  paymentCount: number
  searchTerm: string
  onSearchChange: (value: string) => void
  onAddPayment: () => void
}

export function PaymentHistoryHeader({
  paymentCount,
  searchTerm,
  onSearchChange,
  onAddPayment
}: PaymentHistoryHeaderProps) {
  const { t } = useTranslation(['subscription', 'common'])
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="whitespace-nowrap text-sm font-medium">{t('subscription:paymentHistory')}</span>
          <Badge variant="outline" className="h-6 whitespace-nowrap rounded-lg px-2 text-xs font-normal">
            {paymentCount} {t('common:records')}
          </Badge>
        </div>
        <Button
          onClick={onAddPayment}
          size="sm"
          className="h-9 shrink-0 gap-1.5 rounded-xl px-3 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('common:addPayment')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('common:searchPayments')}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 rounded-xl pl-10 text-sm"
        />
      </div>
    </div>
  )
}
