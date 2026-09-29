import { describe, expect, test, vi } from 'vitest';
import { calculateCategoryExpensesFromNewApi, calculateYearlyExpensesFromMonthly, getApiMonthlyExpenses, transformMonthlyCategorySummaries, transformMonthlyCategorySummariesToGroupedData } from './expense-analytics-api';
import { getMonthlyCategorySummaries, type MonthlyCategorySummariesResponse } from '@/services/monthlyCategorySummaryApi';
import { formatChartMonth } from '@/utils/chart-date';

vi.mock('@/utils/currency', () => ({ convertCurrency: (amount: number) => amount }));
vi.mock('@/services/monthlyCategorySummaryApi', () => ({ getMonthlyCategorySummaries: vi.fn() }));

const response: MonthlyCategorySummariesResponse = {
  summaries: [{
    year: 2026, month: 9, monthKey: '2026-09', categoryId: 1, categoryValue: 'other', categoryLabel: 'Other',
    totalAmount: 100, baseCurrency: 'CNY', transactionsCount: 2, updatedAt: '', subscriptionIds: [9], paymentIds: [12, 15]
  }],
  summary: { totalRecords: 1, dateRange: { startYear: 2025, startMonth: 10, endYear: 2026, endMonth: 9 } }
};

describe('expense trend data', () => {
  test('fills all 12 consecutive months, including cross-year zero months', () => {
    const data = transformMonthlyCategorySummaries(response, 'CNY');
    expect(data).toHaveLength(12);
    expect(data[0]).toMatchObject({ monthKey: '2025-10', amount: 0 });
    expect(data[11]).toMatchObject({ monthKey: '2026-09', amount: 100, subscriptionCount: 1, paymentHistoryIds: [12, 15] });
    expect(transformMonthlyCategorySummariesToGroupedData(response, 'CNY').map(row => row.monthKey)).toEqual(data.map(row => row.monthKey));
  });
  test('does not invent history for an empty account', () => {
    expect(transformMonthlyCategorySummaries({ ...response, summaries: [] }, 'CNY')).toEqual([]);
  });
  test('does not count each allocated month as a separate subscription in the category chart', () => {
    const allocated = { ...response, summaries: [response.summaries[0], { ...response.summaries[0], monthKey: '2026-08', month: 8 }] };
    expect(calculateCategoryExpensesFromNewApi(allocated, 'CNY')[0]).toMatchObject({ amount: 200, subscriptionCount: 1 });
  });
  test('yearly subscription count deduplicates actual subscription IDs', () => {
    const data = transformMonthlyCategorySummaries(response, 'CNY');
    expect(calculateYearlyExpensesFromMonthly([...data, { ...data[11], monthKey: '2026-08' }])[1]).toEqual({ year: 2026, amount: 200, subscriptionCount: 1 });
  });
  test('requests allocations for trends, cash for payment details', async () => {
    vi.mocked(getMonthlyCategorySummaries).mockResolvedValue(response);
    await getApiMonthlyExpenses(new Date(2025, 9, 1), new Date(2026, 8, 29), 'CNY');
    expect(getMonthlyCategorySummaries).toHaveBeenLastCalledWith(2025, 10, 2026, 9, 'amortized');
    await getApiMonthlyExpenses(new Date(2025, 9, 1), new Date(2026, 8, 29), 'CNY', 'cash');
    expect(getMonthlyCategorySummaries).toHaveBeenLastCalledWith(2025, 10, 2026, 9, 'cash');
  });
  test('formats Chinese and English ticks and full tooltip dates from the same key', () => {
    expect(formatChartMonth('2026-09', 'zh-CN')).toBe('9月');
    expect(formatChartMonth('2026-09', 'en')).toBe('Sep');
    expect(formatChartMonth('2026-09', 'zh-CN', true)).toBe('2026年9月');
    expect(formatChartMonth('2026-09', 'en', true)).toBe('Sep 2026');
  });
});
