import { afterEach, describe, expect, it } from 'vitest'
import { useExpenseReportsStore } from './expenseReportsStore'
import { useNotificationHistoryStore } from './notificationHistoryStore'

afterEach(() => {
  useExpenseReportsStore.getState().reset()
  useNotificationHistoryStore.getState().reset()
})

describe('page cache stores', () => {
  it('caches and resets expense reports and dashboard monthly trend snapshots', () => {
    const store = useExpenseReportsStore.getState()
    expect(store.hasLoaded).toBe(false)

    store.setDashboardTrend('CNY', [
      { month: '2026-01', year: 2026, monthKey: '2026-01', amount: 99, subscriptionCount: 1 },
    ])
    store.setReportData({
      currency: 'CNY',
      monthlyExpenses: [
        { month: '2026-01', year: 2026, monthKey: '2026-01', amount: 99, subscriptionCount: 1 },
      ],
      yearlyExpenses: [{ year: 2026, amount: 1188, subscriptionCount: 1 }],
      categoryExpenses: [{ category: 'AI', amount: 99, percentage: 100, subscriptionCount: 1 }],
      yearlyCategoryExpenses: [{ category: 'AI', amount: 1188, percentage: 100, subscriptionCount: 1 }],
      monthlyCategoryExpenses: [],
      yearlyGroupedCategoryExpenses: [],
      expenseInfoData: { monthly: [], quarterly: [], yearly: [] },
    })

    const warm = useExpenseReportsStore.getState()
    expect(warm.hasLoaded).toBe(true)
    expect(warm.currency).toBe('CNY')
    expect(warm.dashboardTrendCurrency).toBe('CNY')
    expect(warm.dashboardMonthlyTrend).toHaveLength(1)
    expect(warm.monthlyExpenses).toHaveLength(1)

    warm.reset()
    const cleared = useExpenseReportsStore.getState()
    expect(cleared.hasLoaded).toBe(false)
    expect(cleared.currency).toBeNull()
    expect(cleared.dashboardMonthlyTrend).toEqual([])
    expect(cleared.monthlyExpenses).toEqual([])
  })

  it('caches and resets notification history snapshots and stats', () => {
    const store = useNotificationHistoryStore.getState()
    expect(store.hasLoaded).toBe(false)

    store.setSnapshot({
      history: [
        {
          id: 1,
          subscription_id: 10,
          notification_type: 'renewal_reminder',
          channel_type: 'telegram',
          status: 'sent',
          recipient: '123456',
          message_content: 'Reminder',
          error_message: null,
          retry_count: 0,
          max_retry: 3,
          scheduled_at: '2026-01-01T00:00:00Z',
          sent_at: '2026-01-01T00:00:05Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    })
    store.setStats({
      total: 1,
      sent: 1,
      failed: 0,
      pending: 0,
      retrying: 0,
      byType: { renewal_reminder: 1 },
      byChannel: { telegram: 1 },
    })

    const warm = useNotificationHistoryStore.getState()
    expect(warm.hasLoaded).toBe(true)
    expect(warm.history).toHaveLength(1)
    expect(warm.stats?.sent).toBe(1)

    warm.reset()
    const cleared = useNotificationHistoryStore.getState()
    expect(cleared.hasLoaded).toBe(false)
    expect(cleared.history).toEqual([])
    expect(cleared.stats).toBeNull()
  })
})
