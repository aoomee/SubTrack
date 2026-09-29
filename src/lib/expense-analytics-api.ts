import {
  getMonthlyCategorySummaries,
  getMonthCategorySummary,
  getTotalSummary,
  type MonthlyCategorySummariesResponse
} from '@/services/monthlyCategorySummaryApi';
import { convertCurrency } from '@/utils/currency';
import i18n from 'i18next';
import { formatChartMonth } from '@/utils/chart-date';

// 适配API的数据类型定义
export interface MonthlyExpense {
  monthKey: string;
  month: string; // 格式化的月份显示，如 "Jun 2025"
  year: number;
  amount: number;
  subscriptionCount: number;
  paymentHistoryIds?: number[];
  subscriptionIds?: number[];
  paymentCount?: number;
}

export interface ExpenseMetrics {
  totalSpent: number;
  averageMonthly: number;
  averagePerSubscription: number;
  highestMonth: MonthlyExpense | null;
  lowestMonth: MonthlyExpense | null;
  growthRate: number;
}

export interface YearlyExpense {
  year: number;
  amount: number;
  subscriptionCount: number;
}

export interface CategoryExpense {
  category: string;
  amount: number;
  percentage: number;
  subscriptionCount: number;
}

// Keep a continuous time axis, including months with zero cost. Month keys are
// locale-independent; charts format them in the current language at render time.
function getRangeMonthKeys(response: MonthlyCategorySummariesResponse): string[] {
  if (!response.summaries.length) return [];
  const { startYear, startMonth, endYear, endMonth } = response.summary.dateRange;
  const keys: string[] = [];
  for (let index = startYear * 12 + startMonth - 1; index <= endYear * 12 + endMonth - 1; index++) {
    keys.push(`${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`);
  }
  return keys;
}

/**
 * 将月度分类汇总数据转换为分组柱状图需要的格式
 */
