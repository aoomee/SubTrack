import { create } from 'zustand'
import type {
  NotificationHistory as NotificationHistoryItem,
  NotificationStats,
} from '@/services/notificationApi'

interface NotificationPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface NotificationHistoryCacheState {
  hasLoaded: boolean
  history: NotificationHistoryItem[]
  stats: NotificationStats | null
  pagination: NotificationPagination
  setSnapshot: (payload: {
    history: NotificationHistoryItem[]
    pagination: NotificationPagination
  }) => void
  setStats: (stats: NotificationStats | null) => void
  markLoaded: () => void
  reset: () => void
}

const initialState = {
  hasLoaded: false,
  history: [] as NotificationHistoryItem[],
  stats: null as NotificationStats | null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
}

export const useNotificationHistoryStore = create<NotificationHistoryCacheState>((set) => ({
  ...initialState,
  setSnapshot: ({ history, pagination }) =>
    set({ history, pagination, hasLoaded: true }),
  setStats: (stats) => set({ stats }),
  markLoaded: () => set({ hasLoaded: true }),
  reset: () => set({ ...initialState }),
}))
