import { useState, useMemo, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { useSubscriptionStore } from "@/store/subscriptionStore"
import { useSettingsStore } from "@/store/settingsStore"
import { useExpenseReportsStore } from "@/store/expenseReportsStore"
import {
  getApiMonthlyExpenses,
  getApiCategoryExpenses,
  getApiMonthlyCategoryExpenses,
  getApiYearlyCategoryExpenses,
  calculateYearlyExpensesFromMonthly,
  MonthlyExpense,
  YearlyExpense,
  CategoryExpense
} from "@/lib/expense-analytics-api"
import {
  convertMonthlyExpensesToInfo,
  calculateQuarterlyExpenses,
  calculateYearlyExpenses,
  filterRecentExpenses
} from "@/lib/expense-info-analytics"
import { ExpenseInfoData } from "@/components/charts/ExpenseInfoCards"
import { ExpenseTrendChart } from "@/components/charts/ExpenseTrendChart"
import { YearlyTrendChart } from "@/components/charts/YearlyTrendChart"
import { CategoryPieChart } from "@/components/charts/CategoryPieChart"
import { ExpenseInfoCards } from "@/components/charts/ExpenseInfoCards"
import { apiClient } from '@/utils/api-client'
import { formatCurrencyAmount } from '@/utils/currency'
import type { PaymentRecordApi } from '@/utils/dataTransform'

import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import { PageLoading } from "@/components/ui/page-loading"

export function ExpenseReportsPage() {
  const { fetchSubscriptions, fetchCategories } = useSubscriptionStore()
  const { t } = useTranslation(['reports', 'common'])
  const { currency: userCurrency, fetchSettings } = useSettingsStore()

  const cachedStore = useExpenseReportsStore()
  const hasWarmCache = cachedStore.hasLoaded && cachedStore.currency === userCurrency

  const [isInitializingData, setIsInitializingData] = useState(() => !hasWarmCache)
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false)

  // Stable date ranges
  const currentDateRange = useMemo(() => {
    const now = new Date()
    return {
      startDate: new Date(now.getFullYear(), now.getMonth() - 11, 1),
      endDate: now,
    }
  }, [])

  const currentYearlyDateRange = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    return {
      startDate: new Date(currentYear - 2, 0, 1),
      endDate: new Date(currentYear, currentMonth, new Date(currentYear, currentMonth + 1, 0).getDate()),
    }
  }, [])

  // Local state hydrated immediately from cache when available
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>(() =>
    hasWarmCache ? cachedStore.monthlyExpenses : []
  )
  const [yearlyExpenses, setYearlyExpenses] = useState<YearlyExpense[]>(() =>
    hasWarmCache ? cachedStore.yearlyExpenses : []
  )
  const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpense[]>(() =>
    hasWarmCache ? cachedStore.categoryExpenses : []
  )
  const [yearlyCategoryExpenses, setYearlyCategoryExpenses] = useState<CategoryExpense[]>(() =>
    hasWarmCache ? cachedStore.yearlyCategoryExpenses : []
  )
  const [monthlyCategoryExpenses, setMonthlyCategoryExpenses] = useState(() =>
    hasWarmCache ? cachedStore.monthlyCategoryExpenses : []
  )
  const [yearlyGroupedCategoryExpenses, setYearlyGroupedCategoryExpenses] = useState(() =>
    hasWarmCache ? cachedStore.yearlyGroupedCategoryExpenses : []
  )
  const [expenseInfoData, setExpenseInfoData] = useState(() =>
    hasWarmCache
      ? cachedStore.expenseInfoData
      : { monthly: [] as ExpenseInfoData[], quarterly: [] as ExpenseInfoData[], yearly: [] as ExpenseInfoData[] }
  )

  const [isLoadingExpenses, setIsLoadingExpenses] = useState(!hasWarmCache)
  const [isLoadingYearlyExpenses, setIsLoadingYearlyExpenses] = useState(!hasWarmCache)
  const [isLoadingCategoryExpenses, setIsLoadingCategoryExpenses] = useState(!hasWarmCache)
  const [isLoadingYearlyCategoryExpenses, setIsLoadingYearlyCategoryExpenses] = useState(!hasWarmCache)
  const [isLoadingMonthlyCategoryExpenses, setIsLoadingMonthlyCategoryExpenses] = useState(!hasWarmCache)
  const [isLoadingYearlyGroupedCategoryExpenses, setIsLoadingYearlyGroupedCategoryExpenses] = useState(!hasWarmCache)
  const [isLoadingExpenseInfo, setIsLoadingExpenseInfo] = useState(!hasWarmCache)

  const [expenseError, setExpenseError] = useState<string | null>(null)
  const [yearlyExpenseError, setYearlyExpenseError] = useState<string | null>(null)
  const [categoryExpenseError, setCategoryExpenseError] = useState<string | null>(null)
  const [yearlyCategoryExpenseError, setYearlyCategoryExpenseError] = useState<string | null>(null)
  const [expenseInfoError, setExpenseInfoError] = useState<string | null>(null)

  const loadAllReportData = useCallback(async () => {
    const store = useExpenseReportsStore.getState()
    const warm = store.hasLoaded && store.currency === userCurrency

    if (warm) {
      setMonthlyExpenses(store.monthlyExpenses)
      setYearlyExpenses(store.yearlyExpenses)
      setCategoryExpenses(store.categoryExpenses)
      setYearlyCategoryExpenses(store.yearlyCategoryExpenses)
      setMonthlyCategoryExpenses(store.monthlyCategoryExpenses)
      setYearlyGroupedCategoryExpenses(store.yearlyGroupedCategoryExpenses)
      setExpenseInfoData(store.expenseInfoData)
      setIsInitializingData(false)
      setIsLoadingExpenses(false)
      setIsLoadingYearlyExpenses(false)
      setIsLoadingCategoryExpenses(false)
      setIsLoadingYearlyCategoryExpenses(false)
      setIsLoadingMonthlyCategoryExpenses(false)
      setIsLoadingYearlyGroupedCategoryExpenses(false)
      setIsLoadingExpenseInfo(false)
    } else {
      setIsInitializingData(true)
      setIsLoadingExpenses(true)
      setIsLoadingYearlyExpenses(true)
      setIsLoadingCategoryExpenses(true)
      setIsLoadingYearlyCategoryExpenses(true)
      setIsLoadingMonthlyCategoryExpenses(true)
      setIsLoadingYearlyGroupedCategoryExpenses(true)
      setIsLoadingExpenseInfo(true)
    }

    setExpenseError(null)
    setYearlyExpenseError(null)
    setCategoryExpenseError(null)
    setYearlyCategoryExpenseError(null)
    setExpenseInfoError(null)

    const cashEnd = new Date()
    const cashStart = new Date()
    cashStart.setMonth(cashStart.getMonth() - 12)

    const [
      ,
      ,
      ,
      monthlyRes,
      monthlyCatRes,
      catRes,
      yearlyMonthlyRes,
      yearlyCatRes,
      yearlyGroupedRes,
      cashMonthlyRes,
    ] = await Promise.allSettled([
      fetchSubscriptions(),
      fetchCategories(),
      fetchSettings(),
      getApiMonthlyExpenses(currentDateRange.startDate, currentDateRange.endDate, userCurrency),
      getApiMonthlyCategoryExpenses(currentDateRange.startDate, currentDateRange.endDate, userCurrency),
      getApiCategoryExpenses(currentDateRange.startDate, currentDateRange.endDate, userCurrency),
      getApiMonthlyExpenses(currentYearlyDateRange.startDate, currentYearlyDateRange.endDate, userCurrency),
      getApiCategoryExpenses(currentYearlyDateRange.startDate, currentYearlyDateRange.endDate, userCurrency),
      getApiYearlyCategoryExpenses(currentYearlyDateRange.startDate, currentYearlyDateRange.endDate, userCurrency),
      getApiMonthlyExpenses(cashStart, cashEnd, userCurrency, 'cash'),
    ])

    let nextMonthly = store.currency === userCurrency ? store.monthlyExpenses : []
    if (monthlyRes.status === 'fulfilled') {
      nextMonthly = monthlyRes.value
      setMonthlyExpenses(nextMonthly)
    } else {
      console.error('Failed to load monthly expense data:', monthlyRes.reason)
      setExpenseError(monthlyRes.reason instanceof Error ? monthlyRes.reason.message : 'Failed to load monthly expense data')
    }

    let nextMonthlyCat = store.currency === userCurrency ? store.monthlyCategoryExpenses : []
    if (monthlyCatRes.status === 'fulfilled') {
      nextMonthlyCat = monthlyCatRes.value
      setMonthlyCategoryExpenses(nextMonthlyCat)
    } else {
      console.error('Failed to load monthly category expense data:', monthlyCatRes.reason)
    }

    let nextCat = store.currency === userCurrency ? store.categoryExpenses : []
    if (catRes.status === 'fulfilled') {
      nextCat = catRes.value
      setCategoryExpenses(nextCat)
    } else {
      console.error('Failed to load category expense data:', catRes.reason)
      setCategoryExpenseError(catRes.reason instanceof Error ? catRes.reason.message : 'Failed to load category expense data')
    }

    let nextYearly = store.currency === userCurrency ? store.yearlyExpenses : []
    if (yearlyMonthlyRes.status === 'fulfilled') {
      nextYearly = calculateYearlyExpensesFromMonthly(yearlyMonthlyRes.value)
      setYearlyExpenses(nextYearly)
    } else {
      console.error('Failed to load yearly expense data:', yearlyMonthlyRes.reason)
      setYearlyExpenseError(yearlyMonthlyRes.reason instanceof Error ? yearlyMonthlyRes.reason.message : 'Failed to load yearly expense data')
    }

    let nextYearlyCat = store.currency === userCurrency ? store.yearlyCategoryExpenses : []
    if (yearlyCatRes.status === 'fulfilled') {
      nextYearlyCat = yearlyCatRes.value
      setYearlyCategoryExpenses(nextYearlyCat)
    } else {
      console.error('Failed to load yearly category expense data:', yearlyCatRes.reason)
      setYearlyCategoryExpenseError(yearlyCatRes.reason instanceof Error ? yearlyCatRes.reason.message : 'Failed to load yearly category expense data')
    }

    let nextYearlyGrouped = store.currency === userCurrency ? store.yearlyGroupedCategoryExpenses : []
    if (yearlyGroupedRes.status === 'fulfilled') {
      nextYearlyGrouped = yearlyGroupedRes.value
      setYearlyGroupedCategoryExpenses(nextYearlyGrouped)
    } else {
      console.error('Failed to load yearly grouped category expense data:', yearlyGroupedRes.reason)
    }

    let nextExpenseInfo = store.currency === userCurrency
      ? store.expenseInfoData
      : { monthly: [] as ExpenseInfoData[], quarterly: [] as ExpenseInfoData[], yearly: [] as ExpenseInfoData[] }

    if (cashMonthlyRes.status === 'fulfilled') {
      const allMonthlyData = cashMonthlyRes.value
      if (allMonthlyData && allMonthlyData.length > 0) {
        const { monthlyExpenses: recentMonthly, quarterlyExpenses: recentQuarterly, yearlyExpenses: recentYearly } = filterRecentExpenses(allMonthlyData)
        const monthlyInfo = convertMonthlyExpensesToInfo(recentMonthly, userCurrency)
        const quarterlyInfo = calculateQuarterlyExpenses(recentQuarterly, userCurrency)
        const yearlyInfo = calculateYearlyExpenses(recentYearly, userCurrency)

        const allItems = [...monthlyInfo, ...quarterlyInfo, ...yearlyInfo]
        let allRecords: PaymentRecordApi[] = []
        if (allItems.length > 0) {
          const minStart = allItems.reduce((min, item) => (item.startDate < min ? item.startDate : min), allItems[0].startDate)
          const maxEnd = allItems.reduce((max, item) => (item.endDate > max ? item.endDate : max), allItems[0].endDate)
          try {
            allRecords = await apiClient.get<PaymentRecordApi[]>(
              `/payment-history?start_date=${minStart}&end_date=${maxEnd}&status=succeeded`
            )
          } catch {
            allRecords = []
          }
        }

        const fillAccurateCounts = (list: ExpenseInfoData[]): ExpenseInfoData[] => {
          if (!allRecords.length) return list
          return list.map((item) => {
            const count = allRecords.filter((rec) => {
              const dateStr = (rec.payment_date || '').slice(0, 10)
              return dateStr >= item.startDate && dateStr <= item.endDate
            }).length
            return { ...item, paymentCount: count }
          })
        }

        nextExpenseInfo = {
          monthly: fillAccurateCounts(monthlyInfo),
          quarterly: fillAccurateCounts(quarterlyInfo),
          yearly: fillAccurateCounts(yearlyInfo),
        }
      } else {
        nextExpenseInfo = { monthly: [], quarterly: [], yearly: [] }
      }
      setExpenseInfoData(nextExpenseInfo)
    } else {
      console.error('Failed to load expense info data:', cashMonthlyRes.reason)
      setExpenseInfoError(cashMonthlyRes.reason instanceof Error ? cashMonthlyRes.reason.message : 'Failed to load expense info data')
      setExpenseInfoData({ monthly: [], quarterly: [], yearly: [] })
    }

    if (monthlyRes.status === 'fulfilled') {
      useExpenseReportsStore.getState().setReportData({
        currency: userCurrency,
        monthlyExpenses: nextMonthly,
        yearlyExpenses: nextYearly,
        categoryExpenses: nextCat,
        yearlyCategoryExpenses: nextYearlyCat,
        monthlyCategoryExpenses: nextMonthlyCat,
        yearlyGroupedCategoryExpenses: nextYearlyGrouped,
        expenseInfoData: nextExpenseInfo,
      })
    }

    setIsLoadingExpenses(false)
    setIsLoadingYearlyExpenses(false)
    setIsLoadingCategoryExpenses(false)
    setIsLoadingYearlyCategoryExpenses(false)
    setIsLoadingMonthlyCategoryExpenses(false)
    setIsLoadingYearlyGroupedCategoryExpenses(false)
    setIsLoadingExpenseInfo(false)
    setIsInitializingData(false)
  }, [currentDateRange, currentYearlyDateRange, fetchCategories, fetchSettings, fetchSubscriptions, userCurrency])

  useEffect(() => {
    void loadAllReportData()
  }, [loadAllReportData])

  if (isInitializingData) {
    return <PageLoading />
  }

  return (
    <Tabs keepMounted defaultValue="monthly" className="space-y-4">
      {/* Header + Monthly/Yearly Switch */}
      <div className="ledger-page-heading mb-0">
        <h1>{t('title')}</h1>
        {!expenseError && (
          <TabsList className="grid h-8 w-fit min-w-[136px] grid-cols-2 p-0.5">
            <TabsTrigger value="monthly" className="h-7 px-3 text-xs">{t('monthly')}</TabsTrigger>
            <TabsTrigger value="yearly" className="h-7 px-3 text-xs">{t('yearly')}</TabsTrigger>
          </TabsList>
        )}
      </div>

      <Card className="grid grid-cols-2 overflow-hidden md:grid-cols-4 [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b md:[&>*]:border-b-0 md:[&>*:not(:last-child)]:border-r">
        {[
          [t('ledger.monthlyAverage'), isLoadingExpenses || expenseError ? '—' : formatCurrencyAmount(monthlyExpenses.reduce((sum, item) => sum + item.amount, 0) / (monthlyExpenses.length || 1), userCurrency)],
          [t('ledger.yearAllocated'), isLoadingYearlyExpenses || yearlyExpenseError ? '—' : formatCurrencyAmount(yearlyExpenses.find(item => item.year === new Date().getFullYear())?.amount || 0, userCurrency)],
          [t('ledger.topCategory'), isLoadingCategoryExpenses || categoryExpenseError ? '—' : categoryExpenses[0]?.category || '—'],
          [t('ledger.yearPaid'), isLoadingExpenseInfo || expenseInfoError ? '—' : formatCurrencyAmount(expenseInfoData.yearly.find(item => item.startDate.startsWith(String(new Date().getFullYear())))?.totalSpent || 0, userCurrency)],
        ].map(([label, value]) => <div key={label} className="min-w-0 border-border px-4 py-3 text-center sm:px-5 sm:py-3.5">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 truncate text-xl font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[22px]">{value}</p>
        </div>)}
      </Card>

      {expenseError && (
        <Card className="flex h-28 items-center justify-center p-5">
          <div className="text-center">
            <p className="mb-1.5 text-sm text-destructive">{t('failedToLoadExpenseData')}</p>
            <p className="text-xs text-muted-foreground">{expenseError}</p>
          </div>
        </Card>
      )}

      {/* Charts */}
      {!expenseError && (
        <>
          <TabsContent value="monthly" className="mt-0">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              {isLoadingExpenses ? (
                <Card className="flex min-h-[280px] items-center justify-center" aria-busy="true">
                  <LoadingIndicator size="md" />
                </Card>
              ) : (
                <ExpenseTrendChart
                  data={monthlyExpenses}
                  categoryData={isLoadingMonthlyCategoryExpenses ? undefined : monthlyCategoryExpenses}
                  currency={userCurrency}
                />
              )}
              {isLoadingCategoryExpenses ? (
                <Card className="flex min-h-[280px] items-center justify-center" aria-busy="true">
                  <LoadingIndicator size="md" />
                </Card>
              ) : categoryExpenseError ? (
                <Card className="flex min-h-[280px] items-center justify-center p-5">
                  <div className="text-center text-destructive">
                    <p className="font-medium">{t('failedToLoadCategoryData')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{categoryExpenseError}</p>
                  </div>
                </Card>
              ) : (
                <CategoryPieChart
                  data={categoryExpenses}
                  currency={userCurrency}
                  descriptionKey="chart.breakdownByCategory"
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="yearly" className="mt-0">
            {isLoadingYearlyExpenses ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" aria-busy="true">
                <Card className="flex min-h-[280px] items-center justify-center">
                  <LoadingIndicator size="md" />
                </Card>
                <Card className="flex min-h-[280px] items-center justify-center">
                  <LoadingIndicator size="md" />
                </Card>
              </div>
            ) : yearlyExpenseError ? (
              <div className="flex h-28 items-center justify-center">
                <div className="text-center">
                  <p className="mb-1.5 text-sm text-destructive">{t('failedToLoadYearlyData')}</p>
                  <p className="text-xs text-muted-foreground">{yearlyExpenseError}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
                <YearlyTrendChart
                  data={yearlyExpenses}
                  categoryData={isLoadingYearlyGroupedCategoryExpenses ? undefined : yearlyGroupedCategoryExpenses}
                  currency={userCurrency}
                />
                {isLoadingYearlyCategoryExpenses ? (
                  <Card className="flex min-h-[280px] items-center justify-center" aria-busy="true">
                    <LoadingIndicator size="md" />
                  </Card>
                ) : yearlyCategoryExpenseError ? (
                  <Card className="flex min-h-[280px] items-center justify-center p-5">
                    <div className="text-center text-destructive">
                      <p className="font-medium">{t('failedToLoadYearlyCategoryData')}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{yearlyCategoryExpenseError}</p>
                    </div>
                  </Card>
                ) : (
                  <CategoryPieChart
                    data={yearlyCategoryExpenses}
                    currency={userCurrency}
                    descriptionKey="chart.breakdownByCategoryYearly"
                  />
                )}
              </div>
            )}
          </TabsContent>
        </>
      )}

      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => setIsPaymentHistoryOpen((prev) => !prev)}
          aria-expanded={isPaymentHistoryOpen}
          className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6 sm:py-4"
        >
          <span className="text-sm font-semibold">{t('ledger.paymentHistory')}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
              isPaymentHistoryOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        <div className="collapsible-grid" data-open={isPaymentHistoryOpen}>
          <div>
            <div className="border-t px-4 pb-5 pt-4 sm:px-5">
              {isLoadingExpenseInfo ? (
                <ExpenseInfoCards
                  monthlyData={[]}
                  quarterlyData={[]}
                  yearlyData={[]}
                  currency={userCurrency}
                  isLoading={true}
                />
              ) : expenseInfoError ? (
                <div className="flex h-24 items-center justify-center">
                  <div className="text-center">
                    <p className="mb-1.5 text-sm text-destructive">{t('failedToLoadExpenseOverview')}</p>
                    <p className="text-xs text-muted-foreground">{expenseInfoError}</p>
                  </div>
                </div>
              ) : (
                <ExpenseInfoCards
                  monthlyData={expenseInfoData.monthly}
                  quarterlyData={expenseInfoData.quarterly}
                  yearlyData={expenseInfoData.yearly}
                  currency={userCurrency}
                />
              )}
            </div>
          </div>
        </div>
      </Card>
    </Tabs>
  )
}
