import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'

const { mockUseAuthStore, mockFetchMe } = vi.hoisted(() => ({
  mockUseAuthStore: vi.fn(),
  mockFetchMe: vi.fn(),
}))

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}))

vi.mock('./components/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('./components/layouts/MainLayout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('./components/ui/toaster', () => ({
  Toaster: () => null,
}))

vi.mock('@/components/ui/page-loading', () => ({
  PageLoading: () => <div data-testid="page-loading">Loading</div>,
}))

vi.mock('./pages/HomePage', () => ({
  default: () => <div>Home page</div>,
}))

vi.mock('./pages/SubscriptionsPage', () => ({
  SubscriptionsPage: () => <div>Subscriptions page</div>,
}))

vi.mock('./pages/SettingsPage', () => ({
  SettingsPage: () => <div>Settings page</div>,
}))

vi.mock('./pages/ExpenseReportsPage', () => ({
  ExpenseReportsPage: () => <div>Expense reports page</div>,
}))

vi.mock('./pages/NotificationHistoryPage', () => ({
  NotificationHistoryPage: () => <div>Notifications page</div>,
}))

vi.mock('./pages/LoginPage', () => ({
  default: () => <div>Login page</div>,
}))

function renderRoute(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <App />
    </MemoryRouter>,
  )
}

describe('application routing', () => {
  beforeEach(() => {
    mockFetchMe.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  test('redirects unauthenticated users from protected routes to login', async () => {
    mockUseAuthStore.mockReturnValue({
      user: null,
      initialized: true,
      fetchMe: mockFetchMe,
    })

    renderRoute('/subscriptions')

    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })

  test('renders protected routes for authenticated users', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { username: 'admin', role: 'admin' },
      initialized: true,
      fetchMe: mockFetchMe,
    })

    renderRoute('/settings')

    expect(await screen.findByText('Settings page')).toBeInTheDocument()
  })

  test('shows the loading state while authentication initializes', () => {
    mockUseAuthStore.mockReturnValue({
      user: null,
      initialized: false,
      fetchMe: mockFetchMe,
    })

    renderRoute('/')

    expect(screen.getByTestId('page-loading')).toBeInTheDocument()
  })
})
