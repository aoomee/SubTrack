import { useState, useEffect, useCallback, useMemo } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useTranslation } from "react-i18next"

import {
  useSubscriptionStore,
  Subscription
} from "@/store/subscriptionStore"
import { useSubscriptionStats } from "@/store/subscriptionHooks"
import { useSettingsStore } from "@/store/settingsStore"
import { useExpenseReportsStore } from "@/store/expenseReportsStore"
import { formatCurrencyAmount } from "@/utils/currency"
import {
  getApiMonthlyExpenses,
} from "@/lib/expense-analytics-api"

import { SubscriptionForm } from "@/components/subscription/SubscriptionForm"
import { StatCard } from "@/components/dashboard/StatCard"
import { SubscriptionActivity } from "@/components/dashboard/SubscriptionActivity"
import { ActiveSubscriptionList, BillingCalendar, CategoryStrip } from "@/components/dashboard/LedgerOverview"
import { SubscriptionDetailDialog } from '@/components/subscription/SubscriptionDetailDialog'
import { ExpenseTrendChart } from "@/components/charts/ExpenseTrendChart"
import { PageLoading } from "@/components/ui/page-loading"
import { LoadingIndicator } from "@/components/ui/loading-indicator"

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return String(error)
}

function HomePage() {
  const { toast } = useToast()
  const { t } = useTranslation(['dashboard', 'common', 'subscription'])
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)
  const [detailSubscription, setDetailSubscription] = useState<Subscription | null>(null)
  const { currency: userCurrency, fetchSettings } = useSettingsStore()
  const [isInitializing, setIsInitializing] = useState(() =>
    !useSettingsStore.getState().hasLoaded || !useSubscriptionStore.getState().hasLoaded
  )

  const {
    subscriptions,
    updateSubscription,
    getUpcomingRenewals,
    getRecentlyPaid,
    getSpendingByCategory,
    initializeData,
    initializeWithRenewals
  } = useSubscriptionStore()

  // Projected recurring costs come directly from active subscriptions.
  // Historical trends allocate successful payments over their billing periods.
  const { totalMonthlySpending, totalYearlySpending, activeCount } = useSubscriptionStats()
  const cachedTrend = useExpenseReportsStore(state => state.dashboardMonthlyTrend)
  const cachedTrendCurrency = useExpenseReportsStore(state => state.dashboardTrendCurrency)
  const setDashboardTrend = useExpenseReportsStore(state => state.setDashboardTrend)
  const hasCachedTrend = cachedTrendCurrency === userCurrency && cachedTrend.length > 0
  const [monthlyTrend, setMonthlyTrend] = useState(() => (hasCachedTrend ? cachedTrend : []))
  const [isLoadingSpending, setIsLoadingSpending] = useState(() => !hasCachedTrend)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Initialize subscriptions without auto-renewals
  const initialize = useCallback(async () => {
    try {
      await Promise.all([fetchSettings(), initializeData()])
    } finally {
      setIsInitializing(false)
    }
  }, [fetchSettings, initializeData])

  useEffect(() => {
    initialize()
  }, [initialize])

  // Load spending data from API (stale-while-revalidate when cached for active currency)
  useEffect(() => {
    const loadSpendingData = async () => {
      const store = useExpenseReportsStore.getState()
      const hasWarmCache = store.dashboardTrendCurrency === userCurrency && store.dashboardMonthlyTrend.length > 0
      if (hasWarmCache) {
        setMonthlyTrend(store.dashboardMonthlyTrend)
        setIsLoadingSpending(false)
      } else {
        setIsLoadingSpending(true)
      }

      try {
        const endDate = new Date()
        const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1)
        const trend = await getApiMonthlyExpenses(startDate, endDate, userCurrency)
        setMonthlyTrend(trend)
        setDashboardTrend(userCurrency, trend)
      } catch (error) {
        console.error('Failed to load spending data:', error)
      } finally {
        setIsLoadingSpending(false)
      }
    }

    if (userCurrency) {
      loadSpendingData()
    } else {
      setIsLoadingSpending(false)
    }
  }, [userCurrency, setDashboardTrend])

  // Handler for updating subscription
  const handleUpdateSubscription = async (id: number, data: Omit<Subscription, "id" | "lastBillingDate">) => {
    const { error } = await updateSubscription(id, data)

    if (error) {
      toast({
        title: t('subscription:errorUpdate') || "Error updating subscription",
        description: getErrorMessage(error) || "Failed to update subscription",
        variant: "destructive"
      })
      return
    }

    setEditingSubscription(null)
    toast({
      title: t('subscription:updated') || "Subscription updated",
      description: `${data.name} ${t('subscription:updateSuccess') || "has been updated successfully."}`
    })
  }

  // Handler for manual refresh with renewals
  const handleRefreshWithRenewals = async () => {
    setIsRefreshing(true)
    try {
      await initializeWithRenewals()

      // Also refresh spending data
      if (userCurrency) {
        const endDate = new Date()
        const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1)
        const trend = await getApiMonthlyExpenses(startDate, endDate, userCurrency)
        setMonthlyTrend(trend)
        setDashboardTrend(userCurrency, trend)
      }

      toast({
        title: t('common:dataRefreshed') || "Data refreshed",
        description: t('common:dataRefreshedDesc') || "Subscription data and renewals have been processed."
      })
    } catch (error) {
      console.error('Error refreshing data:', error)
      toast({
        title: t('common:refreshFailed') || "Refresh failed",
        description: t('common:refreshFailedDesc') || "Failed to refresh data. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Derived dashboard datasets
  const upcomingRenewals = getUpcomingRenewals(7)
  const recentlyPaidSubscriptions = getRecentlyPaid(7)
  const spendingByCategory = getSpendingByCategory()
  const trialCount = useMemo(() => subscriptions.filter(sub => sub.status === 'trial').length, [subscriptions])

  if (isInitializing) {
    return <PageLoading />
  }

  return (
    <>
      <div className="ledger-page-heading">
        <h1>{t('common:dashboard')}</h1>
        <Button
          onClick={handleRefreshWithRenewals}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? t('common:refreshing') : t('common:refresh')}
        </Button>
      </div>

      {/* Dashboard Content */}
      <div className="space-y-4">
          <Card className="overflow-hidden rounded-[28px]">
            <section
              className="grid divide-y md:grid-cols-3 md:divide-y-0"
              aria-label="Subscription summary"
            >
              <StatCard
                title={t('common:monthlySpending')}
                value={formatCurrencyAmount(totalMonthlySpending, userCurrency)}
                divider
                align="center"
                description={t('monthlyAllocation')}
              />
              <StatCard
                title={t('common:yearlySpending')}
                value={formatCurrencyAmount(totalYearlySpending, userCurrency)}
                divider
                align="center"
                description={t('yearlyProjection')}
              />
              <StatCard
                title={t('common:activeSubscriptions')}
                value={activeCount}
                align="center"
                description={t('serviceSummary', { total: subscriptions.length, trial: trialCount })}
              />
            </section>
            <CategoryStrip data={spendingByCategory} />
          </Card>

          <section
            className="grid grid-cols-1 gap-5 md:grid-cols-2"
            aria-label="Expense activity"
          >
            <SubscriptionActivity subscriptions={upcomingRenewals} onSelect={setDetailSubscription} />
            <SubscriptionActivity subscriptions={recentlyPaidSubscriptions} paid onSelect={setDetailSubscription} />
          </section>

          <section className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" aria-label="Expense trend and scheduled payments">
            {isLoadingSpending ? (
              <Card className="flex min-h-[280px] items-center justify-center" aria-busy="true">
                <LoadingIndicator size="md" />
              </Card>
            ) : (
              <ExpenseTrendChart data={monthlyTrend} currency={userCurrency} />
            )}
            <BillingCalendar subscriptions={subscriptions} />
          </section>
          <ActiveSubscriptionList subscriptions={subscriptions} onSelect={setDetailSubscription} />
        </div>

      {/* Forms and Modals */}
      <SubscriptionDetailDialog subscription={detailSubscription} open={detailSubscription !== null}
        onOpenChange={open => { if (!open) setDetailSubscription(null) }}
        onEdit={id => { setEditingSubscription(subscriptions.find(sub => sub.id === id) || null); setDetailSubscription(null) }} />
      {editingSubscription && (
        <SubscriptionForm
          open={Boolean(editingSubscription)}
          onOpenChange={() => setEditingSubscription(null)}
          initialData={editingSubscription}
          onSubmit={(data) => handleUpdateSubscription(editingSubscription.id, data)}
        />
      )}
    </>
  )
}

export default HomePage
