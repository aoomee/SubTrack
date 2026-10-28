import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TelegramConfig } from './TelegramConfig'
import { notificationApi } from '@/services/notificationApi'
import { useNotificationStore } from '@/store/notificationStore'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/services/notificationApi', () => ({ notificationApi: {
  getChannelConfig: vi.fn(), getTelegramConfigStatus: vi.fn(), getBotInfo: vi.fn(),
  validateChatId: vi.fn(), configureChannel: vi.fn(), testNotification: vi.fn(),
} }))
afterEach(cleanup)
beforeEach(() => {
  vi.resetAllMocks()
  useNotificationStore.getState().clearAllConfigs()
  vi.mocked(notificationApi.getChannelConfig).mockResolvedValue({ config: { chat_id: '123' } } as never)
  vi.mocked(notificationApi.getTelegramConfigStatus).mockResolvedValue({ configured: true, hasToken: true, isPlaceholder: false })
})
test('waits for slow bot info before revealing the form and never reloads while typing', async () => {
  let resolveBot!: (value: never) => void
  vi.mocked(notificationApi.getBotInfo).mockReturnValue(new Promise(resolve => { resolveBot = resolve }))
  render(<TelegramConfig userId={1} />)
  await waitFor(() => expect(screen.getByLabelText('chatId')).toHaveValue('123'))
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toBeInTheDocument()
  await act(async () => resolveBot({ success: true, botInfo: { first_name: 'Example Bot', username: 'example' } } as never))
  expect(screen.getByRole('textbox')).toBeEnabled()
  expect(screen.getByText('Example Bot')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '4567' } })
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('4567'))
  expect(notificationApi.getChannelConfig).toHaveBeenCalledTimes(1)
  expect(notificationApi.getBotInfo).toHaveBeenCalledTimes(1)
  expect(notificationApi.testNotification).not.toHaveBeenCalled()
})
test('unblocks the form when bot lookup fails instead of leaving a permanent loader', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(notificationApi.getBotInfo).mockRejectedValue(new Error('offline'))
  render(<TelegramConfig userId={1} />)
  await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled())
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByText('errors.telegramNotConfigured')).toBeInTheDocument()
  log.mockRestore()
})
