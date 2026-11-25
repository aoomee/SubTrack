import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  notificationApi,
  type NotificationSetting,
  type TelegramBotInfo,
  type TelegramConfigStatus,
} from '@/services/notificationApi';
import {
  schedulerApi,
  type SchedulerSettings,
  type SchedulerStatus,
} from '@/services/schedulerApi';

// 通知渠道配置类型
export interface NotificationChannelConfig {
  telegram?: {
    chat_id: string;
    validated?: boolean;
    lastValidated?: string;
  };
  email?: {
    email: string;
    validated?: boolean;
    lastValidated?: string;
  };
}

// 通知配置状态
interface NotificationConfigState {
  // 渠道配置（本地持久化）
  channelConfigs: NotificationChannelConfig;

  // 运行时内存缓存（避免切换设置子标签时重复等待）
  telegramBotStatus: TelegramConfigStatus | null;
  telegramBotInfo: TelegramBotInfo | null;
  telegramLoaded: boolean;
  emailIsActive: boolean;
  emailLoaded: boolean;
  notificationSettings: NotificationSetting[];
  settingsLoaded: boolean;
  schedulerSettings: SchedulerSettings | null;
  schedulerStatus: SchedulerStatus | null;
  schedulerLoaded: boolean;

  // 操作方法
  setTelegramConfig: (config: { chat_id: string; validated?: boolean }) => void;
  setEmailConfig: (config: { email: string; validated?: boolean }) => void;
  setTelegramRuntime: (payload: {
    botStatus: TelegramConfigStatus | null;
    botInfo: TelegramBotInfo | null;
    loaded?: boolean;
  }) => void;
  setEmailRuntime: (payload: { isActive: boolean; loaded?: boolean }) => void;
  setNotificationSettings: (settings: NotificationSetting[]) => void;
  setSchedulerRuntime: (payload: {
    settings: SchedulerSettings;
    status: SchedulerStatus | null;
  }) => void;
  resetRuntimeCache: () => void;
  clearChannelConfig: (channel: 'telegram' | 'email') => void;
  clearAllConfigs: () => void;

  // 验证状态管理
  setChannelValidated: (channel: 'telegram' | 'email', validated: boolean) => void;
}

const runtimeInitialState = {
  telegramBotStatus: null as TelegramConfigStatus | null,
  telegramBotInfo: null as TelegramBotInfo | null,
  telegramLoaded: false,
  emailIsActive: false,
  emailLoaded: false,
  notificationSettings: [] as NotificationSetting[],
  settingsLoaded: false,
  schedulerSettings: null as SchedulerSettings | null,
  schedulerStatus: null as SchedulerStatus | null,
  schedulerLoaded: false,
};

const initialState = {
  channelConfigs: {},
  ...runtimeInitialState,
};

export const useNotificationStore = create<NotificationConfigState>()(
  persist(
    (set) => ({
      ...initialState,

      setTelegramConfig: (config) => {
        set((state) => ({
          channelConfigs: {
            ...state.channelConfigs,
            telegram: {
              ...state.channelConfigs.telegram,
              chat_id: config.chat_id,
              validated: config.validated ?? state.channelConfigs.telegram?.validated,
              lastValidated: config.validated ? new Date().toISOString() : state.channelConfigs.telegram?.lastValidated,
            },
          },
        }));
      },

      setEmailConfig: (config) => {
        set((state) => ({
          channelConfigs: {
            ...state.channelConfigs,
            email: {
              ...state.channelConfigs.email,
              email: config.email,
              validated: config.validated ?? state.channelConfigs.email?.validated,
              lastValidated: config.validated ? new Date().toISOString() : state.channelConfigs.email?.lastValidated,
            },
          },
        }));
      },

      setTelegramRuntime: ({ botStatus, botInfo, loaded = true }) => {
        set({
          telegramBotStatus: botStatus,
          telegramBotInfo: botInfo,
          telegramLoaded: loaded,
        });
      },

      setEmailRuntime: ({ isActive, loaded = true }) => {
        set({
          emailIsActive: isActive,
          emailLoaded: loaded,
        });
      },

      setNotificationSettings: (settings) => {
        set({
          notificationSettings: settings,
          settingsLoaded: true,
        });
      },

      setSchedulerRuntime: ({ settings, status }) => {
        set({
          schedulerSettings: settings,
          schedulerStatus: status,
          schedulerLoaded: true,
        });
      },

      resetRuntimeCache: () => {
        set({ ...runtimeInitialState });
      },

      clearChannelConfig: (channel) => {
        set((state) => {
          const newConfigs = { ...state.channelConfigs };
          delete newConfigs[channel];
          return { channelConfigs: newConfigs };
        });
      },

      clearAllConfigs: () => {
        set({ channelConfigs: {}, ...runtimeInitialState });
      },

      setChannelValidated: (channel, validated) => {
        set((state) => {
          const currentConfig = state.channelConfigs[channel];
          if (!currentConfig) return state;

          return {
            channelConfigs: {
              ...state.channelConfigs,
              [channel]: {
                ...currentConfig,
                validated,
                lastValidated: validated ? new Date().toISOString() : currentConfig.lastValidated,
              },
            },
          };
        });
      },
    }),
    {
      name: 'notification-config-storage',
      // 只持久化配置数据，不持久化运行时状态缓存
      partialize: (state) => ({
        channelConfigs: state.channelConfigs,
      }),
    }
  )
);

