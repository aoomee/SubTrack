// Shared lazy route loaders so nav hover/focus can prefetch chunks ahead of clicks.
const routeLoaders = {
  '/': () => import('@/pages/HomePage'),
  '/subscriptions': () => import('@/pages/SubscriptionsPage'),
  '/expense-reports': () => import('@/pages/ExpenseReportsPage'),
  '/notifications': () => import('@/pages/NotificationHistoryPage'),
  '/settings': () => import('@/pages/SettingsPage'),
  '/login': () => import('@/pages/LoginPage'),
} as const

export type PrefetchRoute = keyof typeof routeLoaders

const prefetched = new Set<string>()

export function prefetchRoute(path: string) {
  if (prefetched.has(path) || !(path in routeLoaders)) return
  prefetched.add(path)
  void routeLoaders[path as PrefetchRoute]().catch(() => {
    prefetched.delete(path)
  })
}

export { routeLoaders }
