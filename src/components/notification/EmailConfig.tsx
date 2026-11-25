import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { Mail, Loader2, Send, Save, Check, X } from 'lucide-react';
import { notificationApi } from '@/services/notificationApi';
import { useToast } from '@/hooks/use-toast';
import { useNotificationStore } from '@/store/notificationStore';

interface EmailConfigProps {
  onConfigChange?: () => void;
}

interface EmailChannelConfig {
  email: string;
}

interface ConfigResponse {
  config?: EmailChannelConfig;
  is_active?: boolean;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EmailConfig: React.FC<EmailConfigProps> = ({ onConfigChange }) => {
  const { t } = useTranslation('notification');
  const { toast } = useToast();

  const {
    channelConfigs,
    emailIsActive,
    emailLoaded,
    setEmailConfig,
    setEmailRuntime,
    setChannelValidated
  } = useNotificationStore();

  const [emailAddress, setEmailAddress] = useState(channelConfigs.email?.email || '');
  const [loading, setLoading] = useState(() => !emailLoaded);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(() => emailIsActive);

  const isEmailValid = useMemo(() => emailRegex.test(emailAddress.trim()), [emailAddress]);

  const loadConfig = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await notificationApi.getChannelConfig('email');
      const configResponse = response as unknown as ConfigResponse;
      const configEmail = configResponse?.config?.email || '';
      const activeFlag = Boolean(configResponse?.is_active);

      setEmailAddress(configEmail);
      setIsActive(activeFlag);
      setEmailRuntime({ isActive: activeFlag, loaded: true });

      if (configEmail) {
        setEmailConfig({ email: configEmail, validated: true });
        setChannelValidated('email', true);
      }
    } catch {
      // 404 indicates channel not yet configured; keep local state
      setIsActive(false);
      setEmailRuntime({ isActive: false, loaded: true });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [setEmailConfig, setEmailRuntime, setChannelValidated]);

  useEffect(() => {
    const warm = useNotificationStore.getState().emailLoaded;
    if (warm) {
      setIsActive(useNotificationStore.getState().emailIsActive);
      setLoading(false);
    }
    loadConfig(warm);
  }, [loadConfig]);

  const handleEmailChange = (value: string) => {
    setEmailAddress(value);
    const valid = emailRegex.test(value.trim());
    setEmailConfig({ email: value, validated: valid });
    setChannelValidated('email', valid);
  };

  const handleSave = async () => {
    const trimmedEmail = emailAddress.trim();
    if (!emailRegex.test(trimmedEmail)) {
      toast({
        title: t('errors.invalidEmail'),
        description: t('emailConfig.help'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);
      await notificationApi.configureChannel('email', { email: trimmedEmail });
      toast({
        title: t('emailConfig.saved'),
        description: t('channelConfigured')
      });
      await loadConfig(true);
      onConfigChange?.();
    } catch (error) {
      console.error('Failed to save email config:', error);
      toast({
        title: t('emailConfig.saveError'),
        description: t('errors.configSaveFailed'),
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const trimmedEmail = emailAddress.trim();
    if (!emailRegex.test(trimmedEmail)) {
      toast({
        title: t('errors.invalidEmail'),
        description: t('emailConfig.help'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setTesting(true);
      await notificationApi.testNotification('email');
      toast({
        title: t('testSuccess'),
        description: t('testSuccess')
      });
    } catch (error) {
      console.error('Failed to send test email:', error);
      toast({
        title: t('testFailed'),
        description: t('errors.sendFailed'),
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const renderStatusBadge = () => {
    if (!emailAddress) {
      return <Badge variant="secondary">{t('channelNotConfigured')}</Badge>;
    }

    if (isEmailValid) {
      return <Badge variant="success">{t('configured')}</Badge>;
    }

    return <Badge variant="destructive">{t('errors.invalidEmail')}</Badge>;
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          {t('email')}
        </CardTitle>
        {renderStatusBadge()}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {isActive && emailAddress && (
          <div className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-3.5">
            <dl className="min-w-0 space-y-1">
              <dt className="text-xs text-muted-foreground">{t('emailConfig.active')}</dt>
              <dd className="truncate font-mono text-sm font-medium text-foreground" title={emailAddress}>
                {emailAddress}
              </dd>
            </dl>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email-recipient">{t('emailConfig.address')}</Label>
          <Input
            id="email-recipient"
            type="email"
            value={emailAddress}
            placeholder="user@example.com"
            onChange={(event) => handleEmailChange(event.target.value)}
            disabled={loading}
          />
          {emailAddress && (
            <div className="flex items-center gap-1.5 text-xs" aria-live="polite">
              {isEmailValid ? (
                <>
                  <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                  <span className="text-success">{t('emailConfig.valid')}</span>
                </>
              ) : (
                <>
                  <X className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  <span className="text-destructive">{t('errors.invalidEmail')}</span>
                </>
              )}
            </div>
          )}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
          {t('emailConfig.help')}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving || !isEmailValid}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('save')}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={!isEmailValid || testing}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('test')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmailConfig;
