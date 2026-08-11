import { Route, Routes, useLocation } from "react-router-dom"
import { Suspense, lazy, useEffect, useState } from "react"
import { Toaster } from "./components/ui/toaster"
import { ThemeProvider } from "./components/ThemeProvider"
import { MainLayout } from "./components/layouts/MainLayout"
import { useAuthStore } from '@/store/authStore'
import { Navigate } from 'react-router-dom'
import { LoadingIndicator } from '@/components/ui/loading-indicator'

// Lazy load pages for code splitting
const HomePage = lazy(() => import("./pages/HomePage"))
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage").then(module => ({ default: module.SubscriptionsPage })))
const SettingsPage = lazy(() => import("./pages/SettingsPage").then(module => ({ default: module.SettingsPage })))
const ExpenseReportsPage = lazy(() => import("./pages/ExpenseReportsPage").then(module => ({ default: module.ExpenseReportsPage })))
const NotificationHistoryPage = lazy(() => import("./pages/NotificationHistoryPage").then(module => ({ default: module.NotificationHistoryPage })))
const LoginPage = lazy(() => import("./pages/LoginPage"))

function PageLoading() {
  return (
    <div
      className="flex min-h-[calc(100dvh-4rem)] items-center justify-center"
      aria-busy="true"
    >
      <LoadingIndicator size="lg" />
    </div>
  )
}

function RouteTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const routeKey = `${location.pathname}${location.search}${location.hash}`
  const [settledRouteKey, setSettledRouteKey] = useState(routeKey)

  useEffect(() => {
    if (settledRouteKey === routeKey) return

    const timeoutId = window.setTimeout(() => {
      setSettledRouteKey(routeKey)
    }, 140)

    return () => window.clearTimeout(timeoutId)
  }, [routeKey, settledRouteKey])

  if (settledRouteKey !== routeKey) {
    return <PageLoading />
  }

  return <>{children}</>
}

function App() {
  const location = useLocation()
  const { user, fetchMe, initialized } = useAuthStore()
  useEffect(() => { fetchMe() }, [fetchMe])

  const RequireAuth = ({ children }: { children: JSX.Element }) => {
    if (!initialized) {
      return <PageLoading />
    }
    if (!user) return <Navigate to="/login" replace />
    return children
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MainLayout>
        <RouteTransition>
          <Suspense fallback={<PageLoading />}>
            <Routes key={location.pathname}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
              <Route path="/subscriptions" element={<RequireAuth><SubscriptionsPage /></RequireAuth>} />
              <Route path="/expense-reports" element={<RequireAuth><ExpenseReportsPage /></RequireAuth>} />
              <Route path="/notifications" element={<RequireAuth><NotificationHistoryPage /></RequireAuth>} />
              <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
            </Routes>
          </Suspense>
        </RouteTransition>
      </MainLayout>
      <Toaster />
    </ThemeProvider>
  )
}

export default App
