import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { SubscriptionCard } from './SubscriptionCard'
import type { Subscription } from '@/store/subscriptionStore'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
afterEach(cleanup)
const subscription: Subscription = {
  id: 42, name: 'Calendar service', plan: 'Annual', amount: 120, currency: 'CNY',
  billingCycle: 'yearly', startDate: '2026-01-01', nextBillingDate: '2027-01-01',
  lastBillingDate: '2026-01-01', status: 'active', renewalType: 'manual',
  categoryId: 1, paymentMethodId: 1, notes: '',
}

describe('subscription card interaction', () => {
  test('opens details by pointer and keyboard without treating nested controls as detail activation', () => {
    const view = vi.fn()
    render(<SubscriptionCard subscription={subscription} onViewDetails={view} onEdit={vi.fn()} onDelete={vi.fn()} onStatusChange={vi.fn()} />)
    const card = screen.getByRole('button', { name: subscription.name })
    fireEvent.click(card)
    fireEvent.keyDown(card, { key: 'Enter' })
    fireEvent.keyDown(card, { key: ' ' })
    expect(view).toHaveBeenCalledTimes(3)
    expect(view).toHaveBeenLastCalledWith(subscription)
    const options = screen.getByRole('button', { name: 'common:options' })
    fireEvent.click(options)
    fireEvent.keyDown(options, { key: ' ' })
    expect(view).toHaveBeenCalledTimes(3)
  })
})