let prefetchPromise: Promise<void> | null = null;

/**
 * Background-warms notification channels, rules, and scheduler state when the user enters Settings,
 * so clicking "通知 -> 渠道配置 / 通知规则 / 定时任务" renders instantaneously.
 */
export function prefetchNotificationCenter(): Promise<void> {
  const store = useNotificationStore.getState();
  if (store.telegramLoaded && store.emailLoaded && store.settingsLoaded && store.schedulerLoaded) {
    return Promise.resolve();
  }
  if (prefetchPromise) {
    return prefetchPromise;
  }

  prefetchPromise = (async () => {
    await Promise.allSettled([
      // 1. Telegram channel config + status + bot info
      (async () => {
        if (useNotificationStore.getState().telegramLoaded) return;
        const [channelRes, statusRes] = await Promise.allSettled([
          notificationApi.getChannelConfig('telegram'),
          notificationApi.getTelegramConfigStatus(),
        ]);

        if (channelRes.status === 'fulfilled' && channelRes.value) {
          const cfg = (channelRes.value as unknown as { config?: { chat_id?: string } }).config;
          if (cfg?.chat_id !== undefined) {
            useNotificationStore.getState().setTelegramConfig({ chat_id: cfg.chat_id || '' });
          }
        }

        const botStatus: TelegramConfigStatus =
          statusRes.status === 'fulfilled' && statusRes.value
            ? statusRes.value
            : { configured: false, hasToken: false, isPlaceholder: true };

        let botInfo: TelegramBotInfo | null = null;
        if (botStatus.configured) {
          try {
            const infoRes = await notificationApi.getBotInfo();
            botInfo = (infoRes as { success?: boolean; botInfo?: TelegramBotInfo })?.success
              ? (infoRes as { botInfo?: TelegramBotInfo }).botInfo || null
              : null;
          } catch {
            botInfo = null;
          }
        }

        useNotificationStore.getState().setTelegramRuntime({ botStatus, botInfo, loaded: true });
      })(),

      // 2. Email channel config
      (async () => {
        if (useNotificationStore.getState().emailLoaded) return;
        try {
          const res = await notificationApi.getChannelConfig('email');
          const parsed = res as unknown as { config?: { email?: string }; is_active?: boolean };
          const email = parsed?.config?.email || '';
          if (email) {
            useNotificationStore.getState().setEmailConfig({ email, validated: true });
          }
          useNotificationStore.getState().setEmailRuntime({ isActive: Boolean(parsed?.is_active), loaded: true });
        } catch {
          useNotificationStore.getState().setEmailRuntime({ isActive: false, loaded: true });
        }
      })(),

      // 3. Notification rules
      (async () => {
        if (useNotificationStore.getState().settingsLoaded) return;
        const settings = await notificationApi.getSettings();
        useNotificationStore.getState().setNotificationSettings(Array.isArray(settings) ? settings : []);
      })(),

      // 4. Scheduler settings + status
      (async () => {
        if (useNotificationStore.getState().schedulerLoaded) return;
        const [settings, status] = await Promise.all([
          schedulerApi.getSettings(),
          schedulerApi.getStatus(),
        ]);
        useNotificationStore.getState().setSchedulerRuntime({ settings, status });
      })(),
    ]);
  })().finally(() => {
    prefetchPromise = null;
  });

  return prefetchPromise;
}
