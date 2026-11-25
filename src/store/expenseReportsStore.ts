import { create } from 'zustand'
import type { MonthlyExpense, YearlyExpense, CategoryExpense } from '@/lib/expense-analytics-api'
import type { ExpenseInfoData } from '@/components/charts/ExpenseInfoCards'

export interface MonthlyCategoryExpenseItem {
  month: string
  monthKey: string
  year: number
  categories: Record<string, number>
  total: number
}

export interface YearlyGroupedCategoryExpenseItem {
  year: number
  categories: Record<string, number>
  total: number
}

interface ExpenseReportsState {
  currency: string | null
  hasLoaded: boolean
  dashboardMonthlyTrend: MonthlyExpense[]
  dashboardTrendCurrency: string | null
  monthlyExpenses: MonthlyExpense[]
  yearlyExpenses: YearlyExpense[]
  categoryExpenses: CategoryExpense[]
  yearlyCategoryExpenses: CategoryExpense[]
  monthlyCategoryExpenses: MonthlyCategoryExpenseItem[]
  yearlyGroupedCategoryExpenses: YearlyGroupedCategoryExpenseItem[]
  expenseInfoData: {
    monthly: ExpenseInfoData[]
    quarterly: ExpenseInfoData[]
    yearly: ExpenseInfoData[]
  }
  setDashboardTrend: (currency: string, trend: MonthlyExpense[]) => void
  setReportData: (payload: {
    currency: string
    monthlyExpenses: MonthlyExpense[]
    yearlyExpenses: YearlyExpense[]
    categoryExpenses: CategoryExpense[]
    yearlyCategoryExpenses: CategoryExpense[]
    monthlyCategoryExpenses: MonthlyCategoryExpenseItem[]
    yearlyGroupedCategoryExpenses: YearlyGroupedCategoryExpenseItem[]
    expenseInfoData: {
      monthly: ExpenseInfoData[]
      quarterly: ExpenseInfoData[]
      yearly: ExpenseInfoData[]
    }
  }) => void
  reset: () => void
}

const initialState = {
  currency: null as string | null,
  hasLoaded: false,
  dashboardMonthlyTrend: [] as MonthlyExpense[],
  dashboardTrendCurrency: null as string | null,
  monthlyExpenses: [] as MonthlyExpense[],
  yearlyExpenses: [] as YearlyExpense[],
  categoryExpenses: [] as CategoryExpense[],
  yearlyCategoryExpenses: [] as CategoryExpense[],
  monthlyCategoryExpenses: [] as MonthlyCategoryExpenseItem[],
  yearlyGroupedCategoryExpenses: [] as YearlyGroupedCategoryExpenseItem[],
  expenseInfoData: {
    monthly: [] as ExpenseInfoData[],
    quarterly: [] as ExpenseInfoData[],
    yearly: [] as ExpenseInfoData[],
  },
}

export const useExpenseReportsStore = create<ExpenseReportsState>((set) => ({
  ...initialState,
  setDashboardTrend: (currency, trend) =>
    set({ dashboardTrendCurrency: currency, dashboardMonthlyTrend: trend }),
  setReportData: (payload) =>
    set({
      ...payload,
      hasLoaded: true,
    }),
  reset: () => set({ ...initialState }),
}))
