import { Route, Routes } from "react-router-dom"
import { Suspense, lazy, useEffect } from "react"
import { Toaster } from "./components/ui/toaster"
import { ThemeProvider } from "./components/ThemeProvider"
import { MainLayout } from "./components/layouts/MainLayout"
import { useAuthStore } from '@/store/authStore'
import { Navigate } from 'react-router-dom'
import { PageLoading } from '@/components/ui/page-loading'

// Lazy load pages for code splitting
const HomePage = lazy(() => import("./pages/HomePage"))
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage").then(module => ({ default: module.SubscriptionsPage })))
const SettingsPage = lazy(() => import("./pages/SettingsPage").then(module => ({ default: module.SettingsPage })))
const ExpenseReportsPage = lazy(() => import("./pages/ExpenseReportsPage").then(module => ({ default: module.ExpenseReportsPage })))
const NotificationHistoryPage = lazy(() => import("./pages/NotificationHistoryPage").then(module => ({ default: module.NotificationHistoryPage })))
const LoginPage = lazy(() => import("./pages/LoginPage"))

function RequireAuth({ children }: { children: JSX.Element }) {
    const { user, initialized } = useAuthStore()
    if (!initialized) {
      return <PageLoading />
    }
    if (!user) return <Navigate to="/login" replace />
    return children
}

function App() {
  const fetchMe = useAuthStore().fetchMe
  useEffect(() => { fetchMe() }, [fetchMe])

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MainLayout>
        <Suspense fallback={<PageLoading />}>
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
