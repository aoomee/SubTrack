import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { Download, Loader2, Upload } from "lucide-react"

import { Subscription } from "@/store/subscriptionStore"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageLoading } from "@/components/ui/page-loading"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useConfirmation } from "@/hooks/use-confirmation"
import { useToast } from "@/hooks/use-toast"

import { useSettingsStore, ThemeType } from "@/store/settingsStore"
import { ImportModal } from "@/components/imports/ImportModal"
import { useSubscriptionStore } from "@/store/subscriptionStore"
import {
  exportSubscriptionsToJSON,
  downloadFile,
} from "@/lib/subscription-utils"
import { ExchangeRateManager } from "@/components/ExchangeRateManager"
import { OptionsManager } from "@/components/subscription/OptionsManager"
import { NotificationSettings } from "@/components/notification/NotificationSettings"
import { useTheme } from "next-themes"
import { useAuthStore } from "@/store/authStore"
import { prefetchNotificationCenter } from "@/store/notificationStore"

export function SettingsPage() {
  const { t } = useTranslation(['settings', 'common', 'subscription'])
  const [searchParams] = useSearchParams()

  const { toast } = useToast()
  const changePassword = useAuthStore((state) => state.changePassword)
  const isAuthLoading = useAuthStore((state) => state.isLoading)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isInitializing, setIsInitializing] = useState(() => !useSettingsStore.getState().hasLoaded)

  const requestedTab = searchParams.get('tab') || 'currency'
  const [activeTab, setActiveTab] = useState(requestedTab)
  useEffect(() => { setActiveTab(requestedTab) }, [requestedTab])

  const { setTheme: setNextTheme } = useTheme()

  const {
    theme,
    setTheme,
    resetSettings,
    fetchSettings,
  } = useSettingsStore()

  const { subscriptions, resetSubscriptions, bulkAddSubscriptions, fetchSubscriptions } = useSubscriptionStore()

  const initializeSettings = useCallback(async () => {
    try {
      await fetchSettings()
    } finally {
      setIsInitializing(false)
    }
  }, [fetchSettings])

  useEffect(() => {
    initializeSettings()
    void prefetchNotificationCenter()
  }, [initializeSettings])

  const getPasswordErrorMessage = (code?: string, fallback?: string) => {
    switch (code) {
      case 'CURRENT_PASSWORD_INVALID':
        return t('currentPasswordInvalid')
      case 'PASSWORDS_DO_NOT_MATCH':
        return t('passwordsDoNotMatch')
      case 'PASSWORD_COMPLEXITY_FAILED':
        return t('passwordValidationFailed')
      case 'PASSWORD_SAME_AS_OLD':
        return t('passwordMustDiffer')
      case 'MISSING_FIELDS':
        return t('passwordUpdateFailed')
      default:
        return fallback ?? t('passwordUpdateFailed')
    }
  }

  const validatePasswordForm = () => {
    if (!currentPassword || !newPassword) {
      setPasswordSuccess(null)
      setPasswordError(t('passwordUpdateFailed'))
      return false
    }

    if (newPassword !== confirmPassword) {
      setPasswordSuccess(null)
      setPasswordError(t('passwordsDoNotMatch'))
      return false
    }

    const rule = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
    if (!rule.test(newPassword)) {
      setPasswordSuccess(null)
      setPasswordError(t('passwordValidationFailed'))
      return false
    }

    if (currentPassword === newPassword) {
      setPasswordSuccess(null)
      setPasswordError(t('passwordMustDiffer'))
      return false
    }

    setPasswordError(null)
    return true
  }

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validatePasswordForm()) {
      return
    }

    setIsSubmittingPassword(true)
    const result = await changePassword(currentPassword, newPassword, confirmPassword)
    setIsSubmittingPassword(false)

    if (result.ok) {
      const successMessage = result.message ?? t('passwordUpdated')
      toast({ description: successMessage })
      setPasswordError(null)
      setPasswordSuccess(successMessage)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      const errorMessage = getPasswordErrorMessage(result.code, result.error)
      setPasswordSuccess(null)
      setPasswordError(errorMessage)
    }
  }

  // Handle data export
  const handleExportData = () => {
    const data = exportSubscriptionsToJSON(subscriptions)
    downloadFile(data, "subscriptions.json", "application/json")
  }

  // Handle imports
  const handleImportData = async (subscriptionData: Omit<Subscription, "id">[]) => {
    const validSubs = subscriptionData.filter(
      (sub) => sub && typeof sub === 'object' && 'name' in sub
    )
    if (validSubs.length === 0) return

    const { error } = await bulkAddSubscriptions(validSubs)
    if (error) {
      toast({
        title: t('subscription:importFailed'),
        description: error instanceof Error ? error.message : t('subscription:failedImport'),
        variant: 'destructive',
      })
    } else {
      toast({
        title: t('subscription:importSuccess'),
        description: t('subscription:subscriptionsImported', { count: validSubs.length }),
      })
      setIsImportModalOpen(false)
    }

    await fetchSubscriptions()
  }

  // Handle data reset with confirmation
  const handleResetData = async () => {
    await resetSubscriptions()
    await resetSettings()
    window.location.reload()
  }
  
  const resetConfirmation = useConfirmation({
    title: t('resetAllData'),
    description: t('resetAllDataConfirm'),
    confirmText: t('resetAllData'),
    onConfirm: handleResetData,
  })

  if (isInitializing) {
    return <PageLoading />
  }

  return (
    <>
      <h1 className="sr-only">{t('title')}</h1>

      <Tabs keepMounted value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto scrollbar-hide">
          <TabsList className="grid h-9 w-full min-w-[320px] grid-cols-6 p-0.5">
            <TabsTrigger value="currency" className="h-8 px-2 text-xs sm:px-3">{t('currency')}</TabsTrigger>
            <TabsTrigger value="general" className="h-8 px-2 text-xs sm:px-3">{t('general')}</TabsTrigger>
            <TabsTrigger value="options" className="h-8 px-2 text-xs sm:px-3">{t('options')}</TabsTrigger>
            <TabsTrigger value="notifications" className="h-8 px-2 text-xs sm:px-3">{t('notifications')}</TabsTrigger>
            <TabsTrigger value="security" className="h-8 px-2 text-xs sm:px-3">{t('security')}</TabsTrigger>
            <TabsTrigger value="data" className="h-8 px-2 text-xs sm:px-3">{t('data')}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>{t('themeMode')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-sm space-y-2">
                <Select
                  value={theme}
                  onValueChange={async (value: ThemeType) => {
                    // Update both stores to keep them in sync
                    await setTheme(value)
                    setNextTheme(value)
                  }}
                >
                  <SelectTrigger id="theme" aria-label={t('themeMode')}>
                    <SelectValue placeholder={t('selectTheme')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{t('light')}</SelectItem>
                    <SelectItem value="dark">{t('dark')}</SelectItem>
                    <SelectItem value="system">{t('system')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t('chooseBetweenThemes')}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currency" className="space-y-4">
          <ExchangeRateManager />
        </TabsContent>

        <TabsContent value="options" className="space-y-4">
          <OptionsManager />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationSettings userId={1} />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('changePassword')}</CardTitle>
              <CardDescription>{t('changePasswordDesc')}</CardDescription>
            </CardHeader>
            <form onSubmit={handleChangePassword}>
              <CardContent className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">{t('currentPassword')}</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t('newPassword')}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <p className="text-xs text-muted-foreground">{t('passwordRules')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t('confirmNewPassword')}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                {passwordError && (
                  <p className="text-sm text-destructive" role="alert">
                    {passwordError}
                  </p>
                )}
                {passwordSuccess && !passwordError && (
                  <p className="text-sm text-success" role="status">
                    {passwordSuccess}
                  </p>
                )}
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmittingPassword || isAuthLoading}>
                  {(isSubmittingPassword || isAuthLoading) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('changePassword')}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <div className="grid gap-5 md:grid-cols-2">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>{t('dataManagement')}</CardTitle>
                <CardDescription>
                  {t('exportImportDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-wrap gap-2.5">
                <Button variant="outline" size="sm" onClick={handleExportData}>
                  <Download className="h-4 w-4" />
                  {t('exportData')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)}>
                  <Upload className="h-4 w-4" />
                  {t('importData')}
                </Button>
              </CardContent>
            </Card>

            <Card className="flex flex-col border-destructive/25 bg-destructive/[0.02]">
              <CardHeader>
                <CardTitle>{t('resetData')}</CardTitle>
                <CardDescription>
                  {t('resetDataDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button variant="destructive" size="sm" onClick={resetConfirmation.openDialog}>
                  {t('resetAllData')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>
      
      <ImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImport={handleImportData}
      />
      
      {/* Reset Confirmation Dialog */}
      <ConfirmDialog {...resetConfirmation.dialogProps} />
    </>
  )
}
