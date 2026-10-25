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
  return <Card className={className}>
    <CardHeader>
      <CardTitle>{t('chart.spendingByCategory')}</CardTitle>
      <CardDescription>{t(descriptionKey)}</CardDescription>
    </CardHeader>
    <CardContent>
      {data.length ? <div className="space-y-5">
        {data.map((item, index) => <div key={item.category} className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-medium">{categories.find(category => category.value === item.category)?.label || item.category}</span>
            <span className="shrink-0 font-semibold tabular-nums">{formatCurrencyAmount(item.amount, currency)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, item.percentage))}%`, background: `hsl(var(--chart-${index % 5 + 1}))` }} /></div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>{t('chart.subscriptions')}: {item.subscriptionCount}</span><span>{item.percentage.toFixed(1)}%</span></div>
        </div>)}
        <div className="flex justify-between border-t pt-4 text-xs"><span className="text-muted-foreground">{t('chart.total')}</span><span className="font-semibold">{formatCurrencyAmount(data.reduce((sum, item) => sum + item.amount, 0), currency)}</span></div>
      </div> : <p className="flex min-h-48 items-center justify-center text-xs text-muted-foreground">{t('chart.noCategoryDataAvailable')}</p>}
    </CardContent>
  </Card>
}
