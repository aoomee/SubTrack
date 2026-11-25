import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, Bell, Clock, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { notificationApi, NotificationSetting } from '@/services/notificationApi';
import { useNotificationStore } from '@/store/notificationStore';
import { useToast } from '@/hooks/use-toast';
import { TelegramConfig } from './TelegramConfig';
import { EmailConfig } from './EmailConfig';
import { NotificationRules } from './NotificationRules';
import { SchedulerSettings } from './SchedulerSettings';

interface NotificationSettingsProps {
  userId: number;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ userId }) => {
  const { t } = useTranslation('notification');
  const { toast } = useToast();
  const cachedSettings = useNotificationStore((state) => state.notificationSettings);
  const settingsLoaded = useNotificationStore((state) => state.settingsLoaded);
  const setNotificationSettings = useNotificationStore((state) => state.setNotificationSettings);

  const [settings, setSettings] = useState<NotificationSetting[]>(() =>
    settingsLoaded ? cachedSettings : []
  );
  const [loading, setLoading] = useState(() => !settingsLoaded);

  const loadSettings = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await notificationApi.getSettings();
      // The API client already extracts the data field, so response is the data directly
      const list = Array.isArray(response) ? response : [];
      setSettings(list);
      setNotificationSettings(list);
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      toast({
        title: t('fetchSettingsError'),
        description: t('fetchSettingsError'),
        variant: 'destructive'
      });
      if (!silent) setSettings([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [setNotificationSettings, t, toast]);

  useEffect(() => {
    const warm = useNotificationStore.getState().settingsLoaded;
    if (warm) {
      setSettings(useNotificationStore.getState().notificationSettings);
      setLoading(false);
    }
    loadSettings(warm);
  }, [loadSettings]);

  const updateSetting = async (setting: NotificationSetting) => {
    try {
      await notificationApi.updateSetting(setting.id, setting);

      // Update local state and runtime cache
      setSettings(prev => {
        const next = prev.map(s => s.id === setting.id ? setting : s);
        setNotificationSettings(next);
        return next;
      });
      
      toast({
        title: t('settingUpdated'),
        description: t('settingUpdated')
      });
    } catch (error) {
      console.error('Failed to update setting:', error);
      toast({
        title: t('updateSettingError'),
        description: t('updateSettingError'),
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-4">
      <Tabs keepMounted defaultValue="channels" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="overflow-x-auto scrollbar-hide">
            <TabsList className="w-fit min-w-max sm:min-w-0">
              <TabsTrigger value="channels" className="flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5" />
                {t('channelConfig')}
              </TabsTrigger>
              <TabsTrigger value="rules" className="flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5" />
                {t('notificationRules')}
              </TabsTrigger>
              <TabsTrigger value="scheduler" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {t('scheduler.title')}
              </TabsTrigger>
            </TabsList>
          </div>
          <Button
            onClick={() => loadSettings(false)}
            disabled={loading}
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>

        <TabsContent value="channels" className="mt-0">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <TelegramConfig 
              userId={userId}
              onConfigChange={() => loadSettings(true)}
            />
            <EmailConfig 
              onConfigChange={() => loadSettings(true)}
            />
          </div>
        </TabsContent>

        <TabsContent value="rules" className="mt-0">
          <Card className="overflow-hidden">
            <CardHeader className="border-b pb-4">
              <CardTitle>{t('notificationRules')}</CardTitle>
              <CardDescription>
                {t('managePreferencesDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-0">
              <NotificationRules
                settings={settings}
                onUpdate={updateSetting}
                loading={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduler" className="mt-0">
          <SchedulerSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};
