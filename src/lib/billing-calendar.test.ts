import { describe, expect, test } from 'vitest'
import { getCalendarSubscriptions } from './billing-calendar'
import type { Subscription } from '@/store/subscriptionStore'

const subscription: Subscription = {
  id: 1, name: 'Annual', plan: 'Standard', amount: 120, currency: 'CNY',
  billingCycle: 'yearly', startDate: '2025-01-01', nextBillingDate: '2026-01-01',
  lastBillingDate: '2025-01-01', status: 'active', renewalType: 'manual',
  categoryId: 1, paymentMethodId: 1, notes: '',
}

describe('billing calendar', () => {
  test('matches the complete local date including the year', () => {
    expect(getCalendarSubscriptions([subscription], 2026, 0, 1)).toEqual([subscription])
    expect(getCalendarSubscriptions([subscription], 2025, 0, 1)).toEqual([])
    expect(getCalendarSubscriptions([subscription], 2026, 1, 1)).toEqual([])
  })
  test('includes trials but excludes cancelled subscriptions on the same date', () => {
    const trial = { ...subscription, id: 2, status: 'trial' as const }
    const cancelled = { ...subscription, id: 3, status: 'cancelled' as const }
    expect(getCalendarSubscriptions([subscription, trial, cancelled], 2026, 0, 1)).toEqual([subscription, trial])
  })
  test('does not invent recurring charges or historical payments', () => {
    expect(getCalendarSubscriptions([subscription], 2027, 0, 1)).toEqual([])
    expect(getCalendarSubscriptions([subscription], 2025, 0, 1)).toEqual([])
  })
  test('handles leap days as date-only values', () => {
    const leap = { ...subscription, nextBillingDate: '2028-02-29' }
    expect(getCalendarSubscriptions([leap], 2028, 1, 29)).toEqual([leap])
  })
})