export function transformMonthlyCategorySummariesToGroupedData(
  summariesResponse: MonthlyCategorySummariesResponse,
  targetCurrency: string
): { month: string; monthKey: string; year: number; categories: { [categoryName: string]: number }; total: number }[] {
  // Derive base currency from data (server truth); fallback to first summary or 'CNY'
  const serverBaseCurrency = summariesResponse.summaries[0]?.baseCurrency || 'CNY';
  // 按月份分组数据
  const monthlyMap = new Map<string, { categories: Map<string, number>; total: number }>();
  getRangeMonthKeys(summariesResponse).forEach(key => monthlyMap.set(key, { categories: new Map(), total: 0 }));

  summariesResponse.summaries.forEach(summary => {
    const monthKey = summary.monthKey;

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { categories: new Map(), total: 0 });
    }

    const monthData = monthlyMap.get(monthKey)!;
    const convertedAmount = convertCurrency(summary.totalAmount, serverBaseCurrency, targetCurrency);
    const categoryName = summary.categoryLabel.toLowerCase();
    
    monthData.categories.set(categoryName, (monthData.categories.get(categoryName) || 0) + convertedAmount);
    monthData.total += convertedAmount;
  });

  // 转换为图表需要的格式
  return Array.from(monthlyMap.entries())
    .map(([monthKey, data]) => {
      const [yearStr] = monthKey.split('-');
      const year = parseInt(yearStr);

      // 格式化月份显示
      const monthDisplay = formatChartMonth(monthKey, i18n.resolvedLanguage || i18n.language || 'en', true);

      // 将 Map 转换为对象
      const categories: { [categoryName: string]: number } = {};
      data.categories.forEach((amount, category) => {
        categories[category] = Math.round(amount * 100) / 100;
      });

      return {
        monthKey,
        month: monthDisplay,
        year,
        categories,
        total: Math.round(data.total * 100) / 100
      };
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

/**
 * 将月度分类汇总数据转换为年度分组数据
 */
export function transformMonthlyCategorySummariesToYearlyGroupedData(
  summariesResponse: MonthlyCategorySummariesResponse,
  targetCurrency: string
): { year: number; categories: { [categoryName: string]: number }; total: number }[] {
  const serverBaseCurrency = summariesResponse.summaries[0]?.baseCurrency || 'CNY';
  // 按年份分组数据
  const yearlyMap = new Map<number, { categories: Map<string, number>; total: number }>();

  summariesResponse.summaries.forEach(summary => {
    const year = summary.year;

    if (!yearlyMap.has(year)) {
      yearlyMap.set(year, { categories: new Map(), total: 0 });
    }

    const yearData = yearlyMap.get(year)!;
    const convertedAmount = convertCurrency(summary.totalAmount, serverBaseCurrency, targetCurrency);
    const categoryName = summary.categoryLabel.toLowerCase();
    
    yearData.categories.set(categoryName, (yearData.categories.get(categoryName) || 0) + convertedAmount);
    yearData.total += convertedAmount;
  });

  // 转换为图表需要的格式
  return Array.from(yearlyMap.entries())
    .map(([year, data]) => {
      // 将 Map 转换为对象
      const categories: { [categoryName: string]: number } = {};
      data.categories.forEach((amount, category) => {
        categories[category] = Math.round(amount * 100) / 100;
      });

      return {
        year,
        categories,
        total: Math.round(data.total * 100) / 100
      };
    })
    .sort((a, b) => a.year - b.year);
}

/**
 * 获取基于新API的年度分类分组数据
 */
export async function getApiYearlyCategoryExpenses(
  startDate: Date,
  endDate: Date,
  currency: string
): Promise<{ year: number; categories: { [categoryName: string]: number }; total: number }[]> {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth() + 1;

  const response = await getMonthlyCategorySummaries(startYear, startMonth, endYear, endMonth, 'amortized');
  return transformMonthlyCategorySummariesToYearlyGroupedData(response, currency);
}
export async function getApiMonthlyCategoryExpenses(
  startDate: Date,
  endDate: Date,
  currency: string
): Promise<{ month: string; monthKey: string; year: number; categories: { [categoryName: string]: number }; total: number }[]> {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth() + 1;

  const response = await getMonthlyCategorySummaries(startYear, startMonth, endYear, endMonth, 'amortized');
  return transformMonthlyCategorySummariesToGroupedData(response, currency);
}
export function transformMonthlyCategorySummaries(
  summariesResponse: MonthlyCategorySummariesResponse,
  targetCurrency: string
): MonthlyExpense[] {
  // 按月份分组汇总数据
  const monthlyMap = new Map<string, { amount: number; transactionCount: number; subscriptionIds: Set<number>; paymentIds: Set<number> }>();
  const emptyMonth = () => ({ amount: 0, transactionCount: 0, subscriptionIds: new Set<number>(), paymentIds: new Set<number>() });
  getRangeMonthKeys(summariesResponse).forEach(key => monthlyMap.set(key, emptyMonth()));
  const serverBaseCurrency = summariesResponse.summaries[0]?.baseCurrency || 'CNY';

  summariesResponse.summaries.forEach(summary => {
    const monthKey = summary.monthKey;

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, emptyMonth());
    }

    const monthData = monthlyMap.get(monthKey)!;
    // Convert from base currency to target currency
    const convertedAmount = convertCurrency(summary.totalAmount, serverBaseCurrency, targetCurrency);
    monthData.amount += convertedAmount;
    monthData.transactionCount += summary.transactionsCount;
    summary.subscriptionIds?.forEach(id => monthData.subscriptionIds.add(id));
    summary.paymentIds?.forEach(id => monthData.paymentIds.add(id));
  });

  // 转换为 MonthlyExpense 格式
  return Array.from(monthlyMap.entries())
    .map(([monthKey, data]) => {
      const [yearStr] = monthKey.split('-');
      const year = parseInt(yearStr);

      // 格式化月份显示
      const monthDisplay = formatChartMonth(monthKey, i18n.resolvedLanguage || i18n.language || 'en', true);

      return {
        monthKey,
        month: monthDisplay,
        year,
        amount: Math.round(data.amount * 100) / 100,
        subscriptionCount: data.subscriptionIds.size || data.transactionCount,
        paymentCount: data.transactionCount,
        subscriptionIds: [...data.subscriptionIds],
        paymentHistoryIds: [...data.paymentIds]
      };
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

/**
 * 获取基于新API的月度费用数据
 */
export async function getApiMonthlyExpenses(
  startDate: Date,
  endDate: Date,
  currency: string,
  basis: 'cash' | 'amortized' = 'amortized'
): Promise<MonthlyExpense[]> {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth() + 1;

  const response = await getMonthlyCategorySummaries(startYear, startMonth, endYear, endMonth, basis);
  return transformMonthlyCategorySummaries(response, currency);
}





/**
 * 计算年度费用数据（从月度数据聚合）
 */
export function calculateYearlyExpensesFromMonthly(monthlyExpenses: MonthlyExpense[]): YearlyExpense[] {
  const yearlyMap = new Map<number, { amount: number; subscriptions: Set<number> }>();

  monthlyExpenses.forEach(expense => {
    if (!yearlyMap.has(expense.year)) {
      yearlyMap.set(expense.year, { amount: 0, subscriptions: new Set() });
    }

    const yearData = yearlyMap.get(expense.year)!;
    yearData.amount += expense.amount;
    
    if (expense.subscriptionIds) {
      expense.subscriptionIds.forEach(id => yearData.subscriptions.add(id));
    }
  });

  return Array.from(yearlyMap.entries())
    .map(([year, data]) => ({
      year,
      amount: Math.round(data.amount * 100) / 100,
      subscriptionCount: data.subscriptions.size
    }))
    .sort((a, b) => a.year - b.year);
}

/**
 * 获取当月支出
 */
export async function getCurrentMonthSpending(currency: string): Promise<number> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  try {
    const response = await getMonthCategorySummary(currentYear, currentMonth);
    // Convert from API base currency to user's preferred currency
    const convertedAmount = convertCurrency(response.totalAmount, response.baseCurrency, currency);
    return convertedAmount;
  } catch (error) {
    console.error('Failed to get current month spending:', error);
    return 0;
  }
}

/**
 * 获取当年总支出（只计算到当前月份）
 */
export async function getCurrentYearSpending(currency: string): Promise<number> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11, so add 1

  try {
    const response = await getTotalSummary(currentYear, 1, currentYear, currentMonth);
    // Convert from API base currency to user's preferred currency
    const convertedAmount = convertCurrency(response.totalAmount, response.baseCurrency, currency);
    return convertedAmount;
  } catch (error) {
    console.error('Failed to get current year spending:', error);
    return 0;
  }
}

/**
 * 从新API数据计算分类支出
 */
export function calculateCategoryExpensesFromNewApi(
  summariesResponse: MonthlyCategorySummariesResponse,
  targetCurrency: string
): CategoryExpense[] {
  const categoryMap = new Map<string, { amount: number; transactionCount: number; subscriptionIds: Set<number> }>();
  let totalAmount = 0;
  const serverBaseCurrency = summariesResponse.summaries[0]?.baseCurrency || 'CNY';

  // 聚合所有月份的分类数据
  summariesResponse.summaries.forEach(summary => {
    const categoryLabel = summary.categoryLabel;
    // Convert from API base currency to target currency
    const convertedAmount = convertCurrency(summary.totalAmount, serverBaseCurrency, targetCurrency);

    if (!categoryMap.has(categoryLabel)) {
      categoryMap.set(categoryLabel, { amount: 0, transactionCount: 0, subscriptionIds: new Set() });
    }

    const categoryData = categoryMap.get(categoryLabel)!;
    categoryData.amount += convertedAmount;
    categoryData.transactionCount += summary.transactionsCount;
    summary.subscriptionIds?.forEach(id => categoryData.subscriptionIds.add(id));
    totalAmount += convertedAmount;
  });

  // 转换为CategoryExpense数组并计算百分比
  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      amount: Math.round(data.amount * 100) / 100,
      percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
      subscriptionCount: data.subscriptionIds.size || data.transactionCount
    }))
    .sort((a, b) => b.amount - a.amount); // 按金额降序排列
}

/**
 * 获取基于新API的分类支出数据
 */
export async function getApiCategoryExpenses(
  startDate: Date,
  endDate: Date,
  currency: string
): Promise<CategoryExpense[]> {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth() + 1;

  const response = await getMonthlyCategorySummaries(startYear, startMonth, endYear, endMonth, 'amortized');
  return calculateCategoryExpensesFromNewApi(response, currency);
}
