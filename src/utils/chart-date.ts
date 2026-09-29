/** Format stable YYYY-MM keys without parsing a locale-dependent display string. */
export function formatChartMonth(monthKey: string, language: string, includeYear = false): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return monthKey;
  return new Intl.DateTimeFormat(language || 'en', {
    month: 'short',
    ...(includeYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
