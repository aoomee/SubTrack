import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isLoading, error, user, initialized } = useAuthStore()
  const { t } = useTranslation('auth')
  useEffect(() => {
    if (initialized && user && location.pathname === '/login') {
      navigate('/', { replace: true })
    }
  }, [initialized, user, location.pathname, navigate])

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(false)
    const ok = await login(username, password)
    if (ok) {
      navigate('/')
    } else {
      setLocalError(true)
    }
  }

  return (
    <div className="w-full max-w-[420px] pb-12">
      <div className="mb-8 text-center">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.035em] sm:text-[34px]">{t('title')}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">{t('username')}</label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">{t('password')}</label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {(localError || error) && (
              <p className="rounded-lg bg-destructive/8 px-3 py-2 text-center text-sm text-destructive" role="alert">
                {localError ? t('invalidCredentials') : error}
              </p>
            )}
            <Button type="submit" disabled={isLoading} className="h-11 w-full">
              {isLoading ? t('signingIn') : t('submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
