import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SchedulerSettings } from './SchedulerSettings'
import {
  schedulerApi,
  type SchedulerSettings as SchedulerSettingsType,
  type SchedulerStatus,
} from '@/services/schedulerApi'
import { useNotificationStore } from '@/store/notificationStore'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
vi.mock('@/services/schedulerApi', () => ({
  schedulerApi: {
    getSettings: vi.fn(),
    getStatus: vi.fn(),
    updateSettings: vi.fn(),
    triggerCheck: vi.fn(),
  },
}))

afterEach(cleanup)

beforeEach(() => {
  vi.resetAllMocks()
  useNotificationStore.getState().clearAllConfigs()
})

const makeStatus = (settings: SchedulerSettingsType): SchedulerStatus => ({
  running: true,
  nextRun: true,
  settings,
  currentSchedule: {
    time: settings.notification_check_time,
    timezone: settings.timezone,
    enabled: settings.is_enabled,
  },
})

describe('SchedulerSettings loading transitions', () => {
  test('starts directly in loading state on cold mount without flashing default form text first', async () => {
    let resolveSettings!: (val: SchedulerSettingsType) => void
    let resolveStatus!: (val: SchedulerStatus) => void
    vi.mocked(schedulerApi.getSettings).mockReturnValue(new Promise((r) => { resolveSettings = r }))
    vi.mocked(schedulerApi.getStatus).mockReturnValue(new Promise((r) => { resolveStatus = r }))

    render(<SchedulerSettings />)

    // First paint must show only the centered loader, never default form content.
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('scheduler.settings')).not.toBeInTheDocument()

    const payload: SchedulerSettingsType = {
      notification_check_time: '09:00',
      timezone: 'Asia/Shanghai',
      is_enabled: true,
    }
    await act(async () => {
      resolveSettings(payload)
      resolveStatus(makeStatus(payload))
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('scheduler.settings')).toBeInTheDocument()
  })

  test('renders immediately without any spinner when scheduler cache is already warm', () => {
    const payload: SchedulerSettingsType = {
      notification_check_time: '08:30',
      timezone: 'Asia/Shanghai',
      is_enabled: true,
    }
    useNotificationStore.getState().setSchedulerRuntime({
      settings: payload,
      status: makeStatus(payload),
    })
    vi.mocked(schedulerApi.getSettings).mockReturnValue(new Promise(() => {}))
    vi.mocked(schedulerApi.getStatus).mockReturnValue(new Promise(() => {}))

    render(<SchedulerSettings />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('scheduler.settings')).toBeInTheDocument()
    expect(screen.getByDisplayValue('08:30')).toBeInTheDocument()
  })
})
