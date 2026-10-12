import { READINGS, type Feed, type FeedData, type Reading, type StatusRule } from './types.ts'

/**
 * How a feed reads its own values, applied the same way by the bundle (for the
 * dashboard) and by the protocol page.
 *
 * Only a word or band the feed's rule lists yields a reading. A value the rule
 * does not match, or a feed with no rule, yields none — the page then shows the
 * value as neutral data. We never infer a reading of our own.
 */

/** The feed's own word or band in a headline, lower-case, when its rule finds one there. */
export function statusWord(rule: StatusRule | undefined, value: string | undefined): string | null {
  if (!rule || !value) return null
  try {
    return new RegExp(rule.match, 'i').exec(value)?.[1]?.toLowerCase() ?? null
  } catch {
    return null
  }
}

export function readStatus(feed: Feed, data: FeedData | undefined): Reading | null {
  if (data?.status !== 'ok') return null
  const word = statusWord(feed.status, data.value)
  const values = feed.status?.values
  return word && values && Object.hasOwn(values, word) ? (values[word] ?? null) : null
}

/** A rule that cannot be applied fails when the registry loads, not as a silent neutral later. */
export function checkStatusRule(id: string, rule: StatusRule): void {
  const where = `adapters/feeds/${id}/feed.json: "status"`
  if (!rule.rule?.trim()) throw new Error(`${where} needs a "rule" sentence for readers`)
  try {
    new RegExp(rule.match, 'i')
  } catch {
    throw new Error(`${where}: "match" is not a valid regular expression`)
  }
  const entries = Object.entries(rule.values ?? {})
  if (entries.length === 0) throw new Error(`${where}: "values" is empty`)
  for (const [word, reading] of entries) {
    if (word !== word.toLowerCase()) throw new Error(`${where}: "${word}" must be lower-case`)
    if (!READINGS.includes(reading)) {
      throw new Error(`${where}: "${word}" must read as one of ${READINGS.join(', ')}`)
    }
  }
}
