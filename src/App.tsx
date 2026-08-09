import { Route, Routes } from "react-router-dom"
import { Suspense, lazy } from "react"
import { Toaster } from "./components/ui/toaster"
import { ThemeProvider } from "./components/ThemeProvider"
import { MainLayout } from "./components/layouts/MainLayout"
import { useTranslation } from "react-i18next"
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Navigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy load pages for code splitting
const HomePage = lazy(() => import("./pages/HomePage"))
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage").then(module => ({ default: module.SubscriptionsPage })))
const SettingsPage = lazy(() => import("./pages/SettingsPage").then(module => ({ default: module.SettingsPage })))
const ExpenseReportsPage = lazy(() => import("./pages/ExpenseReportsPage").then(module => ({ default: module.ExpenseReportsPage })))
const NotificationHistoryPage = lazy(() => import("./pages/NotificationHistoryPage").then(module => ({ default: module.NotificationHistoryPage })))
const LoginPage = lazy(() => import("./pages/LoginPage"))


function App() {
  const { t } = useTranslation()
  const { user, fetchMe, initialized } = useAuthStore()
  useEffect(() => { fetchMe() }, [fetchMe])

  const RequireAuth = ({ children }: { children: JSX.Element }) => {
    if (!initialized) {
      return <PageLoading label={t('loading')} />
    }
    if (!user) return <Navigate to="/login" replace />
    return children
  }

  const PageLoading = ({ label }: { label: string }) => (
    <div className="space-y-6" aria-label={label}>
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    </div>
  )
  
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MainLayout>
        <Suspense fallback={<PageLoading label={t('loading')} />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
            <Route path="/subscriptions" element={<RequireAuth><SubscriptionsPage /></RequireAuth>} />
            <Route path="/expense-reports" element={<RequireAuth><ExpenseReportsPage /></RequireAuth>} />
            <Route path="/notifications" element={<RequireAuth><NotificationHistoryPage /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
          </Routes>
        </Suspense>
      </MainLayout>
      <Toaster />
    </ThemeProvider>
  )
}

export default App
