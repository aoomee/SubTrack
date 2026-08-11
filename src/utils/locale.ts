/**
 * Resolve the locale used by the visible application UI.
 *
 * Keeping this in one place prevents browser locale and language-switcher
 * locale from drifting apart when formatting dates and reporting periods.
 */
export function getAppLocale(): string {
  if (typeof document !== 'undefined') {
    const language = document.documentElement.lang

    if (language) {
      return language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
    }
  }

  return 'en-US'
}
