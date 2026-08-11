import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  Home,
  Settings,
  BarChart3,
  CreditCard,
  History,
  LogOut,
  CircleUserRound,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

import { ModeToggle } from '@/components/ModeToggle'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Button as UIButton } from '@/components/ui/button'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation()
  const { t } = useTranslation('navigation')
  const { user, logout } = useAuthStore()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('subtrack-sidebar-collapsed') === 'true'
  })

  useEffect(() => {
    window.localStorage.setItem('subtrack-sidebar-collapsed', String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  const navLinks = [
    {
      to: '/',
      icon: <Home className="h-4 w-4" />,
      text: t('dashboard'),
    },
    {
      to: '/subscriptions',
      icon: <CreditCard className="h-4 w-4" />,
      text: t('subscriptions'),
    },
    {
      to: '/expense-reports',
      icon: <BarChart3 className="h-4 w-4" />,
      text: t('reports'),
    },
    {
      to: '/notifications',
      icon: <History className="h-4 w-4" />,
      text: t('notifications'),
    },
    {
      to: '/settings',
      icon: <Settings className="h-4 w-4" />,
      text: t('settings'),
    },
  ]

  if (location.pathname === '/login') {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="flex min-h-[100dvh] flex-col">
          <header className="flex h-20 items-center justify-between px-6 sm:px-10">
            <Link to="/" className="brand-wordmark" aria-label="SubTrack home">
              SUBTRACK
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ModeToggle />
            </div>
          </header>
          <main className="relative flex flex-1 items-center justify-center px-5 pb-20 pt-6">
            {children}
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-[100dvh] bg-background md:grid ${isSidebarCollapsed ? 'md:grid-cols-[76px_minmax(0,1fr)]' : 'md:grid-cols-[232px_minmax(0,1fr)]'}`}>
      <aside className="sticky top-0 hidden h-[100dvh] flex-col border-r bg-sidebar px-3 py-6 md:flex">
        <div className={`flex items-center gap-2 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && (
            <Link to="/" className="brand-wordmark px-3" aria-label="SubTrack home">
              SUBTRACK
            </Link>
          )}
          <UIButton
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={isSidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            title={isSidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            className="shrink-0"
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </UIButton>
        </div>

        <nav className="mt-8 space-y-1.5" aria-label="Primary navigation">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to
            return (
              <Link
                to={link.to}
                key={link.to}
                className={`sidebar-link ${isSidebarCollapsed ? 'justify-center px-0' : ''} ${isActive ? 'sidebar-link-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                title={isSidebarCollapsed ? link.text : undefined}
              >
                {link.icon}
                <span className={isSidebarCollapsed ? 'sr-only' : undefined}>{link.text}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto space-y-3 border-t pt-4">
          <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : 'px-3'}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CircleUserRound className="h-[18px] w-[18px]" />
            </span>
            <div className={`min-w-0 flex-1 ${isSidebarCollapsed ? 'sr-only' : ''}`}>
              <p className="truncate text-sm font-medium">{user?.username || 'Admin'}</p>
              <p className="text-xs text-muted-foreground">Personal workspace</p>
            </div>
          </div>
          <div className={`flex items-center gap-1 ${isSidebarCollapsed ? 'justify-center' : 'px-1'}`}>
            <LanguageSwitcher />
            <ModeToggle />
            {user && (
              <UIButton
                variant="ghost"
                size="icon"
                onClick={logout}
                className={isSidebarCollapsed ? '' : 'ml-auto'}
                aria-label={t('logout')}
                title={t('logout')}
              >
                <LogOut className="h-4 w-4" />
              </UIButton>
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 px-5 backdrop-blur md:hidden">
          <Link to="/" className="brand-wordmark" aria-label="SubTrack home">SUBTRACK</Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ModeToggle />
            {user && (
              <UIButton variant="ghost" size="icon" onClick={logout} aria-label={t('logout')}>
                <LogOut className="h-5 w-5" />
              </UIButton>
            )}
          </div>
        </header>

        <main id="main-content" className="relative isolate mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-[1440px] px-4 pb-24 pt-6 sm:px-6 md:min-h-[100dvh] md:px-8 md:pb-10 md:pt-8 xl:px-10">
          {children}
        </main>
      </div>

      {/* Bottom Navigation for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto px-2">
          <nav className="grid h-16 grid-cols-5 items-center">
            {navLinks.map((link) => (
              <Link
                to={link.to}
                key={link.to}
                className={`flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  location.pathname === link.to ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-current={location.pathname === link.to ? 'page' : undefined}
              >
                {link.icon}
                <span className="max-w-[64px] truncate">{link.text}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
