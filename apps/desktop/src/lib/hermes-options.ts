import { sanitizeLanguageTag } from '@/lib/markdown-code'

/**
 * hermes-options fenced blocks — machine-readable option chips the backend
 * appends to certain chat messages (e.g. a swarm-direction question). The
 * renderer turns a valid payload into clickable buttons; anything malformed
 * falls back to a plain code block so content is never swallowed.
 *
 * Pure and cheap: it runs per streaming delta on the growing fence body.
 * Ordering (recommended first) is decided here so the component renders the
 * payload exactly as given.
 */

export const HERMES_OPTIONS_LANGUAGE = 'hermes-options'

export interface HermesOption {
  id: string
  label: string
  recommended?: boolean
}

export interface HermesOptionsPayload {
  kind: string
  options: HermesOption[]
}

export function isHermesOptionsLanguage(language: string | null | undefined): boolean {
  return sanitizeLanguageTag(language || '') === HERMES_OPTIONS_LANGUAGE
}

function isHermesOption(value: unknown): value is HermesOption {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>

  return typeof record.id === 'string' && typeof record.label === 'string'
}

export function parseHermesOptions(code: string): HermesOptionsPayload | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(code)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }

  const record = parsed as Record<string, unknown>

  if (typeof record.kind !== 'string' || !record.kind.trim()) {
    return null
  }

  if (!Array.isArray(record.options) || record.options.length === 0) {
    return null
  }

  if (!record.options.every(isHermesOption)) {
    return null
  }

  const options: HermesOption[] = record.options.map(option => ({
    id: option.id,
    label: option.label,
    ...(option.recommended === true ? { recommended: true } : {})
  }))

  // Recommended-first, stable within each group — the payload order decides
  // ties, only the recommended flag promotes.
  const recommended = options.filter(option => option.recommended === true)
  const rest = options.filter(option => option.recommended !== true)

  return { kind: record.kind, options: [...recommended, ...rest] }
}
