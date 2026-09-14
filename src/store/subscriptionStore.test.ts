import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { transformToApi, useSubscriptionStore, type Subscription } from './subscriptionStore'

const subscription: Omit<Subscription, 'id' | 'lastBillingDate'> = {
  name: 'Submission test', plan: 'Standard', billingCycle: 'monthly',
  startDate: '2026-08-01', nextBillingDate: '2026-09-01', amount: 20,
  currency: 'CNY', categoryId: 3, paymentMethodId: 1, status: 'active',
  renewalType: 'manual', notes: '', website: '',
}

const responseRecord = {
  id: 1, name: subscription.name, plan: subscription.plan, billing_cycle: 'monthly',
  start_date: subscription.startDate, next_billing_date: subscription.nextBillingDate,
  last_billing_date: '2026-08-01', amount: 20, currency: 'CNY', category_id: 3,
  payment_method_id: 1, status: 'active', renewal_type: 'manual', notes: '', website: '',
}

describe('subscription submission payloads', () => {
  let writes: { method: string; path: string; body: Record<string, unknown> | Record<string, unknown>[] }[]

  beforeEach(() => {
    writes = []
    useSubscriptionStore.setState({ subscriptions: [], error: null })
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
      const method = options.method || 'GET'
      if (method !== 'GET') {
        const body = JSON.parse(options.body as string)
        writes.push({ method, path: new URL(url).pathname, body })
        // Mirrors the server's read-only field boundary, so the old store fails.
        const records = Array.isArray(body) ? body : [body]
        if (records.some(record => 'last_billing_date' in record)) {
          return { ok: false, status: 400, json: async () => ({ error: 'Unknown subscription field(s): last_billing_date' }) }
        }
      }
      return {
        ok: true, status: method === 'POST' ? 201 : 200,
        json: async () => ({ success: true, data: method === 'GET' ? [responseRecord] : { id: 1 } }),
      }
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  test('adds through the store and refreshes the server-computed billing date', async () => {
    expect(await useSubscriptionStore.getState().addSubscription(subscription)).toEqual({ error: null })
    expect(writes).toEqual([{ method: 'POST', path: '/api/protected/subscriptions', body: transformToApi(subscription) }])
    expect(useSubscriptionStore.getState().subscriptions[0]).toMatchObject({ id: 1, lastBillingDate: '2026-08-01' })
  })

  test('bulk import sends only writable fields', async () => {
    expect(await useSubscriptionStore.getState().bulkAddSubscriptions([subscription, subscription])).toEqual({ error: null })
    expect(writes[0]).toEqual({
      method: 'POST', path: '/api/protected/subscriptions/bulk',
      body: [transformToApi(subscription), transformToApi(subscription)],
    })
  })

  test('editing the next billing date does not submit a computed last date', async () => {
    useSubscriptionStore.setState({ subscriptions: [{ ...subscription, id: 1, lastBillingDate: '2026-08-01' }] })
    expect(await useSubscriptionStore.getState().updateSubscription(1, { nextBillingDate: '2026-10-01' })).toEqual({ error: null })
    expect(writes[0]).toEqual({
      method: 'PUT', path: '/api/protected/subscriptions/1', body: { next_billing_date: '2026-10-01' },
    })
  })

  test('editing a complete stored record strips read-only and display fields', () => {
    const payload = transformToApi({ ...subscription, id: 1, lastBillingDate: '1900-01-01' })
    expect(payload).not.toHaveProperty('id')
    expect(payload).not.toHaveProperty('last_billing_date')
  })
});
