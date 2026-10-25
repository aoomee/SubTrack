import type { Subscription } from '@/store/subscriptionStore'

/** Match local calendar dates without UTC conversion or inferred payment entries. */
export function getCalendarSubscriptions(subscriptions: Subscription[], year: number, month: number, day: number) {
  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return subscriptions.filter(sub => sub.status !== 'cancelled' && sub.nextBillingDate === dateKey)
}
