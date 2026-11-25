import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { schedulerApi, SchedulerSettings as SchedulerSettingsType, SchedulerStatus } from '@/services/schedulerApi';
import { useNotificationStore } from '@/store/notificationStore';
import { LoadingIndicator } from '@/components/ui/loading-indicator';

export function SchedulerSettings() {
  const { t } = useTranslation('notification');
  const { toast } = useToast();
  const cachedSettings = useNotificationStore((state) => state.schedulerSettings);
  const cachedStatus = useNotificationStore((state) => state.schedulerStatus);
  const schedulerLoaded = useNotificationStore((state) => state.schedulerLoaded);
  const setSchedulerRuntime = useNotificationStore((state) => state.setSchedulerRuntime);

  const [settings, setSettings] = useState<SchedulerSettingsType>(() =>
    schedulerLoaded && cachedSettings
      ? cachedSettings
      : {
          notification_check_time: '09:00',
          timezone: 'Asia/Shanghai',
          is_enabled: true
        }
  );
  const [status, setStatus] = useState<SchedulerStatus | null>(() =>
    schedulerLoaded ? cachedStatus : null
  );
  const [loading, setLoading] = useState(() => !schedulerLoaded);
  const [saving, setSaving] = useState(false);

  const timezones = [
    { value: 'Asia/Shanghai', label: t('scheduler.timezones.Asia/Shanghai') },
    { value: 'Asia/Tokyo', label: t('scheduler.timezones.Asia/Tokyo') },
    { value: 'Asia/Seoul', label: t('scheduler.timezones.Asia/Seoul') },
    { value: 'Asia/Hong_Kong', label: t('scheduler.timezones.Asia/Hong_Kong') },
    { value: 'America/New_York', label: t('scheduler.timezones.America/New_York') },
    { value: 'America/Los_Angeles', label: t('scheduler.timezones.America/Los_Angeles') },
    { value: 'Europe/London', label: t('scheduler.timezones.Europe/London') },
    { value: 'Europe/Paris', label: t('scheduler.timezones.Europe/Paris') },
    { value: 'UTC', label: t('scheduler.timezones.UTC') }
  ];

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [settingsData, statusData] = await Promise.all([
        schedulerApi.getSettings(),
        schedulerApi.getStatus()
      ]);
      setSettings(settingsData);
      setStatus(statusData);
      setSchedulerRuntime({ settings: settingsData, status: statusData });
    } catch (error) {
      console.error('Failed to load scheduler data:', error);
      toast({
        title: t('scheduler.messages.loadFailed'),
        variant: 'destructive',
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [setSchedulerRuntime, t, toast]);

  useEffect(() => {
    const warm = useNotificationStore.getState().schedulerLoaded;
    if (warm) {
      const state = useNotificationStore.getState();
      if (state.schedulerSettings) setSettings(state.schedulerSettings);
      setStatus(state.schedulerStatus);
      setLoading(false);
    }
    loadData(warm);
  }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await schedulerApi.updateSettings(settings);
      toast({
        title: t('scheduler.messages.updateSuccess'),
      });
      // 静默刷新最新状态，避免保存时整个表单闪成加载圈
      await loadData(true);
    } catch (error) {
      console.error('Failed to update scheduler settings:', error);
      toast({
        title: t('scheduler.messages.updateFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerCheck = async () => {
    try {
      await schedulerApi.triggerCheck();
      toast({
        title: t('scheduler.messages.triggerSuccess'),
      });
    } catch (error) {
      console.error('Failed to trigger notification check:', error);
      toast({
        title: t('scheduler.messages.triggerFailed'),
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = () => {
    if (!status) return null;

    if (!settings.is_enabled) {
      return <Badge variant="secondary">{t('scheduler.status.disabled')}</Badge>;
    }

    if (status.running) {
      return <Badge variant="default">{t('scheduler.status.running')}</Badge>;
    }

    return <Badge variant="destructive">{t('scheduler.status.stopped')}</Badge>;
  };

  if (loading) {
    return (
      <Card className="flex min-h-[320px] items-center justify-center p-6" aria-busy="true">
        <LoadingIndicator size="md" />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {t('scheduler.settings')}
          </CardTitle>
          <CardDescription>
            {t('scheduler.description')}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {status?.currentSchedule && (
            <span className="font-mono text-xs text-muted-foreground">
              {status.currentSchedule.time} · {status.currentSchedule.timezone}
            </span>
          )}
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 启用/禁用开关 */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3">
          <div className="min-w-0 space-y-0.5">
            <Label className="text-sm font-medium">{t('scheduler.enableScheduler')}</Label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('scheduler.enableDescription')}
            </p>
          </div>
          <Switch
            checked={settings.is_enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, is_enabled: checked })}
            disabled={saving}
            className="shrink-0"
          />
        </div>

        {/* 时间与时区并排 */}
        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="check-time">{t('scheduler.checkTime')}</Label>
            <Input
              id="check-time"
              type="time"
              value={settings.notification_check_time}
              onChange={(e) => setSettings({ ...settings, notification_check_time: e.target.value })}
              disabled={saving || !settings.is_enabled}
              className="w-full"
            />
          </div>

          <div className="min-w-0 space-y-2">
            <Label>{t('scheduler.timezone')}</Label>
            <Select
              value={settings.timezone}
              onValueChange={(value) => setSettings({ ...settings, timezone: value })}
              disabled={saving || !settings.is_enabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 提示信息 */}
        {!settings.is_enabled && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-warning/25 bg-warning/10 p-3.5 text-warning">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-xs leading-relaxed">
              <p className="font-medium">{t('scheduler.disabledWarning')}</p>
              <p className="mt-0.5 opacity-90">{t('scheduler.disabledWarningDescription')}</p>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('scheduler.saving') : t('scheduler.saveSettings')}
          </Button>

          <Button
            variant="outline"
            onClick={handleTriggerCheck}
            disabled={!settings.is_enabled}
          >
            <Play className="h-4 w-4" />
            {t('scheduler.manualTrigger')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
