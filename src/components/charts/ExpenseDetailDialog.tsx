import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

import { formatCurrencyAmount } from "@/utils/currency"
import { transformPaymentsFromApi, type PaymentRecord, type PaymentRecordApi } from '@/utils/dataTransform'
import { apiClient } from '@/utils/api-client'
import { formatDateDisplay } from '@/utils/date'
import { formatExpensePeriodLabel } from '@/utils/expense-period'
import {
  Search,
  Calendar,
  CalendarRange,
  DollarSign,
  CreditCard,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { ExpenseInfoData } from "./ExpenseInfoCards"
import { LoadingIndicator } from "@/components/ui/loading-indicator"

// The API client already extracts the data field, so we get the array directly
type PaymentHistoryApiResponse = PaymentRecordApi[]

interface ExpenseDetailDialogProps {
  isOpen: boolean
  onClose: () => void
  periodData: ExpenseInfoData
}

export function ExpenseDetailDialog({ isOpen, onClose, periodData }: ExpenseDetailDialogProps) {
  const { t, i18n } = useTranslation(['reports', 'common'])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)


  const pageSize = 10

  const fetchPaymentData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      let allPaymentDetails: PaymentRecord[] = []

      if (periodData.periodType === 'monthly') {
        // 月度数据：直接从 payment-history API 获取数据
        const startDate = new Date(periodData.startDate)
        const endDate = new Date(periodData.endDate)

        const startDateStr = startDate.toISOString().split('T')[0]
        const endDateStr = endDate.toISOString().split('T')[0]

        const rawData = await apiClient.get<PaymentHistoryApiResponse>(`/payment-history?start_date=${startDateStr}&end_date=${endDateStr}&status=succeeded`)
        allPaymentDetails = transformPaymentsFromApi(rawData)
      } else {
        // 季度或年度数据：直接从 payment-history API 获取整个时间范围的数据
        const startDate = new Date(periodData.startDate)
        const endDate = new Date(periodData.endDate)

        const startDateStr = startDate.toISOString().split('T')[0]
        const endDateStr = endDate.toISOString().split('T')[0]

        const rawData = await apiClient.get<PaymentHistoryApiResponse>(`/payment-history?start_date=${startDateStr}&end_date=${endDateStr}&status=succeeded`)
        allPaymentDetails = transformPaymentsFromApi(rawData)
      }

      setPayments(allPaymentDetails)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment data')
    } finally {
      setIsLoading(false)
    }
  }, [periodData])

  // Fetch payment data when dialog opens
  useEffect(() => {
    if (isOpen && periodData) {
      fetchPaymentData()
    }
  }, [isOpen, periodData, fetchPaymentData])

  // Reset current page when search term changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Filter payments based on search term
  const filteredPayments = payments.filter(payment =>
    (payment.subscriptionName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (payment.subscriptionPlan?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )

  // Paginate filtered payments
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedPayments = filteredPayments.slice(startIndex, endIndex)

  // Update pagination info based on filtered results
  const filteredTotalPages = Math.ceil(filteredPayments.length / pageSize)


  const getStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case 'succeeded':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'refunded':
        return 'bg-yellow-100 text-yellow-800'
      case 'unknown':
      case null:
      case undefined:
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[88vh] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[22px] p-5 sm:max-w-[960px] sm:p-6">
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {formatExpensePeriodLabel(periodData, i18n.resolvedLanguage)} - {t('reports:chart.paymentDetails')}
          </DialogTitle>
          <DialogDescription>
            {t('reports:chart.viewPaymentRecords')}
          </DialogDescription>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="rounded-[16px] border-border/80 shadow-none">
            <CardContent className="p-0 sm:p-0">
              <div className="flex h-[76px] items-center gap-3 px-4">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] font-medium tracking-[0.03em] text-muted-foreground/80">{t('reports:chart.total')}</p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums">{formatCurrencyAmount(periodData.totalSpent, periodData.currency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-[16px] border-border/80 shadow-none">
            <CardContent className="p-0 sm:p-0">
              <div className="flex h-[76px] items-center gap-3 px-4">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] font-medium tracking-[0.03em] text-muted-foreground/80">{t('reports:chart.payments')}</p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums">
                    {payments.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[16px] border-border/80 shadow-none">
            <CardContent className="p-0 sm:p-0">
              <div className="flex h-[76px] items-center gap-3 px-4">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] font-medium tracking-[0.03em] text-muted-foreground/80">{t('reports:chart.dailyAvg')}</p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums">{formatCurrencyAmount(periodData.dailyAverage, periodData.currency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>


        </div>

        {/* Search */}
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('reports:chart.searchSubscriptions')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 rounded-xl pl-10"
            />
          </div>
        </div>

        {/* Payment List */}
        <div className="max-h-[400px] min-h-0 w-full overflow-y-auto rounded-[18px] border border-border/80 bg-muted/10 p-2">
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center" aria-busy="true">
                <LoadingIndicator />
              </div>
            ) : error ? (
              <div className="text-center text-destructive p-4">
                <p>{t('reports:chart.errorLoadingPayments')}: {error}</p>
                <Button variant="outline" onClick={fetchPaymentData} className="mt-2">
                  {t('common:retry')}
                </Button>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center text-muted-foreground p-4">
                {t('reports:chart.noPaymentsFoundPeriod')}
              </div>
            ) : (
              paginatedPayments.map((payment) => (
                <Card
                  key={payment.id}
                  className="group rounded-[16px] border-border/80 shadow-none transition-[background-color,border-color] duration-200 hover:border-primary/15 hover:bg-accent/25"
                >
                  <CardContent className="p-0 sm:p-0">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-3 px-4 py-3.5 sm:h-[68px] sm:grid-cols-[minmax(150px,.9fr)_minmax(0,2fr)_auto] sm:items-center sm:gap-x-5 sm:px-5 sm:py-0">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold leading-5">{payment.subscriptionName || t('reports:chart.unknownSubscription')}</h4>
                        <p className="mt-0.5 truncate text-[13px] leading-4 text-muted-foreground">
                          {payment.subscriptionPlan || t('reports:chart.unknownPlan')}
                          {payment.billingCycle && ` · ${t(`common:${payment.billingCycle}`, { defaultValue: payment.billingCycle })}`}
                          {(payment.billingCycle === 'yearly' || payment.billingCycle === 'quarterly') && ` · ${t('reports:chart.allocated')}`}
                        </p>
                      </div>

                      <div className="col-span-2 grid min-w-0 gap-1.5 border-t border-border/60 pt-3 sm:col-span-1 sm:gap-1 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                        <div className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] gap-x-2.5 sm:grid-cols-[16px_68px_minmax(0,1fr)] sm:items-center">
                          <Calendar className="h-4 w-4 text-muted-foreground/75" />
                          <p className="text-[11px] font-medium leading-4 tracking-[0.03em] text-muted-foreground/80 sm:text-xs">{t('common:paid')}</p>
                          <p className="col-start-2 text-sm font-medium leading-5 tabular-nums text-foreground/80 sm:col-start-3 sm:whitespace-nowrap">{formatDateDisplay(payment.paymentDate)}</p>
                        </div>
                        <div className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] gap-x-2.5 sm:grid-cols-[16px_68px_minmax(0,1fr)] sm:items-center">
                          <CalendarRange className="h-4 w-4 text-muted-foreground/75" />
                          <p className="text-[11px] font-medium leading-4 tracking-[0.03em] text-muted-foreground/80 sm:text-xs">{t('common:billingPeriod')}</p>
                          <p className="col-start-2 break-words text-[13px] leading-5 tabular-nums text-muted-foreground sm:col-start-3 sm:whitespace-nowrap">
                            {formatDateDisplay(payment.billingPeriod?.start)} – {formatDateDisplay(payment.billingPeriod?.end)}
                          </p>
                        </div>
                      </div>

                      <div className="col-start-2 row-start-1 flex min-w-[84px] flex-col items-end justify-center sm:col-start-3 sm:self-center">
                        <p className="whitespace-nowrap text-[15px] font-semibold leading-5 tabular-nums">{formatCurrencyAmount(payment.amountPaid, payment.currency)}</p>
                        <Badge className={`mt-1 h-5 rounded-md px-2 text-[11px] font-medium ${getStatusColor(payment.status || 'unknown')}`}>
                          {t(`common:${payment.status || 'unknown'}`, { defaultValue: payment.status || t('reports:chart.unknown') })}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Pagination */}
        {filteredTotalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              {t('reports:chart.showingPayments', {
                start: ((currentPage - 1) * pageSize) + 1,
                end: Math.min(currentPage * pageSize, filteredPayments.length),
                total: filteredPayments.length
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('common:previous')}
              </Button>
              <span className="text-sm">
                {t('reports:chart.pageOf', {
                  current: currentPage,
                  total: filteredTotalPages
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(filteredTotalPages, prev + 1))}
                disabled={currentPage === filteredTotalPages}
              >
                {t('common:next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
