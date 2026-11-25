import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NotificationHistory } from './NotificationHistory'
import { notificationApi, type NotificationHistory as NotificationHistoryItem, type NotificationStats } from '@/services/notificationApi'
import { useNotificationHistoryStore } from '@/store/notificationHistoryStore'

const mockT = (key: string, opts?: Record<string, unknown>) =>
  opts && 'count' in opts ? `${key}:${opts.count}` : key
const mockToast = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}))
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))
vi.mock('@/services/notificationApi', () => ({
  notificationApi: {
    getHistory: vi.fn(),
    getStats: vi.fn(),
    deleteHistoryItem: vi.fn(),
    deleteHistoryBatch: vi.fn(),
    clearHistory: vi.fn(),
  },
}))

const sampleItems: NotificationHistoryItem[] = [
  {
    id: 1,
    subscription_id: 10,
    subscription_name: 'Netflix',
    notification_type: 'renewal_reminder',
    channel_type: 'telegram',
    status: 'sent',
    recipient: '123456',
    message_content: 'Netflix renewal reminder',
    error_message: null,
    retry_count: 0,
    max_retry: 3,
    scheduled_at: '2026-11-20T09:00:00Z',
    sent_at: '2026-11-20T09:00:02Z',
    created_at: '2026-11-20T09:00:00Z',
  },
  {
    id: 2,
    subscription_id: 11,
    subscription_name: 'Spotify',
    notification_type: 'expiration_warning',
    channel_type: 'email',
    status: 'failed',
    recipient: 'user@example.com',
    message_content: 'Spotify expired',
    error_message: 'SMTP error',
    retry_count: 1,
    max_retry: 3,
    scheduled_at: '2026-11-21T09:00:00Z',
    sent_at: null,
    created_at: '2026-11-21T09:00:00Z',
  },
]

const sampleStats: NotificationStats = {
  total: 2,
  sent: 1,
  failed: 1,
  pending: 0,
  retrying: 0,
  byType: {},
  byChannel: {},
}

afterEach(cleanup)

beforeEach(() => {
  vi.resetAllMocks()
  useNotificationHistoryStore.getState().reset()
  vi.mocked(notificationApi.getHistory).mockResolvedValue({
    data: sampleItems,
    pagination: { page: 1, limit: 10, total: 2 },
  })
  vi.mocked(notificationApi.getStats).mockResolvedValue(sampleStats)
  vi.mocked(notificationApi.deleteHistoryItem).mockResolvedValue({ deletedCount: 1 })
  vi.mocked(notificationApi.deleteHistoryBatch).mockResolvedValue({ deletedCount: 2 })
  vi.mocked(notificationApi.clearHistory).mockResolvedValue({ deletedCount: 2 })
})

describe('NotificationHistory cleanup actions', () => {
  test('supports multi-select batch deletion via checkboxes and select-all', async () => {
    render(<NotificationHistory />)

    await waitFor(() => expect(screen.getByText('Netflix')).toBeInTheDocument())

    const selectAllCheckbox = screen.getByRole('checkbox', { name: 'history.selectAll' })
    fireEvent.click(selectAllCheckbox)

    const batchDeleteBtn = screen.getByRole('button', { name: 'history.deleteSelected:2' })
    fireEvent.click(batchDeleteBtn)

    const confirmBtn = await screen.findByRole('button', { name: 'delete' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(notificationApi.deleteHistoryBatch).toHaveBeenCalledWith([1, 2])
    })
  })

  test('supports single-item delete and one-click clear all', async () => {
    render(<NotificationHistory />)

    await waitFor(() => expect(screen.getByText('Spotify')).toBeInTheDocument())

    // Single delete on first row
    const deleteButtons = screen.getAllByRole('button', { name: 'history.deleteItem' })
    fireEvent.click(deleteButtons[0])

    const confirmSingle = await screen.findByRole('button', { name: 'delete' })
    fireEvent.click(confirmSingle)

    await waitFor(() => {
      expect(notificationApi.deleteHistoryItem).toHaveBeenCalledWith(1)
    })

    // Clear all
    const clearAllBtn = screen.getByRole('button', { name: 'history.clearAll' })
    fireEvent.click(clearAllBtn)

    const confirmClear = await screen.findAllByRole('button', { name: 'history.clearAll' })
    fireEvent.click(confirmClear[confirmClear.length - 1])

    await waitFor(() => {
      expect(notificationApi.clearHistory).toHaveBeenCalledTimes(1)
    })
  })
})
