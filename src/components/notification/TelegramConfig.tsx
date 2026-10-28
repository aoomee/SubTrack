import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Send, Check, X, MessageCircle, Settings } from 'lucide-react';
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

  // 使用本地存储
  const {
    channelConfigs,
    setTelegramConfig,
    setChannelValidated
  } = useNotificationStore();

  const [config, setConfig] = useState<TelegramConfigData>({
    chat_id: channelConfigs.telegram?.chat_id || ''
  });
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [chatIdValid, setChatIdValid] = useState<boolean | null>(
    channelConfigs.telegram?.validated ?? null
  );
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
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
      console.error('Failed to load Telegram config:', error);
      // 如果配置不存在（404错误），使用本地存储的数据或重置为空配置
      if (((error as ApiResponse).status ?? (error as ApiResponse).response?.status) === 404) {
        const localChatId = useNotificationStore.getState().channelConfigs.telegram?.chat_id || '';
        setConfig({ chat_id: localChatId });
      }
    } finally {
      setLoading(false);
    }
  }, [setTelegramConfig]);

  const loadBotInfo = useCallback(async () => {
    try {
      const [configStatus, botInfoResponse] = await Promise.all([
        notificationApi.getTelegramConfigStatus(),
        notificationApi.getBotInfo()
      ]);

      // The API client already extracts the data field, so configStatus and botInfoResponse are the data directly
      setBotConfig(configStatus || { configured: false, hasToken: false, isPlaceholder: true });
      setBotInfo((botInfoResponse as BotInfoResponse)?.success ? (botInfoResponse as BotInfoResponse).botInfo || null : null);
    } catch (error) {
      console.error('Failed to load bot info:', error);
      // Set default values on error
      setBotConfig({ configured: false, hasToken: false, isPlaceholder: true });
      setBotInfo(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setInitializing(true);
    // Reveal the entire form together, even when the bot endpoint is slower.
    void Promise.all([loadConfig(), loadBotInfo()]).finally(() => {
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

      // 重新加载配置以确保显示最新保存的数据
      await loadConfig();

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
      return <Badge variant="default" className="bg-green-500">{t('configured')}</Badge>;
    } else {
      return <Badge variant="destructive">{t('notConfigured')}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          {t('telegram')}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative" aria-busy={initializing}>
        {initializing && (
          <div role="status" aria-label={t('loading', { ns: 'common' })} className="absolute inset-x-5 top-0 space-y-4 sm:inset-x-6" data-telegram-loading>
            <div className="h-[104px] rounded-lg bg-muted/70" />
            <div className="h-4 w-20 rounded bg-muted/70" />
            <div className="h-10 rounded-full bg-muted/70" />
            <div className="h-10 w-3/4 rounded bg-muted/70" />
            <div className="h-10 w-40 rounded-full bg-muted/70" />
          </div>
        )}
        <div className={`space-y-4${initializing ? ' invisible' : ''}`} aria-hidden={initializing || undefined}>
          {/* Natural height and symmetric padding keep the original three rows balanced. */}
          <Alert
            data-bot-summary
            className="[&>svg+div]:translate-y-0"
            variant={botConfig && !botConfig.configured ? 'destructive' : 'default'}
          >
            <Settings className="h-4 w-4" />
            <AlertDescription>
              {botConfig && !botConfig.configured ? t('errors.telegramNotConfigured') : (
                <div className="space-y-1">
                  <div className="flex gap-1"><strong className="shrink-0">{t('botName')}:</strong><span className="truncate" title={botInfo?.first_name}>{botInfo?.first_name || '—'}</span></div>
                  <div className="flex gap-1"><strong className="shrink-0">{t('botUsername')}:</strong><span className="truncate" title={botInfo?.username}>{botInfo?.username ? `@${botInfo.username}` : '—'}</span></div>
                  <div><strong>{t('botStatus')}:</strong> {getStatusBadge()}</div>
                </div>
              )}
            </AlertDescription>
          </Alert>

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
          <div className="min-h-5" aria-live="polite">
          {chatIdValid !== null && (
            <div className="flex items-center gap-2 text-sm">
              {chatIdValid ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-green-600">{t('chatIdValid')}</span>
                </>
              ) : (
                <>
                  <X className="h-4 w-4 text-red-500" />
                  <span className="text-red-600">{t('chatIdInvalid')}</span>
                </>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Help Text */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="text-xs whitespace-pre-line">
            {t('chatIdHelp')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
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