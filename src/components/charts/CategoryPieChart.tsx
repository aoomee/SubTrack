import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrencyAmount } from '@/utils/currency'
import type { CategoryExpense } from '@/lib/expense-analytics-api'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { useTranslation } from 'react-i18next'

interface CategoryPieChartProps {
  data: CategoryExpense[]
  currency: string
  className?: string
  descriptionKey: string
}

// Retain the public component interface while presenting the reference's
// directly readable category amounts and proportions instead of pie slices.
export function CategoryPieChart({ data, currency, className, descriptionKey }: CategoryPieChartProps) {
  const { t } = useTranslation('reports')
  const categories = useSubscriptionStore(state => state.categories)
  return <Card className={`flex min-h-[280px] flex-col ${className || ''}`}>
    <CardHeader className="pb-3">
      <CardTitle>{t('chart.spendingByCategory')}</CardTitle>
      <CardDescription>{t(descriptionKey)}</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col">
      {data.length ? <div className="flex flex-1 flex-col justify-between gap-3">
        <div className="-mr-1 max-h-[218px] space-y-2.5 overflow-y-auto pr-1">
          {data.map((item, index) => <div key={item.category} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-xs leading-4">
              <div className="flex min-w-0 items-baseline gap-1.5">
                <span className="truncate font-medium">{categories.find(category => category.value === item.category)?.label || item.category}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">({item.subscriptionCount})</span>
              </div>
              <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="text-[11px] text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                <span className="min-w-[4.5rem] text-right font-semibold">{formatCurrencyAmount(item.amount, currency)}</span>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true"><div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${Math.max(0, Math.min(100, item.percentage))}%`, background: `hsl(var(--chart-${index % 5 + 1}))` }} /></div>
          </div>)}
        </div>
        <div className="flex justify-between border-t pt-3 text-xs"><span className="text-muted-foreground">{t('chart.total')}</span><span className="font-semibold tabular-nums">{formatCurrencyAmount(data.reduce((sum, item) => sum + item.amount, 0), currency)}</span></div>
      </div> : <p className="flex min-h-[200px] flex-1 items-center justify-center text-xs text-muted-foreground">{t('chart.noCategoryDataAvailable')}</p>}
    </CardContent>
  </Card>
}
