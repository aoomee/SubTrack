import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PageLoading } from './page-loading'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu'

afterEach(() => {
  cleanup()
  document.body.removeAttribute('data-scroll-locked')
})

describe('UI layout stability and centering', () => {
  it('centers PageLoading inside its flex parent without forcing viewport overflow', () => {
    const { container } = render(<PageLoading />)
    const wrapper = container.firstElementChild as HTMLElement

    expect(wrapper).toHaveAttribute('aria-busy', 'true')
    expect(wrapper.className).toContain('flex-1')
    expect(wrapper.className).toContain('items-center')
    expect(wrapper.className).toContain('justify-center')
    expect(wrapper.className).toContain('w-full')
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('prevents SelectTrigger from expanding grid tracks when option text is long', () => {
    render(
      <Select defaultValue="long">
        <SelectTrigger aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="long">Subscription Expiration Warning Notification</SelectItem>
        </SelectContent>
      </Select>
    )

    const trigger = screen.getByRole('combobox', { name: 'Status' })
    expect(trigger.className).toContain('min-w-0')
    expect(trigger.className).toContain('w-full')
  })

  it('keeps DropdownMenu non-modal by default so body scroll is never locked', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <button type="button">Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Option A</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    expect(screen.getByRole('menuitem', { name: 'Option A' })).toBeInTheDocument()
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
  })
})
