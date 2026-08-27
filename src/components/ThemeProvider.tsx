"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { useSettingsStore } from "@/store/settingsStore"
import { useAuthStore } from "@/store/authStore"

function ThemeSync() {
  const { fetchSettings } = useSettingsStore()
  const user = useAuthStore(state => state.user)

  React.useEffect(() => {
    // Backend settings are protected; wait until authentication succeeds.
    if (user) {
      fetchSettings()
    }
  }, [fetchSettings, user])

  return null
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeSync />
      {children}
    </NextThemesProvider>
  )
}
