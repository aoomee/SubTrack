"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useSettingsStore } from "@/store/settingsStore"
import { useTranslation } from 'react-i18next'

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const { t } = useTranslation('navigation')
  const { setTheme: setStoreTheme } = useSettingsStore()
  const [mounted, setMounted] = useState(false)

  // Only show the toggle after mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync mobile browser chrome theme-color with active theme
  useEffect(() => {
    if (!mounted || !resolvedTheme) return
    const meta = document.querySelector('meta[name="theme-color"]:not([media])') || document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', resolvedTheme === 'dark' ? '#0e0e10' : '#fcfcfa')
    }
  }, [mounted, resolvedTheme])

  const toggleTheme = async () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    // Also update the settings store to keep them in sync
    await setStoreTheme(newTheme as "light" | "dark" | "system");
  }

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return <Button variant="secondary" size="icon" className="h-8 w-8" disabled>
      <Moon className="h-[1.05rem] w-[1.05rem]" />
      <span className="sr-only">{t('toggleTheme')}</span>
    </Button>
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="secondary"
      size="icon"
      className="relative h-8 w-8 overflow-hidden"
      onClick={toggleTheme}
      aria-label={t('toggleTheme')}
      title={t('toggleTheme')}
    >
      <Sun
        className={`h-[1.05rem] w-[1.05rem] transition-all duration-300 ${
          isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
        }`}
      />
      <Moon
        className={`absolute h-[1.05rem] w-[1.05rem] transition-all duration-300 ${
          isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
        }`}
      />
      <span className="sr-only">{t('toggleTheme')}</span>
    </Button>
  )
}
