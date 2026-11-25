import { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrencyAmount } from "@/utils/currency"
import {
  Calendar,
  TrendingUp,
  Eye,
  ChevronRight
} from "lucide-react"
import { ExpenseDetailDialog } from "./ExpenseDetailDialog"
import { useTranslation } from "react-i18next"
import { formatExpensePeriodLabel } from "@/utils/expense-period"

export interface ExpenseInfoData {
  period: string
  periodType: 'monthly' | 'quarterly' | 'yearly'
  totalSpent: number
  dailyAverage: number
  activeSubscriptions: number
  paymentCount: number
  startDate: string
  endDate: string
  currency: string
}

interface ExpenseInfoCardsProps {
  monthlyData: ExpenseInfoData[]
  quarterlyData: ExpenseInfoData[]
  yearlyData: ExpenseInfoData[]
  currency: string
  isLoading?: boolean
  className?: string
}

export function ExpenseInfoCards({
  monthlyData,
  quarterlyData,
  yearlyData,
  currency,
  isLoading = false,
  className
}: ExpenseInfoCardsProps) {
  const { t, i18n } = useTranslation('reports')
  const [selectedPeriod, setSelectedPeriod] = useState<ExpenseInfoData | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)



  const handleViewDetails = (data: ExpenseInfoData) => {
    setSelectedPeriod(data)
    setIsDetailDialogOpen(true)
  }

  const renderExpenseCard = (data: ExpenseInfoData, index: number) => {
    return (
      <Card
        key={`${data.periodType}-${index}`}
        className="group cursor-pointer transition-[background-color,border-color,transform] duration-200 hover:border-primary/20 hover:bg-accent/25 active:translate-y-px"
        onClick={() => handleViewDetails(data)}
      >
        <CardContent className="p-4 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calendar className="h-3.5 w-3.5" strokeWidth={1.8} />
              </span>
              <p className="truncate text-sm font-semibold">
                {formatExpensePeriodLabel(data, i18n.resolvedLanguage)}
              </p>
            </div>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            >
              <Eye className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="mt-3 text-center">
            <p className="text-[11px] text-muted-foreground">{t('infoCards.total')}</p>
            <p className="mt-1 text-xl font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {formatCurrencyAmount(data.totalSpent, currency)}
            </p>
          </div>

          <div className="mt-3 divide-y border-y text-xs">
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span>{t('infoCards.dailyAvg')}</span>
              </div>
              <span className="font-medium tabular-nums">
                {formatCurrencyAmount(data.dailyAverage, currency)}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span>{t('infoCards.payments')}</span>
              </div>
              <span className="font-medium tabular-nums">{data.paymentCount}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-8 w-full text-xs text-muted-foreground group-hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              handleViewDetails(data)
            }}
          >
            {t('infoCards.viewDetails')}
            <ChevronRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="space-y-4 p-5 sm:p-5">
                <div className="h-8 w-2/3 rounded-lg bg-muted" />
                <div className="mx-auto h-7 w-1/2 rounded bg-muted" />
                <div className="h-20 rounded-lg bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Monthly Data */}
      <div>
        <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
          <Calendar className="h-4 w-4 text-primary" strokeWidth={1.8} />
          {t('infoCards.monthlyExpenses')}
        </h3>
        {monthlyData.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {monthlyData.slice(-4).map((data, index) => renderExpenseCard(data, index))}
          </div>
        ) : (
          <Card className="flex h-20 items-center justify-center">
            <p className="text-xs text-muted-foreground">{t('infoCards.noMonthlyDataAvailable')}</p>
          </Card>
        )}
      </div>

      {/* Quarterly Data */}
      <div>
        <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
          <Calendar className="h-4 w-4 text-primary" strokeWidth={1.8} />
          {t('infoCards.quarterlyExpenses')}
        </h3>
        {quarterlyData.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quarterlyData.slice(0, 3).map((data, index) => renderExpenseCard(data, index))}
          </div>
        ) : (
          <Card className="flex h-20 items-center justify-center">
            <p className="text-xs text-muted-foreground">{t('infoCards.noQuarterlyDataAvailable')}</p>
          </Card>
        )}
      </div>

      {/* Yearly Data */}
      <div>
        <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
          <Calendar className="h-4 w-4 text-primary" strokeWidth={1.8} />
          {t('infoCards.yearlyExpenses')}
        </h3>
        {yearlyData.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {yearlyData.slice(0, 3).map((data, index) => renderExpenseCard(data, index))}
          </div>
        ) : (
          <Card className="flex h-20 items-center justify-center">
            <p className="text-xs text-muted-foreground">{t('infoCards.noYearlyDataAvailable')}</p>
          </Card>
        )}
      </div>

      {/* Detail Dialog */}
      {selectedPeriod && (
        <ExpenseDetailDialog
          isOpen={isDetailDialogOpen}
          onClose={() => setIsDetailDialogOpen(false)}
          periodData={selectedPeriod}
        />
      )}
    </div>
  )
}
