import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LogOut, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ModeToggle } from '@/components/ModeToggle'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/components/ui/button'
import { SubTrackBrand } from '@/components/brand/SubTrackBrand'
import { CURRENCY_SYMBOLS } from '@/config/constants'
import { prefetchRoute } from '@/routes/prefetch'

const NAV_LINKS = [
  ['/', 'dashboard'],
  ['/subscriptions', 'subscriptions'],
  ['/expense-reports', 'reports'],
  ['/notifications', 'notifications'],
  ['/settings', 'settings'],
] as const

export function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { t, i18n } = useTranslation('navigation')
  const { user, logout } = useAuthStore()
  const currency = useSettingsStore(state => state.currency)
  const isLogin = location.pathname === '/login'
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname])

  const language = i18n.resolvedLanguage || 'en'
  const currencyName = useMemo(
    () => new Intl.DisplayNames([language], { type: 'currency' }).of(currency),
    [language, currency]
  )

  const navigation = (mobile = false) => (
    <nav aria-label={t(mobile ? 'mobileNavigation' : 'mainNavigation')} className={mobile ? 'ledger-mobile-nav' : 'ledger-nav'}>
      {NAV_LINKS.map(([path, label]) => (
        <Link
          key={path}
          to={path}
          className="ledger-nav-link"
          aria-current={location.pathname === path ? 'page' : undefined}
          onMouseEnter={() => prefetchRoute(path)}
          onFocus={() => prefetchRoute(path)}
        >
          {t(label)}
        </Link>
      ))}
    </nav>
  )
  return (
    <div className="ledger-shell">
      <a className="skip-link" href="#main-content">{t('skipToContent')}</a>
      <header className="ledger-header">
        <Link to="/" className="brand-link" aria-label={t('brandName')} onMouseEnter={() => prefetchRoute('/')}><SubTrackBrand /></Link>
        {!isLogin && user && navigation()}
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {!isLogin && user && (
            <Link to="/settings?tab=currency" className="currency-shortcut" title={t('currencyShortcut')} onMouseEnter={() => prefetchRoute('/settings')}>
              <span>{CURRENCY_SYMBOLS[currency] || currency}</span>
              <span className="hidden sm:inline">{currencyName}</span>
              <span className="sm:hidden">{currency}</span>
            </Link>
          )}
          <ModeToggle />
          {!isLogin && user && (
            <Button asChild size="sm" className="h-8 gap-1.5 px-3.5">
              <Link to="/subscriptions?add=1" onMouseEnter={() => prefetchRoute('/subscriptions')}><Plus className="h-3.5 w-3.5" />{t('add')}</Link>
            </Button>
          )}
          {isLogin && <LanguageSwitcher variant="secondary" className="h-8 w-8" />}
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className={isLogin ? 'flex flex-1 min-h-[65vh] items-center justify-center' : 'ledger-content'}>
        <div key={location.pathname} className={isLogin ? 'ledger-page-enter flex w-full justify-center' : 'ledger-page-enter flex w-full flex-1 flex-col'}>
          {children}
        </div>
      </main>
      {!isLogin && user && (
        <>
          <footer className="mt-10 flex flex-wrap items-center justify-end gap-3 border-t pt-5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-3.5 w-3.5" />{t('logout')}</Button>
            </div>
          </footer>
          {navigation(true)}
        </>
      )}
    </div>
  )
}
