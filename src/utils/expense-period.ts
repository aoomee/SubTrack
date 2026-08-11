import { getAppLocale } from '@/utils/locale'

export interface ExpensePeriodLabelInput {
  period: string
  periodType: 'monthly' | 'quarterly' | 'yearly'
  startDate: string
}

/**
 * Format report periods using the same locale as the rest of the interface.
 * The analytics layer keeps its original English period keys for sorting; only
 * the visible label is localized here.
 */
export function formatExpensePeriodLabel(
  data: ExpensePeriodLabelInput,
  locale: string = getAppLocale(),
): string {
  const startDate = new Date(`${data.startDate}T00:00:00`)

  if (Number.isNaN(startDate.getTime())) {
    return data.period
  }

  if (data.periodType === 'yearly') {
    return new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(startDate)
  }

  if (data.periodType === 'monthly') {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
    }).format(startDate)
  }

  const quarter = Math.floor(startDate.getMonth() / 3) + 1

  if (locale.toLowerCase().startsWith('zh')) {
    return `${startDate.getFullYear()}年第${quarter}季度`
  }

  const quarterEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 2, 1)
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'short' })

  return `Q${quarter} ${startDate.getFullYear()} (${monthFormatter.format(startDate)} - ${monthFormatter.format(quarterEnd)})`
}
