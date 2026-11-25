import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  RefreshCw,
  Bell,
  Search,
  Check,
  AlertCircle,
  ChevronRight,
  Calendar,
  Coins,
  CreditCard,
  FileText,
  Lightbulb,
  Mail,
  Clock,
  Trash2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { notificationApi, NotificationHistory as NotificationHistoryType, NotificationStats } from '@/services/notificationApi';
import { useNotificationHistoryStore } from '@/store/notificationHistoryStore';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/utils/date';
import { cn } from '@/lib/utils';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { PageLoading } from '@/components/ui/page-loading';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';


// Helper function to parse and format message content (supports zh-CN and en templates)
const parseMessageContent = (content: string, t: (key: string, options?: Record<string, unknown>) => string) => {
  if (!content) return { summary: '', details: [] };

  // Remove HTML tags but preserve line breaks
  let text = content.replace(/<br\s*\/?>(?=\n)?/gi, '\n');
  text = text.replace(/<[^>]*>/g, '');
  // Normalize whitespace but KEEP newlines
  text = text
    .replace(/\r/g, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  // Extract key information
  const titleMatch = text.match(/(续订提醒|续订成功|续订失败|订阅变更|过期警告|Renewal Reminder|Subscription Expiration Warning|Renewal Successful|Renewal Failed|Subscription Change)/i);
  const title = titleMatch ? titleMatch[1] : t('history.defaultNotification');

  // Try multiple patterns to extract subscription name
  let subscriptionName = '';

  // Pattern 1: after 📢 emoji
  const nameMatch1 = text.match(/📢\s+([^\s]+)\s+(?:即将到期|续订|信息已更新|已过期|is about to expire|has expired|has been successfully renewed|renewal failed|information has been updated)/i);
  if (nameMatch1) {
    subscriptionName = nameMatch1[1];
  } else {
    // Pattern 2: generic before action words
    const nameMatch2 = text.match(/([a-zA-Z0-9_.-]+)\s+(?:即将到期|续订成功|续订失败|信息已更新|已过期|is about to expire|has expired|has been successfully renewed|renewal failed|information has been updated)/i);
    if (nameMatch2) subscriptionName = nameMatch2[1];
  }

  // Amount
  const amountMatch = text.match(/(?:金额|Amount)[：:\s]*([0-9.]+\s*[A-Z]{3})/i);
  const amount = amountMatch ? amountMatch[1] : '';

  // Date (accept yyyy-mm-dd or yyyy/mm/dd)
  const dateMatch = text.match(/(?:到期日期|到期时间|过期时间|Expiration date|Next payment|Scheduled renewal date)[：:\s]*(\d{4}[/-]\d{1,2}[/-]\d{1,2})/i);
  const date = dateMatch ? dateMatch[1] : '';

  // Payment method
  const paymentMatch = text.match(/(?:支付方式|Payment method)[：:\s]*([^\n]+)/i);
  const paymentMethod = paymentMatch ? paymentMatch[1].trim() : '';

  // Plan
  const planMatch = text.match(/(?:套餐|计划|Plan)[：:\s]*([^\n]+)/i);
  const plan = planMatch ? planMatch[1].trim() : '';

  // Create summary - prioritize subscription name over notification type
  const summary = subscriptionName && !subscriptionName.includes('_reminder_') ? subscriptionName : title;

  // Create details array
  const details: Array<{ label: string; value: string; iconKey: 'date' | 'amount' | 'payment' | 'plan' | 'tip' }> = [];
  if (date) details.push({ label: t('history.expiryDate'), value: date, iconKey: 'date' });
  if (amount) details.push({ label: t('history.amount'), value: amount, iconKey: 'amount' });
  if (paymentMethod) details.push({ label: t('history.paymentMethod'), value: paymentMethod, iconKey: 'payment' });
  if (plan) details.push({ label: t('history.plan'), value: plan, iconKey: 'plan' });

  // Action/tip
  const actionMatch = text.match(/(请及时续订以避免服务中断|请检查您的支付方式并手动续订|变更已生效|Please renew in time to avoid service interruption|Please check your payment method|The change has taken effect)/i);
  if (actionMatch) {
    details.push({ label: t('history.tip'), value: actionMatch[1], iconKey: 'tip' });
  }

  return { summary, details, fullText: text };
};

const renderDetailIcon = (iconKey: 'date' | 'amount' | 'payment' | 'plan' | 'tip') => {
  switch (iconKey) {
    case 'date':
      return <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
    case 'amount':
      return <Coins className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
    case 'payment':
      return <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
    case 'plan':
      return <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
    case 'tip':
      return <Lightbulb className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  }
};

export const NotificationHistory: React.FC = () => {
  const { t } = useTranslation('notification');
  const { toast } = useToast();
  const tRef = useRef(t);
  const toastRef = useRef(toast);
  tRef.current = t;
  toastRef.current = toast;

  const initialCacheRef = useRef(useNotificationHistoryStore.getState());
  const hasWarmCache = initialCacheRef.current.hasLoaded;

  const [history, setHistory] = useState<NotificationHistoryType[]>(() =>
    hasWarmCache ? initialCacheRef.current.history : []
  );
  const [stats, setStats] = useState<NotificationStats | null>(() =>
    hasWarmCache ? initialCacheRef.current.stats : null
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(() => !hasWarmCache);
  const initialLoadRef = useRef(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [historyPagination, setHistoryPagination] = useState(() =>
    hasWarmCache
      ? initialCacheRef.current.pagination
      : {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        }
  );
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    mode: 'single' | 'batch' | 'clear';
    targetId?: number;
  }>({ open: false, mode: 'batch' });

  const loadHistory = useCallback(async (page = 1, silent = false) => {
    try {
      if (!silent) setHistoryLoading(true);
      const params: { page: number; limit: number; status?: string; type?: string } = {
        page,
        limit: historyPagination.limit
      };
      
      // Add filter parameters to API call
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      // Note: searchTerm and channelFilter still handled on frontend for now
      // as backend doesn't support these filters yet
      
      const response = await notificationApi.getHistory(params);
      const nextHistory = Array.isArray(response.data) ? response.data : [];
      const nextPagination = {
        limit: historyPagination.limit,
        page: response.pagination.page,
        total: response.pagination.total,
        totalPages: Math.ceil(response.pagination.total / response.pagination.limit)
      };
      setHistory(nextHistory);
      setHistoryPagination(nextPagination);

      if (page === 1 && statusFilter === 'all' && typeFilter === 'all') {
        useNotificationHistoryStore.getState().setSnapshot({
          history: nextHistory,
          pagination: nextPagination,
        });
      }
    } catch (error) {
      console.error('Failed to load notification history:', error);
      toastRef.current({
        title: tRef.current('fetchSettingsError'),
        description: tRef.current('fetchSettingsError'),
        variant: 'destructive'
      });
      if (!silent) setHistory([]);
    } finally {
      if (!silent) setHistoryLoading(false);
    }
  }, [historyPagination.limit, statusFilter, typeFilter]);

  const loadStats = useCallback(async (silent = false) => {
    try {
      if (!silent) setStatsLoading(true);
      const response = await notificationApi.getStats();
      setStats(response);
      useNotificationHistoryStore.getState().setStats(response);
    } catch (error) {
      console.error('Failed to load notification stats:', error);
      if (!silent) setStats(null);
    } finally {
      if (!silent) setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      const silent = useNotificationHistoryStore.getState().hasLoaded;
      Promise.all([loadHistory(1, silent), loadStats(silent)]).finally(() => {
        useNotificationHistoryStore.getState().markLoaded();
        setIsInitializing(false);
      });
      return;
    }

    // Reload data when status or type filter changes.
    setSelectedIds(new Set());
    setHistoryPagination(prev => ({ ...prev, page: 1 }));
    loadHistory(1, false);
  }, [statusFilter, typeFilter, loadHistory, loadStats]);

  const handlePageChange = (page: number) => {
    setSelectedIds(new Set());
    loadHistory(page);
  };

  const toggleExpanded = (itemId: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleSelectItem = (itemId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (filteredHistory.length === 0) return;
    const allSelected = filteredHistory.every(item => selectedIds.has(item.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        filteredHistory.forEach(item => next.delete(item.id));
      } else {
        filteredHistory.forEach(item => next.add(item.id));
      }
      return next;
    });
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      if (confirmState.mode === 'clear') {
        await notificationApi.clearHistory();
        setSelectedIds(new Set());
        setExpandedItems(new Set());
        setHistory([]);
        const emptyPagination = { page: 1, limit: historyPagination.limit, total: 0, totalPages: 0 };
        setHistoryPagination(emptyPagination);
        useNotificationHistoryStore.getState().setSnapshot({ history: [], pagination: emptyPagination });
        await loadStats(true);
        toast({ title: t('history.clearSuccess') });
        return;
      }

      const idsToDelete =
        confirmState.mode === 'single' && confirmState.targetId
          ? [confirmState.targetId]
          : filteredHistory.filter(item => selectedIds.has(item.id)).map(item => item.id);

      if (idsToDelete.length === 0) return;

      if (idsToDelete.length === 1) {
        await notificationApi.deleteHistoryItem(idsToDelete[0]);
      } else {
        await notificationApi.deleteHistoryBatch(idsToDelete);
      }

      const deletedSet = new Set(idsToDelete);
      const remainingOnPage = history.filter(item => !deletedSet.has(item.id)).length;
      const nextPage = remainingOnPage === 0 && historyPagination.page > 1
        ? historyPagination.page - 1
        : historyPagination.page;

      setSelectedIds(prev => {
        const next = new Set(prev);
        idsToDelete.forEach(id => next.delete(id));
        return next;
      });
      setExpandedItems(prev => {
        const next = new Set(prev);
        idsToDelete.forEach(id => next.delete(id));
        return next;
      });

      await Promise.all([loadHistory(nextPage, true), loadStats(true)]);
      toast({
        title: t('history.deleteSuccess', { count: idsToDelete.length }),
      });
    } catch (error) {
      console.error('Failed to delete notification history:', error);
      toast({
        title: t('history.deleteFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };



  const getStatusDotClass = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-success';
      case 'failed':
        return 'bg-destructive';
      default:
        return 'bg-muted-foreground';
    }
  };

  const getStatusVariant = (status: string): 'success' | 'destructive' | 'outline' => {
    switch (status) {
      case 'sent':
        return 'success';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Filter history based on search and channel filters (status and type are handled by backend)
  const filteredHistory = history.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.message_content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.recipient.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesChannel = channelFilter === 'all' || item.channel_type === channelFilter;
    
    return matchesSearch && matchesChannel;
  });

  const allVisibleSelected =
    filteredHistory.length > 0 && filteredHistory.every(item => selectedIds.has(item.id));
  const someVisibleSelected =
    filteredHistory.some(item => selectedIds.has(item.id)) && !allVisibleSelected;
  const selectedVisibleCount = filteredHistory.filter(item => selectedIds.has(item.id)).length;

  // Define all possible filter options
  const allStatuses = ['sent', 'failed'];
  const allTypes = ['renewal_reminder', 'expiration_warning', 'renewal_success', 'renewal_failure', 'subscription_change'];
  const allChannels = ['telegram', 'email'];

  if (isInitializing) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-4">
      {/* Page Header with Global Page Actions */}
      <div className="ledger-page-heading mb-0">
        <h1>{t('history.title')}</h1>
        <div className="flex items-center gap-2">
          {historyPagination.total > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              className="h-8 gap-1.5 px-3 text-xs text-muted-foreground hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
              onClick={() => setConfirmState({ open: true, mode: 'clear' })}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('history.clearAll')}
            </Button>
          )}
          <Button
            onClick={() => {
              loadHistory(historyPagination.page);
              loadStats();
            }}
            disabled={historyLoading || statsLoading}
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${historyLoading || statsLoading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>
      </div>

      {/* Compact Centered Statistics Strip (unified with Home & Expense Reports) */}
      {stats && (
        <Card className="grid grid-cols-2 overflow-hidden md:grid-cols-4 [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b md:[&>*]:border-b-0 md:[&>*:not(:last-child)]:border-r">
          {[
            [t('stats.total'), stats.total],
            [t('stats.sent'), stats.sent],
            [t('stats.failed'), stats.failed],
            [t('stats.successRate'), stats.total > 0 ? `${Math.round((stats.sent / stats.total) * 100)}%` : '0%'],
          ].map(([label, value]) => (
            <div key={String(label)} className="min-w-0 border-border px-4 py-3 text-center sm:px-5 sm:py-3.5">
              <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-1.5 truncate text-xl font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[22px]">{value}</p>
            </div>
          ))}
        </Card>
      )}

      {/* Single-Row Compact On-Canvas Pill Filter Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <SearchInput
            placeholder={t('history.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 rounded-full bg-muted/50 pl-9 text-xs md:text-xs"
            icon={<Search className="h-3.5 w-3.5 text-muted-foreground" />}
          />
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-1.5 sm:flex sm:items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 justify-center gap-1.5 rounded-full bg-muted/50 px-3 text-xs sm:w-auto [&>svg]:h-3.5 [&>svg]:w-3.5">
              <SelectValue placeholder={t('history.statusFilter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{t('history.allStatuses')}</SelectItem>
              {allStatuses.map(status => (
                <SelectItem key={status} value={status} className="text-xs">
                  {t(`history.statuses.${status}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 justify-center gap-1.5 rounded-full bg-muted/50 px-3 text-xs sm:w-auto [&>svg]:h-3.5 [&>svg]:w-3.5">
              <SelectValue placeholder={t('history.typeFilter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{t('history.allTypes')}</SelectItem>
              {allTypes.map(type => (
                <SelectItem key={type} value={type} className="text-xs">
                  {t(`types.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="h-8 justify-center gap-1.5 rounded-full bg-muted/50 px-3 text-xs sm:w-auto [&>svg]:h-3.5 [&>svg]:w-3.5">
              <SelectValue placeholder={t('history.channelFilter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{t('history.allChannels')}</SelectItem>
              {allChannels.map(channel => (
                <SelectItem key={channel} value={channel} className="text-xs">
                  {t(`channels.${channel}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Single-Layer History List Card */}
      <Card className="overflow-hidden">
        {/* Aligned Selection Bar — checkbox column matches row checkboxes to 0px */}
        <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2 sm:px-5">
          <div className="flex items-center gap-2.5">
            {filteredHistory.length > 0 && (
              <button
                type="button"
                role="checkbox"
                aria-checked={allVisibleSelected ? true : someVisibleSelected ? 'mixed' : false}
                onClick={toggleSelectAllVisible}
                disabled={isDeleting}
                className="inline-flex items-center gap-2.5 rounded-full py-0.5 text-xs font-medium text-foreground transition-colors hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full border transition-colors',
                      allVisibleSelected || someVisibleSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/40 bg-background hover:border-foreground/55'
                    )}
                  >
                    {allVisibleSelected ? (
                      <Check className="h-2.5 w-2.5" strokeWidth={2.75} />
                    ) : someVisibleSelected ? (
                      <span className="h-0.5 w-1.5 rounded-full bg-current" />
                    ) : null}
                  </span>
                </span>
                <span>{t('history.selectAll')}</span>
              </button>
            )}

            <span className="text-xs tabular-nums text-muted-foreground">
              {selectedVisibleCount > 0
                ? t('history.selectedCount', { count: selectedVisibleCount })
                : searchTerm || channelFilter !== 'all'
                  ? t('history.recordsShown', { count: filteredHistory.length, total: historyPagination.total })
                  : t('history.totalRecords', { total: historyPagination.total })}
            </span>
          </div>

          {selectedVisibleCount > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              className="h-7 gap-1.5 rounded-full px-3 text-xs"
              onClick={() => setConfirmState({ open: true, mode: 'batch' })}
            >
              <Trash2 className="h-3 w-3" />
              {t('history.deleteSelected', { count: selectedVisibleCount })}
            </Button>
          )}
        </div>

        {/* Clean Divided List Body */}
        <div className="relative" aria-busy={historyLoading}>
          {historyLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/75 backdrop-blur-[1px]">
              <LoadingIndicator size="md" />
            </div>
          )}

          {filteredHistory.length === 0 ? (
            <div role="status" className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
                <Bell className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <p className="text-xs text-muted-foreground">{t('history.noHistory')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredHistory.map((item) => {
                const parsedContent = parseMessageContent(item.message_content, t);
                const isExpanded = expandedItems.has(item.id);
                const isSelected = selectedIds.has(item.id);
                const itemTitle = item.subscription_name || parsedContent.summary || t('history.defaultMessage');

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'transition-colors',
                      isSelected
                        ? 'bg-primary/[0.035]'
                        : isExpanded
                          ? 'bg-muted/20'
                          : 'hover:bg-muted/35'
                    )}
                  >
                    {/* Compact Single-Row Header */}
                    <div className="flex items-center gap-2.5 px-4 py-2.5 sm:px-5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        aria-label={itemTitle}
                        onClick={() => toggleSelectItem(item.id)}
                        disabled={isDeleting}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 items-center justify-center rounded-full border transition-colors',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/40 bg-background hover:border-foreground/55'
                          )}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5" strokeWidth={2.75} />}
                        </span>
                      </button>

                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => toggleExpanded(item.id)}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <Badge
                            variant={getStatusVariant(item.status)}
                            className="h-5 min-w-[74px] shrink-0 justify-center gap-1.5 rounded-full px-2 text-[11px] font-medium"
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', getStatusDotClass(item.status))} />
                            {t(`history.statuses.${item.status}`)}
                          </Badge>

                          <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
                            {itemTitle}
                          </span>

                          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
                            <span>{t(`types.${item.notification_type}`)}</span>
                            <span aria-hidden="true" className="opacity-40">·</span>
                            <span>{t(`channels.${item.channel_type}`)}</span>
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatDate(item.sent_at || item.created_at || item.scheduled_at)}
                          </span>
                          <ChevronRight
                            className={cn(
                              'h-3.5 w-3.5 text-muted-foreground/65 transition-transform duration-200',
                              isExpanded && 'rotate-90'
                            )}
                          />
                        </div>
                      </button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isDeleting}
                        aria-label={t('history.deleteItem')}
                        onClick={() => setConfirmState({ open: true, mode: 'single', targetId: item.id })}
                        className="h-7 w-7 shrink-0 rounded-full text-muted-foreground/55 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Seamless Indented Detail Area (no extra nested box border) */}
                    <div className="collapsible-grid" data-open={isExpanded}>
                      <div>
                        <div className="pb-3 pl-[46px] pr-4 pt-0.5 sm:pl-[50px] sm:pr-5">
                          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden">
                            <span>{t(`types.${item.notification_type}`)}</span>
                            <span aria-hidden="true" className="opacity-40">·</span>
                            <span>{t(`channels.${item.channel_type}`)}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                            {parsedContent.details.map((detail, index) => (
                              <div key={index} className="inline-flex items-center gap-1.5">
                                {renderDetailIcon(detail.iconKey)}
                                <span className="text-muted-foreground">{detail.label}:</span>
                                <span className="font-medium text-foreground">{detail.value}</span>
                              </div>
                            ))}

                            <div className="inline-flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="text-muted-foreground">{t('history.recipientLabel')}</span>
                              <span className="font-mono text-[11px] font-medium text-foreground">{item.recipient}</span>
                            </div>

                            {item.sent_at && (
                              <div className="inline-flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="text-muted-foreground">{t('history.sentTimeLabel')}</span>
                                <span className="font-medium tabular-nums text-foreground">{formatDate(item.sent_at)}</span>
                              </div>
                            )}
                          </div>

                          {item.error_message && (
                            <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-xl bg-destructive/[0.06] px-3 py-1.5 text-xs text-destructive">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              <span className="min-w-0 break-words">{item.error_message}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Pagination */}
      {historyPagination.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={historyPagination.page}
            totalPages={historyPagination.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState(prev => ({ ...prev, open }))}
        title={
          confirmState.mode === 'clear'
            ? t('history.confirmClearTitle')
            : t('history.confirmDeleteTitle')
        }
        description={
          confirmState.mode === 'clear'
            ? t('history.confirmClearDesc', { total: historyPagination.total })
            : confirmState.mode === 'single'
              ? t('history.confirmDeleteSingle')
              : t('history.confirmDeleteBatch', { count: selectedVisibleCount })
        }
        confirmText={
          confirmState.mode === 'clear'
            ? t('history.clearAll')
            : t('delete', { ns: 'common' })
        }
        cancelText={t('cancel', { ns: 'common' })}
        isDestructive
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
