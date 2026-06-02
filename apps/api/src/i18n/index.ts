import { uz } from './uz'
import { ru } from './ru'

export type SupportedLang = 'uz' | 'ru'

const DICTIONARIES: Record<SupportedLang, Record<string, string>> = { uz, ru }

export function resolveLang(header: string | undefined): SupportedLang {
  if (header === 'ru' || header === 'uz') return header
  return 'uz'
}

export function translate(
  lang: SupportedLang,
  code: string,
  args: Record<string, unknown> = {},
): string {
  const dict = DICTIONARIES[lang]
  const template = dict[code] ?? uz[code] ?? code
  return template.replace(/%\{(\w+)\}/g, (_, key) => String(args[key] ?? `%{${key}}`))
}
