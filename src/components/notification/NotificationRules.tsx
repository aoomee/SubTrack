import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Bell, Calendar, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NotificationSetting } from '@/services/notificationApi';

interface NotificationRulesProps {
  settings: NotificationSetting[];
  onUpdate: (setting: NotificationSetting) => void;
  loading?: boolean;
}

export const NotificationRules: React.FC<NotificationRulesProps> = ({ 
  settings, 
  onUpdate, 
  loading = false 
}) => {
  const { t } = useTranslation('notification');

  const handleToggleEnabled = (setting: NotificationSetting, enabled: boolean) => {
    onUpdate({ ...setting, is_enabled: enabled });
  };

  const handleAdvanceDaysChange = (setting: NotificationSetting, days: number) => {
    onUpdate({ ...setting, advance_days: days });
  };

  const handleRepeatNotificationChange = (setting: NotificationSetting, repeat: boolean) => {
    onUpdate({ ...setting, repeat_notification: repeat });
  };

  const handleChannelToggle = (setting: NotificationSetting, channel: string) => {
    const currentChannels = Array.isArray(setting.notification_channels) ? setting.notification_channels : ['telegram'];
    const channels = currentChannels.includes(channel)
      ? currentChannels.filter(c => c !== channel)
      : [...currentChannels, channel];

    onUpdate({ ...setting, notification_channels: channels });
  };

  const renderChannelBadges = (setting: NotificationSetting) => {
    const availableChannels = ['telegram', 'email'];
    
    return (
      <div className="flex gap-2 flex-wrap">
        {availableChannels.map((channel) => {
          const currentChannels = Array.isArray(setting.notification_channels) ? setting.notification_channels : ['telegram'];
          return (
            <Badge
              key={channel}
              variant={currentChannels.includes(channel) ? 'default' : 'secondary'}
              className="cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              role="button"
              tabIndex={setting.is_enabled && !loading ? 0 : -1}
              aria-pressed={currentChannels.includes(channel)}
              onClick={() => setting.is_enabled && !loading && handleChannelToggle(setting, channel)}
              onKeyDown={(event) => {
                if ((event.key === 'Enter' || event.key === ' ') && setting.is_enabled && !loading) {
                  event.preventDefault();
                  handleChannelToggle(setting, channel);
                }
              }}
          >
            {t(`channels.${channel}`)}
          </Badge>
          );
        })}
      </div>
    );
  };

  const renderAdvanceDaysInput = (setting: NotificationSetting) => {
    // Only renewal_reminder needs advance_days configuration
    // expiration_warning is sent exactly 1 day after expiration (fixed timing)
    if (setting.notification_type === 'renewal_reminder') {
      return (
        <div className="flex items-center gap-2">
          <Label className="text-xs whitespace-nowrap text-muted-foreground">
            {t('advanceDays')}
          </Label>
          <Input
            type="number"
            min="1"
            max="30"
            value={setting.advance_days}
            onChange={(e) => {
              const days = Math.max(1, Math.min(30, parseInt(e.target.value) || 1));
              handleAdvanceDaysChange(setting, days);
            }}
            className="h-8 w-16 rounded-xl text-center text-xs"
            disabled={!setting.is_enabled || loading}
          />
          <span className="text-xs text-muted-foreground">
            {t('days', { ns: 'common' })}
          </span>
        </div>
      );
    }
    return null;
  };

  const renderRepeatNotificationSwitch = (setting: NotificationSetting) => {
    // Only renewal_reminder supports repeat notification setting
    if (setting.notification_type === 'renewal_reminder') {
      return (
        <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-3">
          <div className="min-w-0 space-y-0.5">
            <Label className="text-xs font-medium">
              {t('repeatNotification')}
            </Label>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t('repeatNotificationDescription')}
            </p>
          </div>
          <Switch
            checked={setting.repeat_notification || false}
            onCheckedChange={(repeat) => handleRepeatNotificationChange(setting, repeat)}
            disabled={!setting.is_enabled || loading}
            className="shrink-0"
          />
        </div>
      );
    }
    return null;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'renewal_reminder':
        return <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />;
      case 'expiration_warning':
        return <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />;
      default:
        return <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="divide-y p-5 sm:p-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="py-3.5 first:pt-0 last:pb-0 animate-pulse">
            <div className="h-12 rounded-xl bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y">
      {settings && Array.isArray(settings) ? settings.map((setting) => (
        <div key={setting.notification_type} className="px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                {getNotificationIcon(setting.notification_type)}
                <h4 className="text-sm font-medium leading-5">
                  {t(`types.${setting.notification_type}`)}
                </h4>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t(`descriptions.${setting.notification_type}`)}
              </p>
            </div>
            
            <Switch
              aria-label={t(`types.${setting.notification_type}`)}
              className="mt-0.5 shrink-0"
              checked={setting.is_enabled}
              onCheckedChange={(enabled) => handleToggleEnabled(setting, enabled)}
              disabled={loading}
            />
          </div>

          {setting.is_enabled && (
            <div className="mt-3 space-y-3 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs text-muted-foreground">
                    {t('channelsLabel')}
                  </Label>
                  {renderChannelBadges(setting)}
                </div>
                {renderAdvanceDaysInput(setting)}
              </div>
              {renderRepeatNotificationSwitch(setting)}
            </div>
          )}
        </div>
      )) : (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t('noSettingsFound', 'No notification settings found')}
        </div>
      )}
    </div>
  );
};
