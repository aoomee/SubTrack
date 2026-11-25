import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartConfig } from "@/components/ui/chart"
import { formatCurrencyAmount } from "@/utils/currency"
import { MonthlyExpense } from "@/lib/expense-analytics-api"
import { LineChart as LineChartIcon, BarChart3 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { formatChartMonth } from '@/utils/chart-date'

interface ExpenseTrendChartProps {
  data: MonthlyExpense[]
  categoryData?: CategoryExpenseData[] // 新增：按类别分组的数据
  currency: string
  className?: string
}

// 新增：类别数据类型
interface CategoryExpenseData {
  month: string
  monthKey: string
  year: number
  categories: {
    [categoryName: string]: number
  }
  total: number
}

const chartConfig = {
  amount: {
    label: "Amount",
    color: "hsl(var(--chart-1))",
  },
  // 预定义类别颜色
  streaming: {
    label: "Streaming",
    color: "hsl(var(--chart-1))",
  },
  productivity: {
    label: "Productivity",
    color: "hsl(var(--chart-2))",
  },
  cloud: {
    label: "Cloud Services",
    color: "hsl(var(--chart-3))",
  },
  entertainment: {
    label: "Entertainment",
    color: "hsl(var(--chart-4))",
  },
  fitness: {
    label: "Fitness",
    color: "hsl(var(--chart-5))",
  },
  other: {
    label: "Other",
    color: "hsl(var(--muted-foreground))",
  },
} satisfies ChartConfig

export function ExpenseTrendChart({ data, categoryData, currency, className }: ExpenseTrendChartProps) {
  const { t, i18n } = useTranslation('reports')
  const language = i18n.resolvedLanguage || i18n.language
  const [chartType, setChartType] = useState<'line' | 'groupedBar'>('line')
  
  // 获取所有类别名称（用于分组柱状图）
  const allCategories = categoryData ? 
    Array.from(new Set(
      categoryData.flatMap(item => Object.keys(item.categories))
    )).sort() : []

  // 为类别分配颜色
  const getCategoryColor = (category: string, index: number) => {
    const colorKeys = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']
    return `hsl(var(--${colorKeys[index % colorKeys.length]}))`
  }

  const renderChart = () => {
    if (chartType === 'line') {
      return (
        <LineChart
          data={data}
          margin={{
            top: 10,
            right: 16,
            left: 4,
            bottom: 4
          }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/70" />
          <XAxis
            dataKey="monthKey"
            className="text-xs fill-muted-foreground"
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => formatChartMonth(String(value), language)}
            padding={{ left: 10, right: 10 }}
            height={26}
            minTickGap={20}
            tickMargin={8}
          />
          <YAxis
            className="text-xs fill-muted-foreground"
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => formatCurrencyAmount(value, currency)}
            width={68}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as MonthlyExpense
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-md">
                    <div className="grid gap-2">
                      <div className="font-medium">{formatChartMonth(String(label), language, true)}</div>
                      <div className="grid gap-1 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">{t('chart.amount')}:</span>
                          <span className="font-medium">
                            {formatCurrencyAmount(data.amount, currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">{t('chart.subscriptions')}:</span>
                          <span className="font-medium">{data.subscriptionCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="var(--color-amount)"
            strokeWidth={2.25}
            dot={{ fill: "var(--color-amount)", strokeWidth: 0, r: 3.5 }}
            activeDot={{ r: 5, stroke: "hsl(var(--background))", strokeWidth: 2 }}
          />
        </LineChart>
      )
    } else {
      // 分组柱状图
      return (
        <BarChart
          data={categoryData || []}
          margin={{
            top: 10,
            right: 16,
            left: 4,
            bottom: 4
          }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/70" />
          <XAxis
            dataKey="monthKey"
            className="text-xs fill-muted-foreground"
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => formatChartMonth(String(value), language)}
            padding={{ left: 8, right: 8 }}
            height={26}
            minTickGap={20}
            tickMargin={8}
          />
          <YAxis
            className="text-xs fill-muted-foreground"
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => formatCurrencyAmount(value, currency)}
            width={68}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-md">
                    <div className="grid gap-2">
                      <div className="font-medium">{formatChartMonth(String(label), language, true)}</div>
                      <div className="grid gap-1 text-sm">
                        {payload.map((entry, index) => (
                          <div key={index} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div 
                                className="h-2 w-2 rounded-full" 
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-muted-foreground capitalize">{String(entry.dataKey).replace('categories.', '')}:</span>
                            </div>
                            <span className="font-medium">
                              {formatCurrencyAmount(entry.value as number, currency)}
                            </span>
                          </div>
                        ))}
                        <div className="border-t pt-1 mt-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground font-medium">{t('chart.total')}:</span>
                            <span className="font-semibold">
                              {formatCurrencyAmount(
                                payload.reduce((sum, entry) => sum + (entry.value as number), 0), 
                                currency
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          {allCategories.map((category, index) => (
            <Bar
              key={category}
              dataKey={`categories.${category}`}
              name={category}
              fill={getCategoryColor(category, index)}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      )
    }
  }
  
  return (
    <Card className={`flex min-h-[280px] flex-col ${className || ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle>{t('chart.expenseTrends')}</CardTitle>
          <CardDescription>
            {chartType === 'line' 
              ? t('chart.monthlySpendingOverTime')
              : t('chart.monthlySpendingByCategory')
            }
          </CardDescription>
        </div>
        {categoryData && categoryData.length > 0 && (
        <div className="flex items-center gap-3">
          {/* 图表类型切换按钮 */}
          <div className="glass-tabs-list flex items-center rounded-full p-0.5">
            <Button
              variant={chartType === 'line' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartType('line')}
              aria-label="Line chart"
              aria-pressed={chartType === 'line'}
              className="h-7 rounded-full px-2.5"
            >
              <LineChartIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={chartType === 'groupedBar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartType('groupedBar')}
              aria-label="Category bar chart"
              aria-pressed={chartType === 'groupedBar'}
              className="h-7 rounded-full px-2.5"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 sm:px-5">
        {(chartType === 'line' ? data.length === 0 : !categoryData || categoryData.length === 0) ? (
          <div className="flex min-h-[200px] flex-1 items-center justify-center text-xs text-muted-foreground">
            {chartType === 'line' 
              ? t('chart.noExpenseDataAvailable')
              : t('chart.noCategoryDataAvailable')
            }
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="aspect-auto min-h-[215px] w-full flex-1 sm:min-h-[235px]">
              {renderChart()}
            </ChartContainer>
            {/* 分组柱状图图例 */}
            {chartType === 'groupedBar' && allCategories.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-3 border-t pt-3">
                {allCategories.map((category, index) => (
                  <div key={category} className="flex items-center gap-1.5 text-xs">
                    <div 
                      className="h-2.5 w-2.5 rounded-sm" 
                      style={{ backgroundColor: getCategoryColor(category, index) }}
                    />
                    <span className="text-muted-foreground capitalize">{category}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
