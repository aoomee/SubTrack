import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Send, Check, X, MessageCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { notificationApi } from '@/services/notificationApi';
import { useToast } from '@/hooks/use-toast';
import { useNotificationStore } from '@/store/notificationStore';

interface TelegramConfigProps {
  userId: number;
  onConfigChange?: () => void;
}

interface TelegramConfigData {
  chat_id: string;
}

interface BotConfig {
  configured: boolean;
  hasToken: boolean;
  isPlaceholder: boolean;
}

interface BotInfo {
  id: number;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

interface ApiResponse {
  status?: number;
  response?: { status?: number };
}

interface ConfigResponse {
  config?: TelegramConfigData;
}

interface ValidationResponse {
  success?: boolean;
  error?: string;
}

interface BotInfoResponse {
  success?: boolean;
  botInfo?: BotInfo;
}

export const TelegramConfig: React.FC<TelegramConfigProps> = ({ userId, onConfigChange }) => {
  const { t } = useTranslation('notification');
  const { toast } = useToast();

  // 使用本地存储 + 运行时内存缓存
  const {
    channelConfigs,
    telegramBotStatus,
    telegramBotInfo,
    telegramLoaded,
    setTelegramConfig,
    setTelegramRuntime,
    setChannelValidated
  } = useNotificationStore();

  const [config, setConfig] = useState<TelegramConfigData>({
    chat_id: channelConfigs.telegram?.chat_id || ''
  });
  const [loading, setLoading] = useState(() => !telegramLoaded);
  const [initializing, setInitializing] = useState(() => !telegramLoaded);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [chatIdValid, setChatIdValid] = useState<boolean | null>(
    channelConfigs.telegram?.validated ?? null
  );
  const [botConfig, setBotConfig] = useState<BotConfig | null>(() =>
    telegramLoaded ? telegramBotStatus : null
  );
  const [botInfo, setBotInfo] = useState<BotInfo | null>(() =>
    telegramLoaded ? telegramBotInfo : null
  );

  const loadConfig = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await notificationApi.getChannelConfig('telegram');
      if (response) {
        // 后端返回的配置结构：{ id, channel_type, channel_config, config, is_active, ... }
        // config 字段是解析后的 JSON 对象，channel_config 是原始 JSON 字符串
        const configData = (response as unknown as ConfigResponse).config || {};
        const chatId = (configData as TelegramConfigData).chat_id || '';

        // 更新本地状态和本地存储
        setConfig({ chat_id: chatId });
        setTelegramConfig({ chat_id: chatId });
      }
    } catch (error) {
      // 404 is expected when Telegram channel has not been configured yet
      if (((error as ApiResponse).status ?? (error as ApiResponse).response?.status) === 404) {
        const localChatId = useNotificationStore.getState().channelConfigs.telegram?.chat_id || '';
        setConfig({ chat_id: localChatId });
      } else {
        console.error('Failed to load Telegram config:', error);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [setTelegramConfig]);

  const loadBotInfo = useCallback(async () => {
    try {
      const configStatus = await notificationApi.getTelegramConfigStatus();
      const normalizedStatus = configStatus || { configured: false, hasToken: false, isPlaceholder: true };
      setBotConfig(normalizedStatus);

      if (!normalizedStatus.configured) {
        setBotInfo(null);
        setTelegramRuntime({ botStatus: normalizedStatus, botInfo: null, loaded: true });
        return;
      }

      const botInfoResponse = await notificationApi.getBotInfo();
      const nextBotInfo = (botInfoResponse as BotInfoResponse)?.success
        ? (botInfoResponse as BotInfoResponse).botInfo || null
        : null;
      setBotInfo(nextBotInfo);
      setTelegramRuntime({ botStatus: normalizedStatus, botInfo: nextBotInfo, loaded: true });
    } catch (error) {
      console.error('Failed to load bot info:', error);
      // Set default values on error
      const fallbackStatus = { configured: false, hasToken: false, isPlaceholder: true };
      setBotConfig(fallbackStatus);
      setBotInfo(null);
      setTelegramRuntime({ botStatus: fallbackStatus, botInfo: null, loaded: true });
    }
  }, [setTelegramRuntime]);

  useEffect(() => {
    let active = true;
    const warm = useNotificationStore.getState().telegramLoaded;
    if (warm) {
      const state = useNotificationStore.getState();
      setBotConfig(state.telegramBotStatus);
      setBotInfo(state.telegramBotInfo);
      setConfig({ chat_id: state.channelConfigs.telegram?.chat_id || '' });
      setInitializing(false);
      setLoading(false);
    } else {
      setInitializing(true);
    }
    // Reveal the entire form together on cold load, or refresh silently when already cached.
    void Promise.all([loadConfig(warm), loadBotInfo()]).finally(() => {
      if (active) setInitializing(false);
    });
    return () => { active = false; };
  }, [userId, loadConfig, loadBotInfo]);

  const validateChatId = async (chatId: string) => {
    if (!chatId.trim()) {
      setChatIdValid(null);
      setChannelValidated('telegram', false);
      return;
    }

    try {
      setValidating(true);
      const response = await notificationApi.validateChatId(chatId);
      // The API client already extracts the data field, so response is the data directly
      const isValid = (response as ValidationResponse)?.success || false;
      setChatIdValid(isValid);
      setChannelValidated('telegram', isValid);

      if (isValid) {
        toast({
          title: t('chatIdValid'),
          description: t('chatIdValid'),
        });
      } else {
        toast({
          title: t('chatIdInvalid'),
          description: (response as ValidationResponse)?.error || t('chatIdInvalid'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to validate Chat ID:', error);
      setChatIdValid(false);
      setChannelValidated('telegram', false);
      toast({
        title: t('chatIdInvalid'),
        description: t('chatIdHelp'),
        variant: 'destructive'
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!config.chat_id.trim()) {
      toast({
        title: t('errors.invalidChatId'),
        description: t('chatIdHelp'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);

      // 先保存到本地存储
      setTelegramConfig({
        chat_id: config.chat_id,
        validated: chatIdValid ?? false
      });

      // 然后保存到服务器
      await notificationApi.configureChannel('telegram', { chat_id: config.chat_id });

      // 静默刷新配置以确保显示最新保存的数据
      await loadConfig(true);

      toast({
        title: t('telegramConfigSaved'),
        description: t('channelConfigured'),
      });
      onConfigChange?.();
    } catch (error) {
      console.error('Failed to save Telegram config:', error);
      toast({
        title: t('telegramConfigError'),
        description: t('errors.configSaveFailed'),
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!config.chat_id.trim()) {
      toast({
        title: t('errors.invalidChatId'),
        description: t('chatIdHelp'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setTesting(true);
      await notificationApi.testNotification('telegram');
      toast({
        title: t('testSuccess'),
        description: t('testSuccess'),
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
      toast({
        title: t('testFailed'),
        description: t('errors.sendFailed'),
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleChatIdChange = (value: string) => {
    setConfig(prev => ({ ...prev, chat_id: value }));
    setChatIdValid(null);
    // 实时更新本地存储
    setTelegramConfig({ chat_id: value, validated: false });
    setChannelValidated('telegram', false);
  };

  const getStatusBadge = () => {
    if (!botConfig) {
      return <Badge variant="secondary">{t('notConfigured')}</Badge>;
    }
    
    if (botConfig.configured) {
      return <Badge variant="success">{t('configured')}</Badge>;
    } else {
      return <Badge variant="destructive">{t('notConfigured')}</Badge>;
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          {t('telegram')}
        </CardTitle>
        {!initializing && getStatusBadge()}
      </CardHeader>
      <CardContent className="relative flex flex-1 flex-col" aria-busy={initializing}>
        {initializing && (
          <div role="status" aria-label={t('loading', { ns: 'common' })} className="absolute inset-x-5 top-0 space-y-4 sm:inset-x-6" data-telegram-loading>
            <div className="h-[72px] rounded-2xl bg-muted/70" />
            <div className="h-4 w-20 rounded bg-muted/70" />
            <div className="h-10 rounded-full bg-muted/70" />
            <div className="h-10 w-3/4 rounded bg-muted/70" />
            <div className="h-10 w-40 rounded-full bg-muted/70" />
          </div>
        )}
        <div className={`flex flex-1 flex-col gap-4${initializing ? ' invisible' : ''}`} aria-hidden={initializing || undefined}>
          {botConfig && !botConfig.configured ? (
            <Alert data-bot-summary variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('errors.telegramNotConfigured')}</AlertDescription>
            </Alert>
          ) : (
            <div
              data-bot-summary
              className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-3.5"
            >
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1">
                  <dt className="text-xs text-muted-foreground">{t('botName')}</dt>
                  <dd className="truncate text-sm font-medium text-foreground" title={botInfo?.first_name}>
                    {botInfo?.first_name || '—'}
                  </dd>
                </div>
                <div className="min-w-0 space-y-1">
                  <dt className="text-xs text-muted-foreground">{t('botUsername')}</dt>
                  <dd className="truncate font-mono text-sm font-medium text-foreground" title={botInfo?.username}>
                    {botInfo?.username ? `@${botInfo.username}` : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

        {/* Chat ID Input */}
        <div className="space-y-2">
          <Label htmlFor="chat-id">{t('chatId')}</Label>
          <div className="flex gap-2">
            <Input
              id="chat-id"
              value={config.chat_id}
              onChange={(e) => handleChatIdChange(e.target.value)}
              placeholder="123456789"
              disabled={loading || initializing}
            />
            <Button
              variant="outline"
              onClick={() => validateChatId(config.chat_id)}
              disabled={initializing || loading || validating || !config.chat_id.trim()}
              className="relative shrink-0"
            >
              <span className={validating ? 'invisible' : undefined}>{t('validateChatId')}</span>
              {validating && <Loader2 className="absolute h-4 w-4 animate-spin" />}
            </Button>
          </div>
          
          {/* Chat ID Validation Status */}
          {chatIdValid !== null && (
            <div className="flex items-center gap-1.5 text-xs" aria-live="polite">
              {chatIdValid ? (
                <>
                  <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                  <span className="text-success">{t('chatIdValid')}</span>
                </>
              ) : (
                <>
                  <X className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  <span className="text-destructive">{t('chatIdInvalid')}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Help Text */}
        <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
          {t('chatIdHelp')}
        </p>

        {/* Action Buttons */}
        <div className="mt-auto flex gap-2 pt-2">
          <Button 
            onClick={handleSave} 
            disabled={initializing || saving || loading || !config.chat_id.trim()}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t('save')}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleTest} 
            disabled={initializing || testing || loading || !config.chat_id.trim() || chatIdValid === false}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t('test')}
          </Button>
        </div>

        </div>
      </CardContent>
    </Card>
  );
};