import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BillingCalendar } from './LedgerOverview'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'zh-CN' },
  }),
}))

afterEach(cleanup)

describe('BillingCalendar UX stability', () => {
  it('renders a non-clickable consistent month label, fixed 6-row grid, and centered day circles', () => {
    const { container } = render(<BillingCalendar subscriptions={[]} />)

    const prevBtn = screen.getByRole('button', { name: 'Previous month' })
    const nextBtn = screen.getByRole('button', { name: 'Next month' })
    const monthLabelEl = prevBtn.nextElementSibling as HTMLElement

    expect(monthLabelEl.tagName).toBe('SPAN')
    expect(monthLabelEl.textContent).toMatch(/^\d{4}年\d{1,2}月$/)

    const grid = container.querySelector('[data-calendar-grid]') as HTMLElement
    // 7 weekday labels + 42 fixed day cells (6 rows)
    expect(grid.children).toHaveLength(49)

    // Stepping across year boundaries keeps identical YYYY年M月 format and constant 49-cell grid
    for (let i = 0; i < 15; i++) {
      fireEvent.click(nextBtn)
      expect(monthLabelEl.textContent).toMatch(/^\d{4}年\d{1,2}月$/)
      expect(grid.children).toHaveLength(49)
    }

    const dayOneBtn = screen.getByText('1').closest('button') as HTMLButtonElement
    expect(dayOneBtn.className).toContain('items-center')
    expect(dayOneBtn.className).toContain('justify-center')
    expect(dayOneBtn.className).toContain('leading-none')
    expect(dayOneBtn.className).not.toContain('pb-0.5')
  })
})
